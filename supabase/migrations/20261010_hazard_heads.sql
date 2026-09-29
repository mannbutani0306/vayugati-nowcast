-- Additive hazard-head storage. Existing rows and consumers remain valid.
alter table public.convective_cells
  add column if not exists hail_probability double precision,
  add column if not exists downburst_gust_kmh double precision,
  add column if not exists cloudburst_mm_hr double precision,
  add column if not exists cloudburst_sustained_fraction double precision,
  add column if not exists lightning_density double precision,
  add column if not exists data_mode text,
  add column if not exists source_kind text,
  add column if not exists observation_status text,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists feed_timestamp_utc timestamptz,
  add column if not exists staleness_seconds numeric(10, 2),
  add column if not exists requires_authorized_feed boolean,
  add column if not exists quality_flags jsonb;

UPDATE public.convective_cells
SET data_mode = coalesce(data_mode, 'SCENARIO'),
    source_kind = coalesce(source_kind, 'SCENARIO'),
    observation_status = coalesce(observation_status, 'NOT_AVAILABLE'),
    requires_authorized_feed = coalesce(requires_authorized_feed, false),
    quality_flags = coalesce(quality_flags, '[]'::jsonb)
WHERE data_mode IS NULL OR source_kind IS NULL OR observation_status IS NULL OR requires_authorized_feed IS NULL OR quality_flags IS NULL;
