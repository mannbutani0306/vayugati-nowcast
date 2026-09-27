<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# VayuGati Nowcast

## Technology Stack

- Frontend: React, Vite, and Supabase client libraries.
- Backend: FastAPI with PostGIS-backed spatial queries and weather-feed adapters.
- Convective severity model: Gradient Boosting Classifier (scikit-learn), trained by `backend/ml/train_model.py` and serialized with joblib.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Supabase Deployment

The officer and citizen portals rely on the database functions defined in `supabase/migrations`. If the citizen portal reports a missing alert RPC, run `20260929_restore_citizen_alert_rpc.sql` in the same Supabase project's SQL Editor. It restores the callable RPC and reloads the PostgREST schema cache. Confirm that `20260926_schema.sql` and `20260927_cap_alert_lifecycle.sql` have already been applied; do not rerun the base schema migration if it has.

## Optional Observation Feeds

The FastAPI service exposes `/api/v1/ingestion/satellite`, `/api/v1/ingestion/radar`, and `/api/v1/ingestion/lightning`. Public IMD satellite imagery and station radar images are not automatically georeferenced map layers. Configure only products your deployment is authorized to access; missing configuration is reported as unavailable.

- `MOSDAC_TIR_GEOTIFF_URL`: calibrated, georeferenced TIR1 GeoTIFF for point-temperature sampling. `rasterio` must be installed in the backend environment.
- `MOSDAC_TIR_TILE_URL` and `MOSDAC_TIR_BOUNDS`: optional XYZ tile template and `south,west,north,east` bounds for a satellite map overlay.
- `IMD_RADAR_TILE_URL` and `IMD_RADAR_BOUNDS`: optional authorized radar XYZ/TMS template or WMS endpoint and bounds for the Leaflet overlay. Set `IMD_RADAR_WMS_LAYER` when the URL is WMS.
- `BLITZORTUNG_PROXY_URL`: authorized proxy URL returning a GeoJSON `FeatureCollection` of `Point` strikes. Direct public Blitzortung pages do not provide a documented anonymous GeoJSON API.

Copy these optional names from `.env.example` into the backend service environment. Never use an unreferenced image as a map overlay or report an unavailable observation as live.
