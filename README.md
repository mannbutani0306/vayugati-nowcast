# VayuGati Nowcast | SIH26084

VayuGati Nowcast is a prototype for SIH26084: hyper-local convective guidance over a 0-6 hour horizon on a 1-3 km **display** grid. It combines live Open-Meteo NWP, local archived satellite precipitation context, documented Leh case facts, dense optical-flow experiments, hazard heuristics, and existing Supabase/CAP workflows. Interpolated display resolution is not native forecast skill. This is not an official IMD or NDMA warning service.

## Architecture

```text
Inputs
  REAL_LIVE: Open-Meteo NWP
  REAL_ARCHIVED: local IMERG / INSAT files, when available
  DOCUMENTED_CASE: cited Leh paper facts
  SIMULATED_DEMO_FIXTURE: named cells, lightning proxy, detector demo frames
       |
       v
Python ingestion -> dense Farneback + retained Lucas-Kanade path
       |
       +-> hazard heads: hail / downburst / cloudburst / lightning / initiation / rain anomaly
       +-> verification: synthetic ensemble + local archived IMERG evaluation
       |
       v
FastAPI -> existing Supabase spatial + CAP review workflows -> Citizen / Officer / Admin React portals
```

## Quickstart

### Docker

```powershell
docker compose up --build
```

Frontend: `http://localhost:3000`

API: `http://localhost:8000`

The backend receives `./data` as a read-only mount at `/app/data`. The image includes the cited Leh case JSON and trains its GBM artifact during build. Docker was not available in the development environment used for this pass, so the image build and container startup still need deployment-side verification.

### Manual

```powershell
npm install
npm run dev
```

In another terminal:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.nowcast_engine:app --host 0.0.0.0 --port 8000
```

If using a different Python environment, install `backend/requirements.txt` there instead. The frontend defaults to `http://localhost:8000/api/v1`; hosted deployments may set `VITE_NOWCAST_API_URL`. Supabase remains an external service.

### Local data

Archived files are read from `DATA_DIR` (default `./data` for manual runs). No runtime archive download is attempted. Put authorized data in the paths below; consult [data/README.md](data/README.md) for product and redistribution cautions.

| Path | Contents |
|---|---|
| `data/imerg_halfhourly/leh_2010_08_05/` | GPM IMERG V07 half-hourly HDF5 |
| `data/imerg_halfhourly/leh_2011_07_25/` | GPM IMERG V07 half-hourly HDF5 |
| `data/imerg_monthly/monthly_mean.csv` | Giovanni monthly-mean rate CSV |
| `data/mosdac/` | Local INSAT-3DR TIR1 scenes and matching calibration product, if available |

## Five-minute judge demo

1. Open the Citizen portal and point out that approved warnings use the existing Supabase workflow; unavailable feeds are not presented as observations.
2. Open Officer > Model Skill. Compare the synthetic 60/120-minute CSI spreads with the separate IMERG archived tab. The archived IMERG comparison includes results where nowcast ties or loses to persistence.
3. Open “Real-World Anchor Case - Leh 2010”. The timeline is schematic and derived from the cited paper, not satellite imagery. The event began over the Tibetan Plateau around 06:00 UTC, reached Ladakh around 15:00 UTC, had the highest reported TRMM estimates south of Leh from 15:00-18:00 UTC, and the landslide was around 20:00 UTC.
4. Show the threshold contrast: the paper reports TRMM estimates of 4-8 cm in 3 hours, approximately 13-27 mm/h average. The fixed 100 mm/h cloudburst criterion does not trigger, while the project climatology heuristic triggers at 2.67-5.33 times the August mean of 15.0 mm. TRMM is satellite-derived and uncertain; the 25 Jul 2011 companion also triggers the anomaly heuristic despite no reported casualties or landslides, illustrating false-alarm risk.
5. In the Officer map, enable “Real INSAT-3DR scene”. The current local raster is shown as a raw-channel preview only: it has no declared temperature units or matching calibration lookup, so no brightness temperature, cooling, or initiation analysis is claimed. Open Admin to show live polygon/cone dispatch status or its visible fixture-fallback badge.

The Leh case facts are from Bhan, S.C., Devrani, A.K., Sinha, V. (2015), “An analysis of monthly rainfall and the meteorological conditions associated with cloudburst over the dry region of Leh (Ladakh), India”, *MAUSAM* 66(1), 107-122.

## Synthetic verification

The table below is generated from `verification/results.json` by `python scripts/render_readme_verification.py`; do not edit its rows by hand. Run `python -m verification.run_case_studies` to refresh the artifact.

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

The synthetic harness uses six regimes, a 384 x 384 km-equivalent domain, and 20 deterministic seeds per regime. In the Himachal-style quasi-stationary case the nowcast is **ahead of persistence** at 60 minutes (Farneback underestimates the slow motion yet still beats a frozen frame). Expanding the domain reduces storm domain-exit artifacts; it does not remove domain boundaries or make this a geographic radar verification. The decaying, growing, and splitting/merging cases retain their measured outcomes; advection-only motion can lose when storm intensity or structure changes.

**Known limitations:** truth fields are synthetic rather than observed weather; advection has no growth/decay physics; the reliability diagnostic is based on synthetic reflectivity thresholds and is not calibrated ML probability. These scores are not operational forecast skill.

The fusion-map demo renders constant-velocity scenario cones through 360 minutes to illustrate the requested 0-6 hour horizon. These are extrapolations from demo cells, not real or validated forecasts; operational convective fusion remains blocked by the unconfigured authorized sensor feeds listed below.

## Real-data verification

`python scripts/imerg_case_verification.py` uses only local GPM IMERG Final Run V07 files and writes `verification/real_results.json` plus a report section. Current local inventory: 61/61 Leh 2010 frames from 2010-08-05 00:00 UTC through 2010-08-06 06:00 UTC, and 37/37 Leh 2011 frames from 2011-07-25 00:00 through 18:00 UTC.

At +60 minutes and 1 mm/h, the current measured Leh 2010 CSI is 0.423 for advection and 0.424 for persistence; Leh 2011 is 0.443 for both. Read the generated report for all thresholds and lead times. IMERG is itself a morphing/advection-based satellite product, so this is not an independent operational-radar test. Its approximately 10 km resolution is coarser than the 1-3 km target. Valid-area fractions are reported and empty archives produce `AWAITING REAL DATA` with placement instructions.

## Reality and roadmap register

### REAL

- `REAL_LIVE`: Open-Meteo NWP request path when the provider responds; response status and timing remain relevant.
- `REAL_ARCHIVED`: local IMERG HDF5/CSV and INSAT TIR1 files where inventory confirms them. No runtime archive network calls.
- `REAL_ARCHIVED`: measured IMERG advection-versus-persistence verification, with satellite-product and resolution caveats.
- `DOCUMENTED_CASE`: paraphrased Leh 2010/2011 facts from Bhan et al. (2015), not imagery or an independent reanalysis.
- A scikit-learn Gradient Boosting model is loaded only when the artifact metadata version matches; SHAP explanations are requested from the backend TreeExplainer endpoint.

### SIMULATED

- `SIMULATED_DEMO_FIXTURE`: named fusion-grid storm cells, lifecycle histories, four-frame initiation inputs, and lightning proxy. Initiation NEW markers use the detector result, but demo input remains simulated.
- Synthetic verification truth uses prescribed motions/evolution. Model training rows and their labels are synthetic and heuristic-derived; `heuristic_label_consistency` is not predictive skill.
- Physics Matrix values and default walkthrough metrics are `ILLUSTRATIVE EXAMPLE`; selected-cell SHAP appears only after a successful backend response.

### ROADMAP

- Calibrated INSAT TIR1 temperatures and matching HDF5 calibration lookup are still required before reporting brightness-temperature thresholds or running cooling-based initiation on these scenes.
- Authorized IMD DWR observations and independent radar truth, official lightning observations, independent model labels, local calibration, and operational verification remain future work.
- The 2011 climatology anomaly with no reported impact is a concrete false-alarm risk, not a claimed success.

## Data sources

| Source | Status | Use / limitation |
|---|---|---|
| Open-Meteo NWP | `REAL_LIVE` | Forecast guidance; not an official warning |
| IMERG monthly Giovanni CSV | `REAL_ARCHIVED` when present | Seasonal context only; region label defaults to unverified; not radar or a nowcast input |
| IMERG half-hourly Leh cases | `REAL_ARCHIVED` when files are present, otherwise `AWAITING REAL DATA` | Local files only; inventory and valid-area metrics are reported |
| INSAT-3DR local TIR1 scenes | `REAL_ARCHIVED` when present, otherwise `AWAITING REAL DATA` | Raw preview is not BT without declared units or calibration |
| Leh 2010/2011 case facts | `DOCUMENTED_CASE` | Bhan, Devrani & Sinha (2015), *MAUSAM* 66(1), 107-122 |
| Kalpana-1 2010 scenes | `REQUEST` | Paper-reported chronology only; source imagery not included |
| IMD DWR | `REQUEST` | Authorized, georeferenced observations not configured |
| Lightning | `SIMULATED proxy` | Not an official observation feed |
| Storm cells | `SIMULATED_DEMO_FIXTURE` | Named demo cells and histories |

NASA/GES DISC and MOSDAC terms apply to downloaded products. Download access does not imply redistribution rights; local data files are ignored by Git.

## Corrected since last submission

- A1: Removed the unconditional dense-flow overwrite; the standalone hazard endpoint synthesizes motion-history frames.
- A2: SHAP contribution shares normalize by total absolute contribution; raw log-odds are separate; fixture examples and unavailable responses are labeled.
- A3: Added initiation POST and per-cell simulated detector result; NEW markers depend on `initiation.detected`.
- A4: Admin dispatch uses live cell polygons and forecast cones; fixture fallback is explicit.
- A5: Six synthetic regimes, 20 seeds each, FSS scales, reliability bins, model-skill spreads/chart, and known limitations.
- A6: Renamed heuristic holdout consistency; independent validation is evaluated only with at least five supplied rows.
- A7: Pinned scikit-learn, wrote `model_meta.json`, checks artifact version, and trains during Docker build.
- A8: Added gzip, a 30-second fusion cache, default grid omission, and decimation.
- B1: Added cited Leh 2010/2011 records, chronology, and Officer anchor-case panel.
- B2: Added the climatology-relative anomaly heuristic and fixed 100 mm/h comparison, with the 2011 false-alarm caveat.
- B3: Added local IMERG ingestion, actual-frame verification, status endpoint, and Officer archived-data tab.
- B4: Added local INSAT inventory/raw overlay. Temperature analysis remains unavailable until calibration is verified.
- B5: Added monthly CSV conversion and context chart with unverified region label.
- B6: Updated the source register with runtime statuses and explicit simulated/request states.

## Final status

| Item | FIXED/PARTIAL/NOT DONE | Evidence | Remaining risk |
|---|---|---|---|
| A1 | FIXED | `tests/test_hazard_flow.py`; non-zero fusion and standalone divergence | Farneback is image motion, not Doppler wind |
| A2 | FIXED | SHAP endpoint card, normalized shares, raw log-odds tooltip, failure state | Matrix/default walkthrough remains explicitly illustrative |
| A3 | FIXED | POST endpoint and three detector tests | Fusion frames are simulated fixtures |
| A4 | FIXED | Live polygon/cone status calculation and visible fallback | Facility catalogue coordinates remain configured examples |
| A5 | FIXED | `verification/results.json`, report, skill chart, renderer | Synthetic truth and advection-only physics |
| A6 | FIXED | Training output and empty independent-validation template | No independent validation rows were supplied |
| A7 | FIXED | Pinned versions, model metadata, mismatch fallback test | Docker image build not run here |
| A8 | FIXED | HTTP before 860,205 bytes / 533.5 ms; after 239,060 bytes / 496 ms; gzip 34,504 bytes; cached 31.5 ms | Timing is local TestClient measurement |
| B1 | FIXED | JSON case files and cited Officer timeline | Published case account, not independent reanalysis |
| B2 | FIXED | Three unit tests and API computations | Heuristic cutoffs are not IMD categories; 2011 false-alarm risk |
| B3 | FIXED | 61/61 and 37/37 frames; generated `real_results.json`; endpoints 200 | IMERG product is advective and approximately 10 km |
| B4 | PARTIAL | Four local scenes inventoried; API and raw overlay work | BT, cold fractions, cooling, initiation, and flow await calibration metadata |
| B5 | FIXED | 69 valid CSV records, 12 months, ratio 5.964 | Geographic shape remains unverified |
| B6 | FIXED | Runtime-aware Data Sources table and monthly chart | Provider authorization remains external |
| C1 | FIXED | `.gitignore`, `data/README.md`, folder markers | Existing local data is intentionally untracked |
| C2 | FIXED | Read-only compose mount, `DATA_DIR`, case JSON Docker copy | Docker unavailable for image verification |
| C3 | PARTIAL | Exact reader pins; empty INSAT endpoint returns `AWAITING REAL DATA` | `docker compose up --build` not run; full empty-container startup unverified |
| C4 | FIXED | Both IMERG directories and MOSDAC filename discovery exercised | Inventory reflects the current local archive only |
| Final acceptance | FIXED | `scripts/final_check.py`: 22/22 checks passed, including empty-data states and `npm run build` | Docker checks remain unverified |
| GitHub target | CONFIGURED | `origin` points to `https://github.com/mannbutani0306/vayugati-nowcast.git`; `main` tracks `origin/main` | Verify the published commit and deployment separately before submission |