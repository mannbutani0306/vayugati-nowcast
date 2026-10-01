<div align="center">

# VayuGati Nowcast — Convective Weather Intelligence for India

### Real-data precipitation analysis, six-hour scenario nowcasting, and hazard review

**Smart India Hackathon 2026 · Problem Statement SIH26084 · Ministry of Earth Sciences (MoES)**
*Convective Scale Nowcasting for Thunderstorms, Hail & Cloudbursts (0–6 hr)*
**Team TRIKAAL · Team ID 137710**

*VayuGati (वायुगति) — "wind speed"*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-vayugati--nowcast.vercel.app-0A66C2?style=for-the-badge&logo=vercel&logoColor=white)](https://vayugati-nowcast.vercel.app/)
[![Demo Video](https://img.shields.io/badge/Walkthrough-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/LyKIljgVgBU)

![SIH 2026](https://img.shields.io/badge/SIH-2026-FF9933?style=flat-square)
![Problem Statement](https://img.shields.io/badge/PS-SIH26084-138808?style=flat-square)
![Status](https://img.shields.io/badge/status-research%20prototype-orange?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.x-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-Leaflet-61DAFB?style=flat-square&logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

</div>

---

Every early warning for a thunderstorm, hailstorm, downburst or cloudburst depends on seeing a storm
before it arrives. In India that gap is real: NWP models resolve ~11–25 km while these storms act at
1–10 km over 15–180 minutes. VayuGati Nowcast is a research and decision-support prototype that
fuses live model guidance, locally archived satellite precipitation, optional radar/satellite imagery,
and hazard-analysis services into one role-based review workflow — with every field labelled by what
it actually is: archived observation, model guidance, configured feed, or scenario/demo data.

## Quick links

| | |
|---|---|
| 🌐 **Live demo** | [vayugati-nowcast.vercel.app](https://vayugati-nowcast.vercel.app/) |
| 🎬 **Prototype walkthrough** (video) | [youtu.be/LyKIljgVgBU](https://youtu.be/LyKIljgVgBU) |
| 📊 **Idea deck** (SIH format) | [SIH26084_TRIKAAL_VAYUGATI-NOWCAST_PPT.pdf](https://github.com/mannbutani0306/vayugati-nowcast/blob/main/deliverables/deck/SIH26084_TRIKAAL_VAYUGATI-NOWCAST_PPT.pdf) |
| 📘 **Project report** | [VAYUGATI_NOWCAST_SIH26084_Report.pdf](https://github.com/mannbutani0306/vayugati-nowcast/blob/main/deliverables/report/VAYUGATI_NOWCAST_SIH26084_Report.pdf) · [Google Drive mirror](https://drive.google.com/drive/folders/1LXmui8BvleWookqvVvavCsYsHd2yto1c?usp=sharing) |
| 🧪 **Verification report** | [`verification/VERIFICATION_REPORT.md`](verification/VERIFICATION_REPORT.md) |
| 🛰 **Real-data verification results** | [`verification/real_results.json`](verification/real_results.json) |
| 📚 **Primary case citation** | Bhan, Devrani & Sinha (2015), *MAUSAM* 66(1) — [article](https://mausamjournal.imd.gov.in/index.php/MAUSAM/article/view/371/290) |

> **Status: working research prototype.** The repository includes real archived GPM IMERG V07 files for Leh case studies and uses Open-Meteo for live model guidance when available. INSAT scenes and authorized IMD radar/lightning integrations are optional and may require local files, credentials, or feed configuration. Scenario/demo fields are labeled; this is not an official warning service.

## Table of contents

- [Results at a glance](#results-at-a-glance)
- [Unified architecture](#unified-architecture)
- [Quickstart](#quickstart)
- [Five-minute judge demo](#five-minute-judge-demo)
- [Data sources — India first](#data-sources--india-first)
- [Roadmap — the 8 phases](#roadmap--the-8-phases)
- [Verification headline](#verification-headline)
- [Honest caveats](#honest-caveats)
- [Repository map](#repository-map)
- [References](#references)
- [License](#license)

## Results at a glance

Measured, not claimed — every number below is reproducible from `verification/` and is reported even
where VayuGati ties or loses to the baseline, not just where it wins.

| Check | What it tests | VayuGati | Baseline (persistence) |
|---|---|---:|---:|
| **Real-data: Leh 2010 cloudburst**, 60 min, 1 mm/h (NASA GPM IMERG) | Satellite-archived precipitation, the actual 5 Aug 2010 Leh event | CSI **0.423** | CSI 0.424 (near-tie) |
| **Real-data: Leh 2011 control case**, 60 min, 1 mm/h (NASA GPM IMERG) | Same method, a day with no reported impact | CSI **0.443** | CSI 0.443 (tie) |
| **Synthetic: fast squall line**, 60 min | Deterministic motion reconstruction, 20 seeds | CSI **0.866** | CSI 0.018 |
| **Synthetic: orographic quasi-stationary**, 60 min | Slow terrain-locked storm, 20 seeds | CSI **0.905** | CSI 0.802 |

Full tables, thresholds and every lead time: [`verification/VERIFICATION_REPORT.md`](verification/VERIFICATION_REPORT.md) (synthetic) and [`verification/real_results.json`](verification/real_results.json) (real archived IMERG). The real-data checks are satellite-vs-satellite comparisons at ~10 km, not independent radar truth — see [Honest caveats](#honest-caveats) below.

## Unified architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                       VAYUGATI NOWCAST                             │
├────────────────────────────────┬───────────────────────────────────┤
│ Live model guidance            │ Real archived case data           │
│ Open-Meteo atmospheric context │ NASA GPM IMERG V07 half-hourly    │
│ Optional configured feeds      │ Optional local MOSDAC INSAT scenes│
└────────────────┬───────────────┴────────────────┬──────────────────┘
                 ▼                                 ▼
┌────────────────────────────────┐  ┌────────────────────────────────┐
│ Scenario / observed status     │  │ Local archive readers           │
│ Reflectivity and motion fields │  │ HDF5 precipitation + GeoTIFF     │
│ Optical flow and track cones   │  │ Inventory, provenance, replay   │
└────────────────┬───────────────┘  └────────────────┬───────────────┘
                 ▼                                    ▼
┌────────────────────────────────┐  ┌────────────────────────────────┐
│ Hazard and explainability APIs │  │ Real-data verification          │
│ Hail · downburst · cloudburst  │  │ IMERG vs persistence metrics    │
│ Lightning · rain anomaly       │  │ Published Leh case references   │
└────────────────┬───────────────┘  └────────────────┬───────────────┘
                 └──────────────────┬─────────────────┘
                                    ▼
                 ┌──────────────────────────────────────┐
                 │ FastAPI backend (:8000)               │
                 │ REST /api/v1 · health · optional      │
                 │ Supabase-backed auth/observations     │
                 └──────────────────┬───────────────────┘
                                    ▼
                 ┌──────────────────────────────────────┐
                 │ React + Leaflet dashboard             │
                 │ Landing · Officer · Data Lab · Admin  │
                 │ Citizen · Data Sources                │
                 └──────────────────────────────────────┘
```

Source mode and availability are part of the product: the backend distinguishes `REAL_ARCHIVED`, `OBSERVED`, and `SCENARIO` data, and returns `AWAITING REAL DATA` or unconfigured/offline states when an input is unavailable. Synthetic verification results are also served separately from archived-data verification at `GET /api/v1/verification` and `GET /api/v1/verification/real`.

## Quickstart

### Docker (recommended — one command)

```bash
docker compose up --build
```

- Dashboard: **http://localhost:3000**
- API health: http://localhost:8000/health
- API reference: http://localhost:8000/docs
- The local `data/` directory is mounted read-only into the backend container.

### Local (without Docker)

Install dependencies from the repository root:

```bash
npm install
python -m pip install -r backend/requirements.txt
```

Start the backend and frontend together:

```bash
npm run dev
```

The startup script runs the FastAPI backend, waits for its health check, and then starts Vite. Open http://localhost:3000; the API is at http://localhost:8000. In Windows PowerShell, use `npm.cmd install` and `npm.cmd run dev` if script execution policy blocks `npm`.

### Vercel deployment

Live Deployed App: https://vayugati-nowcast.vercel.app/

Vercel serves the frontend only. Deploy the Python API separately and configure `VITE_NOWCAST_API_URL` in the Vercel project to the public API base URL ending in `/api/v1`, then redeploy. The default `localhost:8000` address is for local development.

### Verification harness (no services needed)

From the repository root, with backend dependencies installed:

```bash
python -m verification.run_case_studies
python -m scripts.imerg_case_verification
python scripts/render_readme_verification.py
```

The first command evaluates deterministic synthetic motion cases. The second evaluates the local archived IMERG cases; it does not download data. The final command refreshes the synthetic verification table below from `verification/results.json`. For the repository acceptance checks, run `python scripts/final_check.py`.

## Five-minute judge demo

1. **Start the app** — Visit the Live Vercel Deployment or run locally with `docker compose up --build` / `npm run dev` and open http://localhost:3000.
2. **Inspect available sources** — Open Data Sources and review which inputs are live, archived, configured, simulated, or awaiting data. Open-Meteo is model guidance, not a direct observation.
3. **Replay a real case** — In Data Lab, select a Leh IMERG case and inspect the half-hourly precipitation frames and source timestamps. The bundled cases cover 2010-08-05 through 2010-08-06 06:00 UTC and 2011-07-25 through 18:00 UTC.
4. **Review the nowcast dashboard** — Open the officer map and inspect the current cell, hazard layers, forecast lead times, and each feature's source/status metadata. Without an authorized observed feed, scenario output remains explicitly labeled as scenario data.
5. **Inspect hazard analysis** — The API exposes hail, downburst, cloudburst, lightning-density, and rain-anomaly heads, plus initiation alerts and severity explanations. Use http://localhost:8000/docs to explore the available endpoints.
6. **Check the verification evidence** — Open `/api/v1/verification` for synthetic benchmarks and `/api/v1/verification/real` for archived IMERG verification. Real-data metrics are reported independently and should not be inferred from synthetic scores.
7. **Review the Leh event context** — The documented 2010 case record cites Bhan, Devrani, and Sinha (2015), with a chronology and source notes. The event narrative is published-case context; it is not a substitute for contemporaneous local radar truth.

## Data sources — India first

| Source | Data used or supported | Availability and interpretation |
|---|---|---|
| NASA GPM IMERG Final Run V07 | Real half-hourly precipitation HDF5 archives for Leh 2010 and 2011; monthly-mean context CSV | Archived local files included in `data/`; read at runtime from disk, with no archive download attempted. Native grid spacing is about 0.1° (roughly 10 km), not 1 km radar data. |
| Open-Meteo | Current model-derived atmospheric and weather guidance | Retrieved from the service when available; guidance is not a direct observation or an IMD warning. |
| MOSDAC / INSAT-3DR | Optional local TIR1 GeoTIFF scene preview and metadata | Requires authorized scenes in `data/mosdac/`. Temperature interpretation is withheld unless units/calibration are declared. The public image endpoint is not treated as a calibrated, georeferenced feed. |
| IMD Doppler Weather Radar | Configurable georeferenced WMS/XYZ tile metadata; observed-cell ingestion can be configured | Requires valid feed URL and bounds, and authorized access for observation ingestion. A public radar GIF is image-only and is not silently georeferenced. |
| Lightning feed | Configurable lightning observations and hazard analysis | External feed availability/configuration is required; generated demo points are not real strikes. |
| Published Leh case study | Event chronology and climatological context for the 2010 Leh cloudburst | Bhan, S.C., Devrani, A.K., and Sinha, V. (2015), "An analysis of monthly rainfall and the meteorological conditions associated with cloudburst over the dry region of Leh (Ladakh), India," *MAUSAM*, 66(1), 107–122. This is documented case context, not a gridded observation feed. |

The real-data workflow does not fetch institutional archives automatically. Users must obtain restricted products from their authorized providers and follow the product's applicable access and redistribution terms. The app reports unavailable inputs instead of treating placeholders as observations.

## Roadmap — the 8 phases

1. **Data ingestion** — ✅ Open-Meteo guidance, local IMERG archive readers, optional local INSAT scenes, and explicit radar/lightning feed adapters.
2. **Historical training dataset** — ⏳ Expand quality-controlled, labeled observed cases; the included event catalogue and verification evidence do not amount to a broad operational training archive.
3. **Convective cell tracking** — 🧪 Scenario/demo cell tracking and authorized observed-cell ingestion contracts are present; continuous production DWR tracking depends on an authorized feed.
4. **Baseline nowcast** — ✅ Dense optical-flow utilities and 15–360 minute track horizons are implemented. The six-hour output is scenario extrapolation unless supported by suitable observations and validation.
5. **Learned nowcast** — ⏳ Research opportunity. The project has a scikit-learn gradient-boosting severity model; it is not a deep-learning precipitation nowcast.
6. **Multi-source fusion** — 🧪 API structures cover radar, satellite, lightning, and weather context; operational fusion quality depends on real, configured inputs.
7. **Hazard-specific analysis** — ✅ Hail, downburst, cloudburst, lightning-density, rainfall-anomaly, and initiation modules are available, with explainability support.
8. **GIS dashboard and backend** — ✅ React/Leaflet interface, FastAPI endpoints, Docker Compose setup, role-oriented portals, and data-status visibility.

## Verification headline

`verification/run_case_studies.py` reports deterministic **synthetic reconstructions**, comparing Farneback advection against persistence across six motion/evolution scenarios (20 seeds per case). These numbers test implementation behavior, not real-world forecast skill.

<!-- VERIFICATION_TABLE_START -->
| Synthetic case | Nowcast CSI (mean +/- std) | Persistence CSI (mean +/- std) |
|---|---:|---:|
| DECAYING storm | 0.216 +/- 0.007 | 0.063 +/- 0.004 |
| Fast squall line | 0.866 +/- 0.009 | 0.018 +/- 0.001 |
| GROWING storm | 0.711 +/- 0.006 | 0.144 +/- 0.002 |
| Moderate coastal line | 0.906 +/- 0.004 | 0.089 +/- 0.002 |
| Orographic quasi-stationary | 0.905 +/- 0.003 | 0.802 +/- 0.002 |
| Splitting/merging cells | 0.925 +/- 0.006 | 0.331 +/- 0.002 |
<!-- VERIFICATION_TABLE_END -->

**Real archived-data check (IMERG Final Run V07):** On the 60-minute, 1.0 mm/h threshold, Leh 2010 CSI is 0.423 for the nowcast and 0.424 for persistence; Leh 2011 is 0.443 for both (rounded). These are local satellite-product comparisons, not independent radar verification. The IMERG product itself includes morphing/advection-based processing, and its roughly 10 km native spacing is coarser than the dashboard's target display scale. See [`verification/VERIFICATION_REPORT.md`](verification/VERIFICATION_REPORT.md) and [`verification/real_results.json`](verification/real_results.json) for methods, thresholds, uncertainty, coverage, and the full results.

## Honest caveats

- **Not an official warning service.** VayuGati is a research prototype and does not replace IMD, NDMA, or state disaster-management authorities.
- **Real data and scenarios are different.** The bundled Leh IMERG archive is real satellite-derived precipitation. Scenario reflectivity, generated lightning, and synthetic test cases are not observations. Source/status metadata should be checked for each view.
- **No automatic institutional archive download.** IMERG is read from local files. MOSDAC files and authorized DWR/lightning feeds require their own access, local provisioning, and configuration.
- **The six-hour horizon is not a claim of six-hour operational skill.** Current track extrapolation moves existing fields and does not reliably predict storm initiation, growth, decay, splitting, or merging. Backend scenario output is labeled `SCENARIO_EXTRAPOLATION_ONLY`.
- **Real-data verification is limited.** IMERG is a satellite precipitation product, not an independent DWR reanalysis. The present Leh comparisons are nearly tied with persistence and do not certify operational performance.
- **Resolution and calibration matter.** IMERG's native grid is approximately 0.1°; raw INSAT TIR1 values are not converted to brightness temperature without suitable calibration metadata.
- **Data rights apply.** Check NASA/GES DISC, MOSDAC, and other providers' terms for each product before redistribution.

## Repository map

```text
backend/
  nowcast_engine.py       FastAPI app, REST /api/v1 routes
  ingestion/               Open-Meteo, IMERG, MOSDAC, radar, lightning adapters
  nowcast/                 Dense Farneback optical flow
  hazards/                 Hail, downburst, cloudburst, lightning density, initiation, rain anomaly
  ml/                       Gradient-boosting severity model, SHAP explainability, event catalogue
data/
  imerg_halfhourly/         Real NASA GPM IMERG V07 HDF5 — Leh 2010 & 2011
  imerg_monthly/            Giovanni monthly-mean context CSV
  mosdac/                   Local INSAT-3DR TIR1 GeoTIFF scenes
deliverables/
  deck/                     SIH idea deck (PDF)
  report/                   Project report (PDF)
verification/
  run_case_studies.py       Synthetic motion-reconstruction harness (6 regimes, 20 seeds)
  imerg_case_verification.py Real-data IMERG-vs-persistence harness
  real_cases/                Leh 2010 / 2011 documented case facts (Bhan et al., 2015)
  VERIFICATION_REPORT.md     Full synthetic + real results
  real_results.json          Full real-data results (machine-readable)
src/
  pages/                    Landing, Officer, Citizen, Admin, Data Lab, Data Sources
  components/                Alert review queue, SHAP card, data-status badges, VayuGati Saarthi
supabase/migrations/        CAP alert lifecycle, audit log, RLS, hazard heads schema
scripts/                     Verification runners, README table renderer, final acceptance check
```

## References

- Bhan, S.C., Devrani, A.K., Sinha, V. (2015). "An analysis of monthly rainfall and the meteorological conditions associated with cloudburst over the dry region of Leh (Ladakh), India." *MAUSAM* 66(1), 107–122. [Article](https://mausamjournal.imd.gov.in/index.php/MAUSAM/article/view/371/290)
- NASA GPM IMERG Final Run V07 — https://gpm.nasa.gov/data/directory
- NASA GES DISC / Giovanni — https://giovanni.gsfc.nasa.gov/giovanni/
- MOSDAC (ISRO), INSAT-3D/3DR — https://mosdac.gov.in/
- IMD MAUSAM / observation services — https://mausam.imd.gov.in/
- NDMA Lightning Guidelines (2020) — https://ndma.gov.in/
- OASIS Common Alerting Protocol v1.2 — https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html
- NCRB, Accidental Deaths & Suicides in India (ADSI) — https://www.ncrb.gov.in/

## License

Released under the [MIT License](LICENSE) © 2026 mannbutani0306. Third-party datasets (NASA GPM IMERG, MOSDAC/INSAT, IMD) remain subject to their providers' own terms — see [Honest caveats](#honest-caveats).

---

<div align="center">

*VayuGati Nowcast — Convective Scale Nowcasting for Thunderstorms, Hail & Cloudbursts · SIH26084 · Disaster Management · Software · Team TRIKAAL · Team ID 137710*

</div>
