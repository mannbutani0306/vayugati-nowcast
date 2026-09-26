<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b42b5422-6d65-4189-af7d-1b2534f121ef

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Optional Observation Feeds

The FastAPI service exposes `/api/v1/ingestion/satellite`, `/api/v1/ingestion/radar`, and `/api/v1/ingestion/lightning`. Public IMD satellite imagery and station radar images are not automatically georeferenced map layers. Configure only products your deployment is authorized to access; missing configuration is reported as unavailable.

- `MOSDAC_TIR_GEOTIFF_URL`: calibrated, georeferenced TIR1 GeoTIFF for point-temperature sampling. `rasterio` must be installed in the backend environment.
- `MOSDAC_TIR_TILE_URL` and `MOSDAC_TIR_BOUNDS`: optional XYZ tile template and `south,west,north,east` bounds for a satellite map overlay.
- `IMD_RADAR_TILE_URL` and `IMD_RADAR_BOUNDS`: optional authorized radar XYZ/TMS template or WMS endpoint and bounds for the Leaflet overlay. Set `IMD_RADAR_WMS_LAYER` when the URL is WMS.
- `BLITZORTUNG_PROXY_URL`: authorized proxy URL returning a GeoJSON `FeatureCollection` of `Point` strikes. Direct public Blitzortung pages do not provide a documented anonymous GeoJSON API.

Copy these optional names from `.env.example` into the backend service environment. Never use an unreferenced image as a map overlay or report an unavailable observation as live.
