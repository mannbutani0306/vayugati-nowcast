CREATE OR REPLACE FUNCTION public.get_active_alerts_within_radius(
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
          user_geography,
          radius_km * 1000.0
      )
    ORDER BY ST_Intersects(a.affected_zone, user_point) DESC,
             ST_Distance(a.affected_zone::geography, user_geography) ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_alerts_within_radius(float, float, float) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';