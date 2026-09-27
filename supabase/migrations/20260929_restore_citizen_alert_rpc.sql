DROP FUNCTION IF EXISTS public.get_alerts_for_location(float, float, float);
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
    headline_mr text,
    description_en text,
    description_hi text,
    description_mr text,
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
           a.headline_en, a.headline_hi, a.headline_mr,
           a.description_en, a.description_hi, a.description_mr,
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

GRANT EXECUTE ON FUNCTION public.get_active_alerts_within_radius(float, float, float) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';