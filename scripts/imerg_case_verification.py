"""Verify archived Leh IMERG sequences against actual later half-hour frames."""

import json
from collections import defaultdict
from pathlib import Path
import sys

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.ingestion.imerg import AWAITING_INSTRUCTIONS, read_imerg_case
from backend.nowcast.optical_flow_dense import dense_farneback_flow
from verification.metrics import bias, csi, far, fss, pod


LEADS_MINUTES = (30, 60, 90, 120)
THRESHOLDS_MM_HR = (0.5, 1.0, 2.0, 5.0)
CASE_IDS = ("leh_2010_08_05", "leh_2011_07_25")
REPORT_PATH = ROOT / "verification" / "VERIFICATION_REPORT.md"
RESULTS_PATH = ROOT / "verification" / "real_results.json"


def _advect(frame, flow, lead_minutes, km_per_pixel_x, km_per_pixel_y):
    height, width = frame.shape
    grid_y, grid_x = np.mgrid[0:height, 0:width].astype(np.float32)
    u = np.asarray(flow["u_kmh"], dtype=np.float32)
    v = np.asarray(flow["v_kmh"], dtype=np.float32)
    shift_x = u * (lead_minutes / 60.0) / km_per_pixel_x
    shift_y = -v * (lead_minutes / 60.0) / km_per_pixel_y
    return cv2.remap(
        np.nan_to_num(frame, nan=0.0).astype(np.float32),
        grid_x - shift_x,
        grid_y - shift_y,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0.0,
    )


def _binary_metrics(observed, predicted, valid):
    obs = (observed >= 0.5) & valid
    pred = (predicted >= 0.5) & valid
    hits = int(np.sum(obs & pred))
    misses = int(np.sum(obs & ~pred & valid))
    false_alarms = int(np.sum(~obs & pred & valid))
    observed_count = hits + misses
    predicted_count = hits + false_alarms
    return {
        "CSI": hits / (hits + misses + false_alarms) if hits + misses + false_alarms else 0.0,
        "POD": hits / observed_count if observed_count else 0.0,
        "FAR": false_alarms / predicted_count if predicted_count else 0.0,
        "bias": predicted_count / observed_count if observed_count else 0.0,
    }


def _score(valid, observed_rate, forecast_rate, persistence_rate, threshold):
    obs = np.nan_to_num(observed_rate, nan=0.0) >= threshold
    advected = np.nan_to_num(forecast_rate, nan=0.0) >= threshold
    persisted = np.nan_to_num(persistence_rate, nan=0.0) >= threshold
    valid_fraction = float(np.count_nonzero(valid) / valid.size)
    forecast_metrics = _binary_metrics(obs, advected, valid)
    persistence_metrics = _binary_metrics(obs, persisted, valid)
    forecast_metrics["FSS"] = fss(obs & valid, advected & valid, radius=3, threshold=0.5)
    persistence_metrics["FSS"] = fss(obs & valid, persisted & valid, radius=3, threshold=0.5)
    return forecast_metrics, persistence_metrics, valid_fraction


def _verify_case(case_id):
    case = read_imerg_case(case_id)
    if not case["frames"]:
        return {
            "case_id": case_id,
            "status": "AWAITING REAL DATA",
            "files_found": case["files_found"],
            "first_timestamp_utc": case["first_timestamp_utc"],
            "last_timestamp_utc": case["last_timestamp_utc"],
            "results": [],
            "instructions": AWAITING_INSTRUCTIONS,
        }

    frames = [item["precipitation_rate_mm_hr"] for item in case["frames"]]
    step_km_x = case["km_per_pixel"]["east_west"]
    step_km_y = case["km_per_pixel"]["north_south"]
    samples = defaultdict(lambda: {"nowcast": defaultdict(list), "persistence": defaultdict(list), "valid_area_fraction": []})
    flow_by_start = {}
    for start_index in range(1, len(frames) - 1):
        flow = dense_farneback_flow(
            frames[start_index - 1], frames[start_index],
            minutes_between_frames=30.0,
            km_per_pixel=1.0,
        )
        flow["u_kmh"] = (np.asarray(flow["u_kmh"], dtype=float) * step_km_x).tolist()
        flow["v_kmh"] = (np.asarray(flow["v_kmh"], dtype=float) * step_km_y).tolist()
        flow_by_start[start_index] = flow

    for lead in LEADS_MINUTES:
        lead_steps = lead // 30
        for start_index in range(1, len(frames) - lead_steps):
            target_index = start_index + lead_steps
            current = frames[start_index]
            observed = frames[target_index]
            forecast = _advect(current, flow_by_start[start_index], lead, step_km_x, step_km_y)
            valid = np.isfinite(observed) & np.isfinite(current) & np.isfinite(forecast)
            if not valid.any():
                continue
            for threshold in THRESHOLDS_MM_HR:
                nowcast_metrics, persistence_metrics, valid_fraction = _score(
                    valid, observed, forecast, current, threshold,
                )
                key = (lead, threshold)
                for metric, value in nowcast_metrics.items():
                    samples[key]["nowcast"][metric].append(value)
                for metric, value in persistence_metrics.items():
                    samples[key]["persistence"][metric].append(value)
                samples[key]["valid_area_fraction"].append(valid_fraction)

    results = []
    for (lead, threshold), models in sorted(samples.items()):
        def summarize(metrics):
            return {
                metric: {"mean": float(np.mean(values)), "std": float(np.std(values, ddof=1)) if len(values) > 1 else 0.0}
                for metric, values in metrics.items()
            }
        results.append({
            "lead_minutes": lead,
            "threshold_mm_hr": threshold,
            "sample_count": len(models["valid_area_fraction"]),
            "nowcast": summarize(models["nowcast"]),
            "persistence": summarize(models["persistence"]),
            "valid_area_fraction": float(np.mean(models["valid_area_fraction"])),
        })

    return {
        "case_id": case_id,
        "status": "REAL_ARCHIVED",
        "product": "GPM IMERG Final Run V07 half-hourly precipitation rate",
        "files_found": case["files_found"],
        "frames_loaded": case["frames_loaded"],
        "first_timestamp_utc": case["first_timestamp_utc"],
        "last_timestamp_utc": case["last_timestamp_utc"],
        "frame_shape": case["frame_shape"],
        "km_per_pixel": case["km_per_pixel"],
        "results": results,
    }


def main():
    cases = [_verify_case(case_id) for case_id in CASE_IDS]
    available = [case for case in cases if case["status"] == "REAL_ARCHIVED"]
    payload = {
        "status": "REAL_ARCHIVED" if available else "AWAITING REAL DATA",
        "product": "GPM IMERG Final Run V07 archived files; no runtime network access",
        "source_url": "https://gpm.nasa.gov/data/imerg",
        "cases": cases,
        "caveats": [
            "IMERG estimates are satellite-derived and have known uncertainty.",
            "IMERG Final Run includes morphing/advection-based processing, so comparison with persistence is not an independent operational-radar test.",
            "IMERG grid spacing is approximately 10 km, coarser than the 1-3 km target display grid.",
            "Scores use only pixels valid in the current and target fields; the valid-area fraction is reported.",
        ],
        "instructions": None if available else AWAITING_INSTRUCTIONS,
    }
    RESULTS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    report = REPORT_PATH.read_text(encoding="utf-8") if REPORT_PATH.exists() else "# VayuGati Verification Report\n"
    report = report.split("\n## Real-data verification (IMERG Final Run, archived)", 1)[0]
    section = "\n## Real-data verification (IMERG Final Run, archived)\n\n"
    section += "IMERG Final Run V07 is satellite-derived and includes morphing/advection-based processing; this is not an independent operational-radar test. Its approximately 10 km grid is coarser than the 1-3 km target display resolution. Metrics compare local archived half-hourly fields only; no runtime archive download is attempted. Scores use pixels valid in both fields and report their valid-area fraction.\n\n"
    if not available:
        section += f"**AWAITING REAL DATA.** {AWAITING_INSTRUCTIONS}\n"
    else:
        section += "| Case | Lead (min) | Threshold (mm/h) | Nowcast CSI | Persistence CSI | POD | FAR | FSS | Bias | Valid area | Samples |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n"
        for case in available:
            for row in case["results"]:
                section += (
                    f"| {case['case_id']} | {row['lead_minutes']} | {row['threshold_mm_hr']:.1f} "
                    f"| {row['nowcast']['CSI']['mean']:.3f} +/- {row['nowcast']['CSI']['std']:.3f} "
                    f"| {row['persistence']['CSI']['mean']:.3f} +/- {row['persistence']['CSI']['std']:.3f} "
                    f"| {row['nowcast']['POD']['mean']:.3f} | {row['nowcast']['FAR']['mean']:.3f} "
                    f"| {row['nowcast']['FSS']['mean']:.3f} | {row['nowcast']['bias']['mean']:.3f} "
                    f"| {row['valid_area_fraction']:.3f} | {row['sample_count']} |\n"
                )
    report += section
    REPORT_PATH.write_text(report, encoding="utf-8")

    if not available:
        print(f"AWAITING REAL DATA: {AWAITING_INSTRUCTIONS}")
        return
    summary = [{
        "case": case["case_id"],
        "files_loaded": f"{case['frames_loaded']}/{case['files_found']}",
        "first": case["first_timestamp_utc"],
        "last": case["last_timestamp_utc"],
        "rows": len(case["results"]),
    } for case in available]
    print(json.dumps({"status": payload["status"], "cases": summary}, indent=2))


if __name__ == "__main__":
    main()