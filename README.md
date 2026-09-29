# VayuGati Nowcast

VayuGati Nowcast is a real-data weather intelligence dashboard for monitoring convective weather risk in the Himalayas and surrounding foothill regions. The project combines open forecast guidance, archived satellite precipitation, local Earth-observation products, and documented disaster case studies into a single operational-style interface for citizen, officer, and admin review.

The system is designed to support rapid situational awareness over a 0–6 hour window, with a clear difference between actual observation archives, local weather guidance, and review/demo workflows. It is intended for prototype and research use, not as an official warning service.

## Core capabilities

- Live local weather panels powered by Open-Meteo feed data
- Historical precipitation replay using real IMERG case archives
- Local MOSDAC-style INSAT scene preview and geospatial overlay support
- Officer dashboard with map layers, warning polygons, and live cell analysis
- Admin and citizen portals for review workflows and alert presentation
- Real-data verification around documented Leh cloudburst episodes and archive inventory checks

## Data sources used

This project uses actual observational and archival data where available, including:

- NASA GPM IMERG half-hourly precipitation product in HDF5 format
- MOSDAC / INSAT scene files in TIF and related geospatial formats
- Open-Meteo NWP weather guidance for current atmospheric context
- Leh 2010 and 2011 case material from published meteorological records and archival event analysis

The project is structured to clearly indicate when a feed is live, archived, or awaiting required local data.

## Local setup

Install the frontend and backend dependencies once:

```bash
npm install
python -m pip install -r backend/requirements.txt
```

Start the complete local application with one command:

```bash
npm run dev
```

In Windows PowerShell, use `npm.cmd install` and `npm.cmd run dev` if the script execution policy blocks the `npm` command.

The startup script starts the FastAPI backend, waits for its health endpoint, and then starts Vite. Keep the terminal open while using the app; press `Ctrl+C` to stop both services. The frontend is at http://localhost:3000 and the API is at http://localhost:8000.

### Docker

```bash
docker compose up --build
```

Compose waits for the backend health check before starting the frontend.

### Vercel deployment

Vercel serves this repository's frontend only; it cannot start the Python API on a visitor's computer. Deploy the backend separately and set `VITE_NOWCAST_API_URL` in the Vercel project to that backend's public API base URL, ending in `/api/v1`, then redeploy. The default `localhost:8000` URL is for local development only.

## Project layout

```text
vayugati-nowcast-main/
├── backend/               # Python ingestion, hazard logic, verification, API
├── data/                  # Local weather archives and case-based data
├── public/                # Static app assets
├── scripts/               # Utility and verification scripts
├── src/                   # React dashboard and portal UI
├── supabase/              # Database SQL migrations and schema setup
├── tests/                 # Automated validation for core functions
├── verification/          # Archive verification metrics and reports
├── docker-compose.yml     # Local orchestration config
├── package.json           # Frontend dependencies and scripts
├── vite.config.ts         # Vite app configuration
├── README.md              # Project overview and setup
└── LICENSE                # Project license
```

## Real-data workflow

1. Ingest local archive data from the configured data folders.
2. Map the selected case or scene to the frontend replay view.
3. Run the hazard, anomaly, and convective-risk checks against the real support data.
4. Use the officer dashboard to inspect geospatial outputs and review alert-ready results.
5. Validate local archive quality and coverage before presenting evidence in the public or admin flows.

## Operational notes

- This is not an official IMD, NDMA, or state disaster management warning service.
- Archived datasets are treated as research and review inputs, not live operational advisories.
- Local data availability matters: if required files are absent, the UI clearly shows the missing-data state rather than pretending the feed is present.

## Example real-case focus

The project includes a documented Leh incident storyline and archive-based checks to trace how intense convective rainfall and hazard thresholds behave in a real mountainous context. The interface is built to show both the data provenance and the limitations of the historical evidence so that reviewers can interpret the output responsibly.

## Verification

The app includes backend verification and archive validation scripts to check local data readiness, inventory health, and nowcast performance against historical cases. The verification results are intended to support evidence-based review and not to replace formal weather service operations.

## License

This project is distributed under the terms in the repository license file.
