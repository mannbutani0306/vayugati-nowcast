-- Operational PostGIS source of truth for cells, regions, CAP alerts, and review audit.
CREATE EXTENSION IF NOT EXISTS postgis;
SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL DEFAULT '',
    full_name text NOT NULL DEFAULT '',
    role text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'officer', 'admin', 'Duty_Officer', 'Admin')),
    badge_id text,
    jurisdiction text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.weather_stations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    station_code text NOT NULL UNIQUE,
    name text NOT NULL,
    state text NOT NULL,
    district text NOT NULL,
    location geometry(Point, 4326) NOT NULL,
    elevation_m numeric(7, 2),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_weather_stations_coords CHECK (
        ST_X(location) BETWEEN 68.0 AND 98.0
        AND ST_Y(location) BETWEEN 6.0 AND 38.0
    )
);

CREATE TABLE IF NOT EXISTS public.regions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    state text,
    district text,
    boundary geometry(Polygon, 4326) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.regions
    ADD COLUMN IF NOT EXISTS boundary geometry(Polygon, 4326);

CREATE TABLE IF NOT EXISTS public.convective_cells (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_uid text NOT NULL UNIQUE,
    name text,
    state text,
    district text,
    reflectivity_dbz numeric(4, 1) NOT NULL CHECK (reflectivity_dbz BETWEEN 0 AND 80),
    cloud_top_temp_c numeric(4, 1),
    lightning_rate_per_min integer NOT NULL DEFAULT 0 CHECK (lightning_rate_per_min >= 0),
    cape_value numeric(7, 1),
    velocity_vector_deg numeric(5, 1),
    bearing_deg numeric(5, 1),
    speed_kmh numeric(5, 1),
    centroid geometry(Point, 4326),
    track_polygon geometry(Polygon, 4326) NOT NULL,
    risk_level text NOT NULL CHECK (risk_level IN ('INFO', 'WATCH', 'WARNING', 'SEVERE')),
    active boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Upgrade installations that already ran the earlier pilot migration.
ALTER TABLE public.convective_cells
    ADD COLUMN IF NOT EXISTS name text,
    ADD COLUMN IF NOT EXISTS state text,
    ADD COLUMN IF NOT EXISTS district text,
    ADD COLUMN IF NOT EXISTS centroid geometry(Point, 4326),
    ADD COLUMN IF NOT EXISTS bearing_deg numeric(5, 1),
    ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.cap_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier text NOT NULL UNIQUE,
    sender text NOT NULL,
    event_type text NOT NULL,
    urgency text NOT NULL CHECK (urgency IN ('Immediate', 'Expected', 'Future', 'Past', 'Unknown')),
    severity text NOT NULL CHECK (severity IN ('Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown')),
    certainty text NOT NULL CHECK (certainty IN ('Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown')),
    headline_en text NOT NULL,
    headline_hi text,
    description_en text NOT NULL DEFAULT '',
    affected_zone geometry(Polygon, 4326) NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED', 'CANCELLED')),
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamptz,
    rejection_reason text,
    cell_uid text,
    location_label text,
    risk_score numeric(5, 4),
    eta_minutes integer,
    max_dbz numeric(4, 1),
    rain_rate_mm_hr numeric(7, 1),
    wind_gust_kmh numeric(6, 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz
);

ALTER TABLE public.cap_alerts
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS rejection_reason text,
    ADD COLUMN IF NOT EXISTS cell_uid text,
    ADD COLUMN IF NOT EXISTS location_label text,
    ADD COLUMN IF NOT EXISTS risk_score numeric(5, 4),
    ADD COLUMN IF NOT EXISTS eta_minutes integer,
    ADD COLUMN IF NOT EXISTS max_dbz numeric(4, 1),
    ADD COLUMN IF NOT EXISTS rain_rate_mm_hr numeric(7, 1),
    ADD COLUMN IF NOT EXISTS wind_gust_kmh numeric(6, 1);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid NOT NULL REFERENCES auth.users(id),
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    rationale text,
    old_values jsonb,
    new_values jsonb,
    location geometry(Point, 4326),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.audit_cap_alert_draft_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, new_values)
        VALUES (auth.uid(), 'CREATE_DRAFT', 'cap_alerts', NEW.id, to_jsonb(NEW));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cap_alerts_audit_draft_insert ON public.cap_alerts;
CREATE TRIGGER cap_alerts_audit_draft_insert
AFTER INSERT ON public.cap_alerts
FOR EACH ROW
WHEN (NEW.status = 'DRAFT')
EXECUTE FUNCTION public.audit_cap_alert_draft_insert();

CREATE INDEX IF NOT EXISTS idx_regions_boundary_gist ON public.regions USING gist (boundary);
CREATE INDEX IF NOT EXISTS idx_weather_stations_location_gist ON public.weather_stations USING gist (location);
CREATE INDEX IF NOT EXISTS idx_cells_track_gist ON public.convective_cells USING gist (track_polygon);
CREATE INDEX IF NOT EXISTS idx_cells_centroid_gist ON public.convective_cells USING gist (centroid);
CREATE INDEX IF NOT EXISTS idx_cells_active_updated ON public.convective_cells (active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_zone_gist ON public.cap_alerts USING gist (affected_zone);
CREATE INDEX IF NOT EXISTS idx_alerts_status_created ON public.cap_alerts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created ON public.audit_logs (entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.current_operational_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT lower(coalesce(
        auth.jwt() -> 'app_metadata' ->> 'role',
        (SELECT u.role FROM public.users AS u WHERE u.id = auth.uid()),
        'citizen'
    ));
$$;

CREATE OR REPLACE FUNCTION public.is_duty_officer_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT public.current_operational_role() IN ('officer', 'duty_officer', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT public.current_operational_role() = 'admin';
$$;

-- Citizen proximity query; retains the existing RPC result signature for deployments
-- that already created it, while using the requested WGS84 geography distance.
DROP FUNCTION IF EXISTS public.get_active_alerts_within_radius(float, float, float) CASCADE;
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
    created_at timestamptz
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
    user_geography := ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography;

    RETURN QUERY
    SELECT a.id, a.identifier, a.event_type, a.severity, a.urgency, a.certainty,
           a.headline_en, a.headline_hi, a.description_en,
           ST_AsGeoJSON(a.affected_zone)::jsonb, a.status,
           round((ST_Distance(a.affected_zone::geography, user_geography) / 1000.0)::numeric, 2),
           ST_Intersects(a.affected_zone, user_point), a.eta_minutes, a.created_at
    FROM public.cap_alerts AS a
    WHERE a.status = 'APPROVED'
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND ST_DWithin(
          a.affected_zone::geography,
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
          radius_km * 1000.0
      )
    ORDER BY ST_Intersects(a.affected_zone, user_point) DESC,
             ST_Distance(a.affected_zone::geography, user_geography) ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_alerts_for_location(
    user_lat float,
    user_lon float,
    radius_km float DEFAULT 25.0
)
RETURNS TABLE (
    id uuid,
    identifier text,
    event_type text,
    severity text,
    urgency text,
    headline_en text,
    headline_hi text,
    description_en text,
    distance_km numeric,
    is_direct_hit boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT alert.alert_id, alert.identifier, alert.event_type, alert.severity,
           alert.urgency, alert.headline_en, alert.headline_hi, alert.description_en,
           alert.distance_km, alert.is_direct_intersection, alert.created_at
    FROM public.get_active_alerts_within_radius(user_lat, user_lon, radius_km) AS alert;
$$;

CREATE OR REPLACE FUNCTION public.get_active_convective_cells()
RETURNS TABLE (
    database_id uuid,
    cell_uid text,
    name text,
    state text,
    district text,
    reflectivity_dbz numeric,
    cloud_top_temp_c numeric,
    lightning_rate_per_min integer,
    cape_value numeric,
    bearing_deg numeric,
    speed_kmh numeric,
    centroid_geojson jsonb,
    track_geojson jsonb,
    risk_level text,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT c.id, c.cell_uid, c.name, c.state, c.district, c.reflectivity_dbz,
           c.cloud_top_temp_c, c.lightning_rate_per_min, c.cape_value,
           coalesce(c.bearing_deg, c.velocity_vector_deg), c.speed_kmh,
           ST_AsGeoJSON(coalesce(c.centroid, ST_PointOnSurface(c.track_polygon)))::jsonb,
           ST_AsGeoJSON(c.track_polygon)::jsonb, c.risk_level, c.updated_at
    FROM public.convective_cells AS c
    WHERE c.active = true
    ORDER BY c.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_officer_cap_alerts()
RETURNS TABLE (
    id uuid,
    identifier text,
    event_type text,
    urgency text,
    severity text,
    certainty text,
    headline_en text,
    headline_hi text,
    description_en text,
    affected_zone_geojson jsonb,
    status text,
    approved_by uuid,
    approved_at timestamptz,
    rejection_reason text,
    cell_uid text,
    location_label text,
    risk_score numeric,
    eta_minutes integer,
    max_dbz numeric,
    rain_rate_mm_hr numeric,
    wind_gust_kmh numeric,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT a.id, a.identifier, a.event_type, a.urgency, a.severity, a.certainty,
           a.headline_en, a.headline_hi, a.description_en,
           ST_AsGeoJSON(a.affected_zone)::jsonb, a.status, a.approved_by,
           a.approved_at, a.rejection_reason, a.cell_uid, a.location_label,
           a.risk_score, a.eta_minutes, a.max_dbz, a.rain_rate_mm_hr,
           a.wind_gust_kmh, a.created_at, a.updated_at
    FROM public.cap_alerts AS a
    WHERE public.is_duty_officer_or_admin()
    ORDER BY a.created_at DESC;
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
    IF NOT public.is_duty_officer_or_admin() THEN
        RAISE EXCEPTION 'Duty Officer or Admin role required';
    END IF;
    SELECT * INTO old_alert FROM public.cap_alerts WHERE id = p_alert_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Alert not found'; END IF;
    IF old_alert.status <> 'DRAFT' THEN RAISE EXCEPTION 'Only DRAFT alerts can be approved'; END IF;

    UPDATE public.cap_alerts
       SET status = 'APPROVED', approved_by = auth.uid(), approved_at = now(), updated_at = now()
     WHERE id = p_alert_id
     RETURNING * INTO approved_alert;

    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (auth.uid(), 'APPROVE', 'cap_alerts', p_alert_id, to_jsonb(old_alert), to_jsonb(approved_alert));
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
    IF NOT public.is_duty_officer_or_admin() THEN
        RAISE EXCEPTION 'Duty Officer or Admin role required';
    END IF;
    IF length(trim(coalesce(p_rationale, ''))) < 15 THEN
        RAISE EXCEPTION 'Rejection rationale must contain at least 15 characters';
    END IF;
    SELECT * INTO old_alert FROM public.cap_alerts WHERE id = p_alert_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Alert not found'; END IF;
    IF old_alert.status <> 'DRAFT' THEN RAISE EXCEPTION 'Only DRAFT alerts can be rejected'; END IF;

    UPDATE public.cap_alerts
       SET status = 'REJECTED', rejection_reason = trim(p_rationale), updated_at = now()
     WHERE id = p_alert_id
     RETURNING * INTO rejected_alert;

    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, rationale, old_values, new_values)
    VALUES (auth.uid(), 'REJECT', 'cap_alerts', p_alert_id, trim(p_rationale), to_jsonb(old_alert), to_jsonb(rejected_alert));
    RETURN rejected_alert;
END;
$$;

-- All data access is governed by RLS; remove the earlier broad authenticated FOR ALL policy.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convective_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Duty forecaster alert management" ON public.cap_alerts;
DROP POLICY IF EXISTS "Public read access for approved CAP alerts" ON public.cap_alerts;
DROP POLICY IF EXISTS "Duty forecaster alert management" ON public.convective_cells;
DROP POLICY IF EXISTS "Public read access for convective cells" ON public.convective_cells;
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_insert_self_citizen ON public.users;
DROP POLICY IF EXISTS users_update_self_citizen ON public.users;
DROP POLICY IF EXISTS regions_public_read ON public.regions;
DROP POLICY IF EXISTS regions_admin_manage ON public.regions;
DROP POLICY IF EXISTS weather_stations_public_read ON public.weather_stations;
DROP POLICY IF EXISTS cells_public_read ON public.convective_cells;
DROP POLICY IF EXISTS cells_officer_insert ON public.convective_cells;
DROP POLICY IF EXISTS cells_officer_update ON public.convective_cells;
DROP POLICY IF EXISTS cells_admin_delete ON public.convective_cells;
DROP POLICY IF EXISTS alerts_public_approved_read ON public.cap_alerts;
DROP POLICY IF EXISTS alerts_officer_read ON public.cap_alerts;
DROP POLICY IF EXISTS alerts_officer_insert_draft ON public.cap_alerts;
DROP POLICY IF EXISTS alerts_officer_update ON public.cap_alerts;
DROP POLICY IF EXISTS audit_officer_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_admin_read ON public.audit_logs;

CREATE POLICY users_select_own ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY users_insert_self_citizen ON public.users FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid() AND lower(role) = 'citizen');
CREATE POLICY users_update_self_citizen ON public.users FOR UPDATE TO authenticated
    USING (id = auth.uid() AND lower(role) = 'citizen')
    WITH CHECK (id = auth.uid() AND lower(role) = 'citizen');

CREATE POLICY regions_public_read ON public.regions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY regions_admin_manage ON public.regions FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY weather_stations_public_read ON public.weather_stations FOR SELECT TO anon, authenticated
    USING (is_active = true);

CREATE POLICY cells_public_read ON public.convective_cells FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY cells_officer_insert ON public.convective_cells FOR INSERT TO authenticated
    WITH CHECK (public.is_duty_officer_or_admin());
CREATE POLICY cells_officer_update ON public.convective_cells FOR UPDATE TO authenticated
    USING (public.is_duty_officer_or_admin()) WITH CHECK (public.is_duty_officer_or_admin());
CREATE POLICY cells_admin_delete ON public.convective_cells FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY alerts_public_approved_read ON public.cap_alerts FOR SELECT TO anon, authenticated
    USING (status = 'APPROVED' AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY alerts_officer_read ON public.cap_alerts FOR SELECT TO authenticated
    USING (public.is_duty_officer_or_admin());
CREATE POLICY alerts_officer_insert_draft ON public.cap_alerts FOR INSERT TO authenticated
    WITH CHECK (public.is_duty_officer_or_admin() AND status = 'DRAFT');
CREATE POLICY audit_officer_insert ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (public.is_duty_officer_or_admin() AND actor_id = auth.uid());
CREATE POLICY audit_admin_read ON public.audit_logs FOR SELECT TO authenticated
    USING (public.is_admin());

GRANT SELECT ON public.weather_stations, public.regions, public.convective_cells, public.cap_alerts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.convective_cells TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cap_alerts FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.cap_alerts TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_alerts_within_radius(float, float, float) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_convective_cells() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_operational_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_duty_officer_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.get_officer_cap_alerts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_cap_alert(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_cap_alert(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_operational_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_duty_officer_or_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_officer_cap_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_cap_alert(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_cap_alert(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_operational_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_duty_officer_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_cap_alert_draft_insert() TO authenticated;

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

-- Retire the exact pilot records inserted by the earlier prototype migration.
DELETE FROM public.cap_alerts WHERE identifier = 'IN-IMD-NOWCAST-20260926-001';
DELETE FROM public.convective_cells WHERE cell_uid = 'CELL-A1';

INSERT INTO public.weather_stations (station_code, name, state, district, location, elevation_m)
VALUES
    ('DWR-DED', 'Dehradun C-Band Doppler Radar', 'Uttarakhand', 'Dehradun', ST_SetSRID(ST_MakePoint(78.0322, 30.3165), 4326), 640.0),
    ('AWS-SHD', 'Sahastradhara Hydro-Met Station', 'Uttarakhand', 'Dehradun', ST_SetSRID(ST_MakePoint(78.1316, 30.3872), 4326), 790.0),
    ('AWS-HRD', 'Haridwar Roorkee Canal Observatory', 'Uttarakhand', 'Haridwar', ST_SetSRID(ST_MakePoint(78.1642, 29.9457), 4326), 285.0),
    ('DWR-PUN', 'Pune S-Band Doppler Radar (IMD Pashan)', 'Maharashtra', 'Pune', ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326), 560.0),
    ('AWS-LNV', 'Lonavala Ghat High-Altitude Station', 'Maharashtra', 'Pune', ST_SetSRID(ST_MakePoint(73.4062, 18.7546), 4326), 624.0)
ON CONFLICT (station_code) DO NOTHING;
