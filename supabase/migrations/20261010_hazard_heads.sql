-- Additive hazard-head storage. Existing rows and consumers remain valid.
alter table public.convective_cells
  add column if not exists hail_probability double precision,
  add column if not exists downburst_gust_kmh double precision,
  add column if not exists cloudburst_mm_hr double precision,
  add column if not exists cloudburst_sustained_fraction double precision,
  add column if not exists lightning_density double precision;
