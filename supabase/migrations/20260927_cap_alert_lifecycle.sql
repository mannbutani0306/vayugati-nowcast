-- Enforce the reviewed CAP alert lifecycle and expose vector-aware citizen ETAs.
DO $$
DECLARE
    constraint_row record;
BEGIN
    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.cap_alerts'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.cap_alerts DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;
END;
$$;

ALTER TABLE public.cap_alerts
    ADD CONSTRAINT cap_alerts_status_lifecycle_check
    CHECK (status IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'));

CREATE OR REPLACE FUNCTION public.guard_cap_alert_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    IF (OLD.status = 'DRAFT' AND NEW.status = 'UNDER_REVIEW')
       OR (OLD.status = 'UNDER_REVIEW' AND NEW.status IN ('APPROVED', 'REJECTED', 'CANCELLED'))
       OR (OLD.status = 'APPROVED' AND NEW.status = 'CANCELLED') THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Invalid CAP alert transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS cap_alerts_status_transition_guard ON public.cap_alerts;
CREATE TRIGGER cap_alerts_status_transition_guard
BEFORE UPDATE OF status ON public.cap_alerts
FOR EACH ROW
EXECUTE FUNCTION public.guard_cap_alert_status_transition();

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP POLICY IF EXISTS audit_officer_insert ON public.audit_logs;
CREATE POLICY audit_officer_insert ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (
        public.is_duty_officer_or_admin()
        AND actor_id = auth.uid()
        AND entity_type = 'convective_cells'
        AND action = 'RISK_OVERRIDE'
    );

CREATE OR REPLACE FUNCTION public.get_cap_alert_audit_logs(p_limit integer DEFAULT 100)
RETURNS TABLE (
    log_id uuid,
    actor_id uuid,
    action text,
    entity_id uuid,
    rationale text,
    old_values jsonb,
    new_values jsonb,
    created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_duty_officer_or_admin() THEN
        RAISE EXCEPTION 'Authenticated Duty Officer or Admin role required';
    END IF;
    RETURN QUERY
    SELECT entry.id, entry.actor_id, entry.action, entry.entity_id, entry.rationale,
           entry.old_values, entry.new_values, entry.created_at
    FROM public.audit_logs AS entry
    WHERE entry.entity_type = 'cap_alerts'
    ORDER BY entry.created_at DESC
    LIMIT least(greatest(coalesce(p_limit, 100), 1), 250);
END;
$$;
REVOKE ALL ON FUNCTION public.get_cap_alert_audit_logs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cap_alert_audit_logs(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.begin_cap_alert_review(
    p_alert_id uuid,
    p_headline_en text DEFAULT NULL,
    p_description_en text DEFAULT NULL,
    p_severity text DEFAULT NULL,
    p_location_label text DEFAULT NULL,
    p_eta_minutes integer DEFAULT NULL
)
RETURNS public.cap_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    old_alert public.cap_alerts;
    review_alert public.cap_alerts;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_duty_officer_or_admin() THEN
        RAISE EXCEPTION 'Authenticated Duty Officer or Admin role required';
    END IF;

    SELECT * INTO old_alert FROM public.cap_alerts WHERE id = p_alert_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Alert not found'; END IF;
    IF old_alert.status <> 'DRAFT' THEN RAISE EXCEPTION 'Only DRAFT alerts can enter review'; END IF;
    IF p_headline_en IS NOT NULL AND length(trim(p_headline_en)) = 0 THEN
        RAISE EXCEPTION 'Alert headline cannot be empty';
    END IF;
    IF p_severity IS NOT NULL AND p_severity NOT IN ('Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown') THEN
        RAISE EXCEPTION 'Invalid CAP severity';
    END IF;
    IF p_eta_minutes IS NOT NULL AND p_eta_minutes NOT BETWEEN 0 AND 1440 THEN
        RAISE EXCEPTION 'Lead time must be between 0 and 1440 minutes';
    END IF;

    UPDATE public.cap_alerts
       SET status = 'UNDER_REVIEW',
           headline_en = coalesce(trim(p_headline_en), headline_en),
           description_en = coalesce(p_description_en, description_en),
           severity = coalesce(p_severity, severity),
           location_label = coalesce(nullif(trim(p_location_label), ''), location_label),
           eta_minutes = coalesce(p_eta_minutes, eta_minutes),
           updated_at = now()
     WHERE id = p_alert_id
     RETURNING * INTO review_alert;

    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (auth.uid(), 'BEGIN_REVIEW', 'cap_alerts', p_alert_id, to_jsonb(old_alert), to_jsonb(review_alert));
    RETURN review_alert;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_cap_alert(p_alert_id uuid)
RETURNS public.cap_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    old_alert public.cap_alerts;
    approved_alert public.cap_alerts;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_duty_officer_or_admin() THEN
        RAISE EXCEPTION 'Authenticated Duty Officer or Admin role required';
    END IF;
    SELECT * INTO old_alert FROM public.cap_alerts WHERE id = p_alert_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Alert not found'; END IF;
    IF old_alert.status <> 'UNDER_REVIEW' THEN RAISE EXCEPTION 'Only UNDER_REVIEW alerts can be approved'; END IF;

    UPDATE public.cap_alerts
       SET status = 'APPROVED', approved_by = auth.uid(), approved_at = now(), updated_at = now()
     WHERE id = p_alert_id
     RETURNING * INTO approved_alert;

    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (auth.uid(), 'APPROVE_AND_BROADCAST', 'cap_alerts', p_alert_id, to_jsonb(old_alert), to_jsonb(approved_alert));
    RETURN approved_alert;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_cap_alert(p_alert_id uuid, p_rationale text)
RETURNS public.cap_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    old_alert public.cap_alerts;
    rejected_alert public.cap_alerts;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_duty_officer_or_admin() THEN
        RAISE EXCEPTION 'Authenticated Duty Officer or Admin role required';
    END IF;
    IF length(trim(coalesce(p_rationale, ''))) < 15 THEN
        RAISE EXCEPTION 'Rejection rationale must contain at least 15 characters';
    END IF;
    SELECT * INTO old_alert FROM public.cap_alerts WHERE id = p_alert_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Alert not found'; END IF;
    IF old_alert.status <> 'UNDER_REVIEW' THEN RAISE EXCEPTION 'Only UNDER_REVIEW alerts can be rejected'; END IF;

    UPDATE public.cap_alerts
       SET status = 'REJECTED', rejection_reason = trim(p_rationale), updated_at = now()
     WHERE id = p_alert_id
     RETURNING * INTO rejected_alert;

    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, rationale, old_values, new_values)
    VALUES (auth.uid(), 'REJECT', 'cap_alerts', p_alert_id, trim(p_rationale), to_jsonb(old_alert), to_jsonb(rejected_alert));
    RETURN rejected_alert;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_cap_alert(p_alert_id uuid, p_rationale text)
RETURNS public.cap_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    old_alert public.cap_alerts;
    cancelled_alert public.cap_alerts;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_duty_officer_or_admin() THEN
        RAISE EXCEPTION 'Authenticated Duty Officer or Admin role required';
    END IF;
    IF length(trim(coalesce(p_rationale, ''))) < 15 THEN
        RAISE EXCEPTION 'Cancellation rationale must contain at least 15 characters';
    END IF;
    SELECT * INTO old_alert FROM public.cap_alerts WHERE id = p_alert_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Alert not found'; END IF;
    IF old_alert.status NOT IN ('UNDER_REVIEW', 'APPROVED') THEN
        RAISE EXCEPTION 'Only UNDER_REVIEW or APPROVED alerts can be cancelled';
    END IF;

    UPDATE public.cap_alerts
       SET status = 'CANCELLED', rejection_reason = trim(p_rationale), updated_at = now()
     WHERE id = p_alert_id
     RETURNING * INTO cancelled_alert;

    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, rationale, old_values, new_values)
    VALUES (auth.uid(), 'CANCEL', 'cap_alerts', p_alert_id, trim(p_rationale), to_jsonb(old_alert), to_jsonb(cancelled_alert));
    RETURN cancelled_alert;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_cap_alert_review(uuid, text, text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_cap_alert(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_cap_alert(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_cap_alert(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_cap_alert_review(uuid, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_cap_alert(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_cap_alert(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_cap_alert(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.get_active_alerts_within_radius(float, float, float);
CREATE FUNCTION public.get_active_alerts_within_radius(
    user_lat float,
    user_lon float,
    radius_km float DEFAULT 25.0
)
RETURNS TABLE (
    alert_id uuid,
    identifier text,
    event_type text,
    severity text,
    urgency text,
    certainty text,
    headline_en text,
    headline_hi text,
    description_en text,
    affected_zone_geojson jsonb,
    status text,
    distance_km numeric,
    is_direct_intersection boolean,
    eta_minutes integer,
    created_at timestamptz,
    cell_speed_kmh numeric,
    cell_bearing_deg numeric,
    cell_centroid_geojson jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    user_point geometry(Point, 4326);
    user_geography geography;
BEGIN
    IF user_lat IS NULL OR user_lon IS NULL OR user_lat NOT BETWEEN -90 AND 90 OR user_lon NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'Invalid WGS84 coordinates';
    END IF;
    IF radius_km IS NULL OR radius_km <= 0 OR radius_km > 500 THEN
        RAISE EXCEPTION 'radius_km must be between 0 and 500';
    END IF;

    user_point := ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326);
    user_geography := user_point::geography;

    RETURN QUERY
    SELECT a.id, a.identifier, a.event_type, a.severity, a.urgency, a.certainty,
           a.headline_en, a.headline_hi, a.description_en,
           ST_AsGeoJSON(a.affected_zone)::jsonb, a.status,
           round((ST_Distance(a.affected_zone::geography, user_geography) / 1000.0)::numeric, 2),
           ST_Intersects(a.affected_zone, user_point),
           CASE
             WHEN ST_Intersects(a.affected_zone, user_point) THEN 0
             WHEN cell.speed_kmh > 0 AND cell.bearing_deg IS NOT NULL AND cell.centroid IS NOT NULL
                  AND cos(radians(degrees(ST_Azimuth(cell.centroid::geography, user_geography)) - cell.bearing_deg)) > 0
             THEN ceil(
                 ST_Distance(cell.centroid::geography, user_geography) / 1000.0
                 / (cell.speed_kmh * cos(radians(degrees(ST_Azimuth(cell.centroid::geography, user_geography)) - cell.bearing_deg)))
                 * 60.0
             )::integer
             WHEN cell.speed_kmh IS NULL OR cell.bearing_deg IS NULL THEN a.eta_minutes
             ELSE NULL
           END,
           a.created_at,
           cell.speed_kmh,
           cell.bearing_deg,
           CASE WHEN cell.centroid IS NULL THEN NULL ELSE ST_AsGeoJSON(cell.centroid)::jsonb END
    FROM public.cap_alerts AS a
    LEFT JOIN LATERAL (
        SELECT coalesce(c.centroid, ST_PointOnSurface(c.track_polygon)) AS centroid,
               c.speed_kmh,
               coalesce(c.bearing_deg, c.velocity_vector_deg) AS bearing_deg
        FROM public.convective_cells AS c
        WHERE c.cell_uid = a.cell_uid AND c.active = true
        LIMIT 1
    ) AS cell ON true
    WHERE a.status = 'APPROVED'
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND ST_DWithin(a.affected_zone::geography, user_geography, radius_km * 1000.0)
    ORDER BY ST_Intersects(a.affected_zone, user_point) DESC,
             ST_Distance(a.affected_zone::geography, user_geography) ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_alerts_within_radius(float, float, float) TO anon, authenticated;

ALTER TABLE public.cap_alerts REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cap_alerts'
       ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cap_alerts';
    END IF;
END;
$$;