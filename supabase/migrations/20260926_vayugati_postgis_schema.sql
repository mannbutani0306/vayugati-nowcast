-- ============================================================================
-- VayuGati Nowcast (SIH26084) - Production PostGIS Migration Script
-- Target Platform: Supabase (PostgreSQL 15+ / PostGIS 3+)
-- Convective-Scale Nowcasting for Thunderstorms, Hail & Cloudbursts (0–6 Hours)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & SPATIAL ENVIRONMENT SETUP
-- ----------------------------------------------------------------------------
-- PostGIS provides spatial geometry types (Point, Polygon, MultiPolygon)
-- and spherical geography operators (ST_DWithin, ST_Intersects, ST_Distance).
CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA extensions;

-- Ensure public schema has access to PostGIS geometry type signatures
SET search_path TO public, extensions;

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.weather_stations
-- Automated Weather Stations (AWS) and Doppler Weather Radar (DWR) surface networks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weather_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    -- WGS 84 (SRID 4326) Geographic coordinate: Point(lon lat)
    location GEOMETRY(Point, 4326) NOT NULL,
    elevation_m NUMERIC(7, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Constraint: Ensure valid latitude and longitude coordinate envelope
ALTER TABLE public.weather_stations
    DROP CONSTRAINT IF EXISTS chk_weather_stations_coords;

ALTER TABLE public.weather_stations
    ADD CONSTRAINT chk_weather_stations_coords
    CHECK (
        ST_X(location) BETWEEN 68.0 AND 98.0 AND -- India Longitude bounds
        ST_Y(location) BETWEEN 6.0 AND 38.0      -- India Latitude bounds
    );

-- ----------------------------------------------------------------------------
-- 3. TABLE: public.convective_cells
-- Real-time segmented storm cell telemetry synthesized from Dual-Pol Doppler
-- radar and INSAT-3DR Rapid-Scan infrared observations (1–3 km spatial mesh).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.convective_cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_uid TEXT NOT NULL UNIQUE,
    reflectivity_dbz NUMERIC(4, 1) NOT NULL CHECK (reflectivity_dbz BETWEEN 0.0 AND 80.0),
    cloud_top_temp_c NUMERIC(4, 1) CHECK (cloud_top_temp_c BETWEEN -95.0 AND 35.0),
    lightning_rate_per_min INT DEFAULT 0 CHECK (lightning_rate_per_min >= 0),
    cape_value NUMERIC(6, 1) CHECK (cape_value >= 0.0), -- J/kg
    velocity_vector_deg NUMERIC(5, 1) CHECK (velocity_vector_deg BETWEEN 0.0 AND 360.0), -- Heading from North
    speed_kmh NUMERIC(5, 1) CHECK (speed_kmh >= 0.0),
    -- Track polygon: Current convective core envelope and optical-flow advection cone
    track_polygon GEOMETRY(Polygon, 4326) NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('INFO', 'WATCH', 'WARNING', 'SEVERE')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. TABLE: public.cap_alerts
-- Standardized ITU / NDMA Common Alerting Protocol (CAP v1.2) Alert Feed.
-- Strict Human-in-the-Loop Safeguard: AI alerts start as 'DRAFT' and require
-- Duty Forecaster verification before publication to public siren channels.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cap_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL UNIQUE, -- e.g. "IN-IMD-NOWCAST-20260926-001"
    sender TEXT NOT NULL DEFAULT 'dutyforecaster.nowcast@imd.gov.in',
    event_type TEXT NOT NULL,       -- 'CLOUDBURST', 'HAIL', 'THUNDERSTORM', 'DOWNBURST'
    urgency TEXT NOT NULL CHECK (urgency IN ('Immediate', 'Expected', 'Future', 'Past', 'Unknown')),
    severity TEXT NOT NULL CHECK (severity IN ('Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown')),
    certainty TEXT NOT NULL CHECK (certainty IN ('Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown')),
    headline_en TEXT NOT NULL,
    headline_hi TEXT,
    description_en TEXT NOT NULL,
    -- Affected disaster sector polygon (1–3 km target municipal/watershed envelope)
    affected_zone GEOMETRY(Polygon, 4326) NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED', 'CANCELLED')),
    approved_by UUID, -- References auth.users(id) in live Supabase instance
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 5. HIGH-PERFORMANCE SPATIAL (GiST) & B-TREE INDEXING
-- ----------------------------------------------------------------------------
-- GiST indexes (Generalized Search Tree) use R-Trees internally on bounding
-- box geometries (ST_BBox), transforming O(N) sequential full-table scans into
-- O(log N) bounding box tree traversals for millisecond-latency spatial queries.

CREATE INDEX IF NOT EXISTS idx_weather_stations_location_gist
    ON public.weather_stations USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_convective_cells_track_polygon_gist
    ON public.convective_cells USING GIST (track_polygon);

CREATE INDEX IF NOT EXISTS idx_cap_alerts_affected_zone_gist
    ON public.cap_alerts USING GIST (affected_zone);

-- Composite B-Tree indexes for fast status filtering & temporal sorting
CREATE INDEX IF NOT EXISTS idx_cap_alerts_status_created
    ON public.cap_alerts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_convective_cells_risk_updated
    ON public.convective_cells (risk_level, updated_at DESC);

-- ----------------------------------------------------------------------------
-- 6. POSTGIS STORED FUNCTIONS
-- ----------------------------------------------------------------------------

/**
 * FUNCTION: get_active_alerts_within_radius
 * Optimized spatial query finding all APPROVED alerts that:
 * 1. Directly encapsulate the citizen coordinate (ST_Intersects), OR
 * 2. Lie within the given geodesic radius (radius_km) using the spatial index (ST_DWithin).
 *
 * Casts geometry to geography for spherical Great-Circle metric calculations (WGS 84 ellipsoid).
 */
CREATE OR REPLACE FUNCTION public.get_active_alerts_within_radius(
    user_lat FLOAT,
    user_lon FLOAT,
    radius_km FLOAT DEFAULT 25.0
)
RETURNS TABLE (
    alert_id UUID,
    identifier TEXT,
    event_type TEXT,
    severity TEXT,
    urgency TEXT,
    certainty TEXT,
    headline_en TEXT,
    headline_hi TEXT,
    description_en TEXT,
    affected_zone_geojson JSONB,
    status TEXT,
    distance_km NUMERIC,
    is_direct_intersection BOOLEAN,
    eta_minutes INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    -- Longitude is X, Latitude is Y in PostGIS conventions
    user_geom GEOMETRY;
    user_geog GEOGRAPHY;
    radius_meters FLOAT;
BEGIN
    -- Validate coordinate arguments
    IF user_lat IS NULL OR user_lon IS NULL OR user_lat < -90 OR user_lat > 90 OR user_lon < -180 OR user_lon > 180 THEN
        RAISE EXCEPTION 'Invalid spatial coordinates: lat %, lon %', user_lat, user_lon;
    END IF;

    user_geom := ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326);
    user_geog := user_geom::geography;
    radius_meters := GREATEST(100.0, radius_km * 1000.0);

    RETURN QUERY
    SELECT
        a.id AS alert_id,
        a.identifier,
        a.event_type,
        a.severity,
        a.urgency,
        a.certainty,
        a.headline_en,
        a.headline_hi,
        a.description_en,
        ST_AsGeoJSON(a.affected_zone)::JSONB AS affected_zone_geojson,
        a.status,
        -- Calculate geodesic surface distance in kilometers
        ROUND((ST_Distance(a.affected_zone::geography, user_geog) / 1000.0)::NUMERIC, 2) AS distance_km,
        -- Direct intersection check (Point-In-Polygon)
        ST_Intersects(a.affected_zone, user_geom) AS is_direct_intersection,
        a.eta_minutes,
        a.created_at
    FROM public.cap_alerts a
    WHERE
        a.status = 'APPROVED'
        AND (
            -- ST_DWithin leverages the GiST index on affected_zone
            ST_DWithin(a.affected_zone::geography, user_geog, radius_meters)
            OR ST_Intersects(a.affected_zone, user_geom)
        )
    ORDER BY
        -- Prioritize direct hits, then extreme severities, then closest distance
        is_direct_intersection DESC,
        CASE a.severity
            WHEN 'Extreme' THEN 1
            WHEN 'Severe' THEN 2
            WHEN 'Moderate' THEN 3
            ELSE 4
        END ASC,
        distance_km ASC;
END;
$$;

/**
 * FUNCTION: get_alerts_for_location (Frontend Compatibility Wrapper)
 * Directly matches client calls from `src/lib/spatialQueries.js`.
 */
CREATE OR REPLACE FUNCTION public.get_alerts_for_location(
    user_lat FLOAT,
    user_lon FLOAT,
    radius_km FLOAT DEFAULT 25.0
)
RETURNS TABLE (
    id UUID,
    identifier TEXT,
    event_type TEXT,
    severity TEXT,
    urgency TEXT,
    headline_en TEXT,
    headline_hi TEXT,
    description_en TEXT,
    distance_km NUMERIC,
    is_direct_hit BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.alert_id AS id,
        r.identifier,
        r.event_type,
        r.severity,
        r.urgency,
        r.headline_en,
        r.headline_hi,
        r.description_en,
        r.distance_km,
        r.is_direct_intersection AS is_direct_hit,
        r.created_at
    FROM public.get_active_alerts_within_radius(user_lat, user_lon, radius_km) r;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.weather_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convective_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_alerts ENABLE ROW LEVEL SECURITY;

-- Anonymous and authenticated citizens can read stations and convective cells
CREATE POLICY "Public read access for weather stations"
    ON public.weather_stations FOR SELECT
    USING (true);

CREATE POLICY "Public read access for convective cells"
    ON public.convective_cells FOR SELECT
    USING (true);

-- Public can only view APPROVED CAP alerts (unreviewed DRAFTs remain restricted to forecasters)
CREATE POLICY "Public read access for approved CAP alerts"
    ON public.cap_alerts FOR SELECT
    USING (status = 'APPROVED');

-- ----------------------------------------------------------------------------
-- 8. SEED DATA (PILOT MONITORING DISTRICTS)
-- ----------------------------------------------------------------------------
-- Seed Weather Stations (Dehradun & Pune Radar Nodes)
INSERT INTO public.weather_stations (station_code, name, state, district, location, elevation_m)
VALUES
    ('DWR-DED', 'Dehradun C-Band Doppler Radar', 'Uttarakhand', 'Dehradun', ST_SetSRID(ST_MakePoint(78.0322, 30.3165), 4326), 640.0),
    ('AWS-SHD', 'Sahastradhara Hydro-Met Station', 'Uttarakhand', 'Dehradun', ST_SetSRID(ST_MakePoint(78.1316, 30.3872), 4326), 790.0),
    ('AWS-HRD', 'Haridwar Roorkee Canal Observatory', 'Uttarakhand', 'Haridwar', ST_SetSRID(ST_MakePoint(78.1642, 29.9457), 4326), 285.0),
    ('DWR-PUN', 'Pune S-Band Doppler Radar (IMD Pashan)', 'Maharashtra', 'Pune', ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326), 560.0),
    ('AWS-LNV', 'Lonavala Ghat High-Altitude Station', 'Maharashtra', 'Pune', ST_SetSRID(ST_MakePoint(73.4062, 18.7546), 4326), 624.0)
ON CONFLICT (station_code) DO NOTHING;

-- Radar/cell and alert observations are written by configured ingestion services;
-- migrations do not create operational alerts or synthetic convective cells.
