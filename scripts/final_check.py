"""Run repository acceptance checks and print a PASS/FAIL evidence table."""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import numpy as np
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
RESULTS: list[tuple[str, bool, str]] = []


def record(name: str, passed: bool, evidence: str) -> None:
    RESULTS.append((name, passed, evidence))


def run_script(label: str, command: list[str]) -> None:
    process = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=False)
    try:
        summary = json.loads(process.stdout)
        evidence = json.dumps(summary, separators=(",", ":"))
    except (json.JSONDecodeError, TypeError):
        evidence = process.stdout.strip().splitlines()[-1] if process.stdout.strip() else "no stdout"
    if process.stderr.strip():
        evidence += "; stderr: " + process.stderr.strip().splitlines()[-1]
    record(label, process.returncode == 0, evidence)


def run_endpoint_checks() -> None:
    from backend.nowcast_engine import app

    texture = np.zeros((16, 16), dtype=float)
    texture[4:10, 5:11] = 55.0
    shifted = np.zeros_like(texture)
    shifted[4:10, 6:12] = 55.0
    initiation_payload = {
        "reflectivity_frames": [
            [[20.0]], [[26.0]], [[32.0]], [[36.0]],
        ],
        "cloud_top_cooling_rate": -4.0,
        "status": "SIMULATED_DEMO_FIXTURE",
    }
    with patch(
        "backend.nowcast_engine.get_lightning_feed",
        new=AsyncMock(return_value={"metadata": {"status": "OFFLINE"}, "features": []}),
    ), TestClient(app) as client:
        grid_response = client.get("/api/v1/live-fusion-grid")
        record("live-fusion-grid", grid_response.status_code == 200 and bool(grid_response.json().get("features")), f"HTTP {grid_response.status_code}; {len(grid_response.content)} response bytes")
        grid = grid_response.json()
        first_cell = next(feature for feature in grid["features"] if feature["properties"].get("feature_type") == "CURRENT_CONVECTIVE_CELL")
        divergence = np.asarray(first_cell["properties"]["hazard_heads"]["downburst"]["details"]["flow_divergence_per_minute"], dtype=float)
        record("fusion-grid divergence", float(divergence.std()) > 0, f"std={float(divergence.std()):.6f}")
        initiation_payload_cell = first_cell["properties"].get("initiation")
        record("fusion-grid initiation payload", bool(initiation_payload_cell and initiation_payload_cell.get("status") == "SIMULATED_DEMO_FIXTURE"), f"detected={initiation_payload_cell.get('detected') if initiation_payload_cell else None}; status={initiation_payload_cell.get('status') if initiation_payload_cell else None}")

        hazard_response = client.get("/api/v1/hazard-heads?lat=34.09&lon=77.34&speed_kmh=20&bearing_deg=45")
        hazard = hazard_response.json()
        standalone_divergence = np.asarray(hazard["downburst"]["details"]["flow_divergence_per_minute"], dtype=float)
        required_heads = ("hail", "downburst", "cloudburst", "lightning_density", "rain_anomaly")
        record("hazard-heads", hazard_response.status_code == 200 and all(key in hazard for key in required_heads), f"HTTP {hazard_response.status_code}; divergence std={standalone_divergence.std():.6f}")
        record("standalone divergence", float(standalone_divergence.std()) > 0, f"std={float(standalone_divergence.std()):.6f}")

        explain_response = client.post("/api/v1/explain-severity", json={
            "reflectivity_dbz": 45.0,
            "cape_j_kg": 1800.0,
            "lightning_rate_per_min": 8.0,
            "cloud_top_cooling_rate_c_per_15m": -4.0,
        })
        explanation = explain_response.json()
        record("explain-severity", explain_response.status_code == 200 and "explanation" in explanation, f"HTTP {explain_response.status_code}; method={explanation.get('explanation', {}).get('method', 'unavailable')}")

        verification_response = client.get("/api/v1/verification")
        record("verification", verification_response.status_code == 200 and bool(verification_response.json().get("cases")), f"HTTP {verification_response.status_code}; status={verification_response.json().get('status')}")

        real_verification_response = client.get("/api/v1/verification/real")
        real_verification = real_verification_response.json()
        record("verification/real", real_verification_response.status_code == 200 and "status" in real_verification, f"HTTP {real_verification_response.status_code}; status={real_verification.get('status')}")
        record("archived source citation", bool(real_verification.get("source_url")), f"source_url={real_verification.get('source_url')}")

        cases_response = client.get("/api/v1/real-cases")
        documented_cases = cases_response.json()
        citation_ok = bool(documented_cases.get("citation")) and all(item.get("citation") for item in documented_cases.get("cases", []))
        record("real-cases", cases_response.status_code == 200 and citation_ok, f"HTTP {cases_response.status_code}; status={documented_cases.get('status')}; citation={'present' if citation_ok else 'missing'}")

        initiation_response = client.post("/api/v1/initiation-alerts", json=initiation_payload)
        initiation = initiation_response.json()
        record("initiation-alerts POST", initiation_response.status_code == 200 and bool(initiation.get("detections")), f"HTTP {initiation_response.status_code}; detections={len(initiation.get('detections', []))}; status={initiation.get('status')}")

        flow_response = client.post("/api/v1/optical-flow-dense", json={
            "previous_reflectivity": texture.tolist(),
            "current_reflectivity": shifted.tolist(),
            "minutes_between_frames": 10.0,
            "km_per_pixel": 1.0,
        })
        record("optical-flow-dense", flow_response.status_code == 200 and flow_response.json().get("status") == "SUCCESS", f"HTTP {flow_response.status_code}; status={flow_response.json().get('status')}")

        scene_response = client.get("/api/v1/satellite/real-scene")
        scene = scene_response.json()
        scene_has_source = bool(scene.get("source")) and scene.get("status") in ("AWAITING REAL DATA", "REAL_ARCHIVED - INSAT-3DR L1C TIR1")
        record("satellite/real-scene", scene_response.status_code == 200 and scene_has_source and bool(scene.get("source_url")), f"HTTP {scene_response.status_code}; status={scene.get('status')}; analysis={scene.get('analysis_status')}; source={scene.get('source_url')}")

        monthly_response = client.get("/api/v1/ingestion/imerg/monthly-context")
        monthly = monthly_response.json()
        record("IMERG monthly context", monthly_response.status_code == 200 and "usage" in monthly and bool(monthly.get("source_url")), f"HTTP {monthly_response.status_code}; status={monthly.get('status')}; region={monthly.get('region_label')}; source={monthly.get('source_url')}")

        import backend.ingestion.imerg as imerg_ingestion
        import backend.ingestion.satellite as satellite_ingestion
        old_data_dir = imerg_ingestion.DATA_DIR
        old_case_dirs = imerg_ingestion.CASE_DIRECTORIES
        old_scene_dir = satellite_ingestion.LOCAL_TIR_DIR
        try:
            with tempfile.TemporaryDirectory() as directory:
                empty_root = Path(directory)
                imerg_ingestion.DATA_DIR = empty_root
                imerg_ingestion.CASE_DIRECTORIES = {
                    case_id: empty_root / "imerg_halfhourly" / case_id
                    for case_id in ("leh_2010_08_05", "leh_2011_07_25")
                }
                satellite_ingestion.LOCAL_TIR_DIR = empty_root / "mosdac"
                empty_real = client.get("/api/v1/verification/real").json()
                empty_month = client.get("/api/v1/ingestion/imerg/monthly-context").json()
                empty_scene = client.get("/api/v1/satellite/real-scene").json()
            empty_states = [empty_real.get("status"), empty_month.get("status"), empty_scene.get("status")]
            passed = all(value == "AWAITING REAL DATA" for value in empty_states)
            record("empty-data states", passed, ", ".join(empty_states))
        finally:
            imerg_ingestion.DATA_DIR = old_data_dir
            imerg_ingestion.CASE_DIRECTORIES = old_case_dirs
            satellite_ingestion.LOCAL_TIR_DIR = old_scene_dir


def check_source_claims() -> None:
    source_root = ROOT / "src"
    source_text = "\n".join(path.read_text(encoding="utf-8") for path in source_root.rglob("*") if path.is_file() and path.suffix in {".js", ".jsx", ".ts", ".tsx"})
    forbidden = [token for token in ("KernelSHAP", "N=10,000") if token in source_text]
    record("forbidden SHAP claims", not forbidden, "none found" if not forbidden else ", ".join(forbidden))

    ml_text = "\n".join(path.read_text(encoding="utf-8") for path in (ROOT / "backend" / "ml").glob("*.py"))
    old_metric = "augmentation_holdout_accuracy" in ml_text
    new_metric = "heuristic_label_consistency" in ml_text
    record("ML metric naming", new_metric and not old_metric, "heuristic_label_consistency present; old holdout label absent" if new_metric and not old_metric else "metric labels are inconsistent")

    results = json.loads((ROOT / "verification" / "results.json").read_text(encoding="utf-8"))
    fast_rows = [
        next(row for row in results["cases"] if row["case"] == name and row["lead_minutes"] == 60)
        for name in ("Fast squall line", "Moderate coastal line")
    ]
    passed = all(row["nowcast"]["CSI"]["mean"] > row["persistence"]["CSI"]["mean"] for row in fast_rows)
    evidence = "; ".join(f"{row['case']}: {row['nowcast']['CSI']['mean']:.3f} vs {row['persistence']['CSI']['mean']:.3f}" for row in fast_rows)
    record("fast-case CSI improvement", passed, evidence)


def main() -> int:
    run_script("synthetic verification run", [sys.executable, "-m", "verification.run_case_studies"])
    run_script("real-data verification run", [sys.executable, "-m", "scripts.imerg_case_verification"])
    run_script("README verification table render", [sys.executable, "scripts/render_readme_verification.py"])
    try:
        run_endpoint_checks()
    except Exception as exc:
        record("API endpoint suite", False, f"{type(exc).__name__}: {exc}")
    try:
        check_source_claims()
    except Exception as exc:
        record("source-claim checks", False, f"{type(exc).__name__}: {exc}")

    if os.name == "nt":
        build = subprocess.run("npm.cmd run build", cwd=ROOT, shell=True, text=True, capture_output=True, check=False)
    else:
        build = subprocess.run(["npm", "run", "build"], cwd=ROOT, text=True, capture_output=True, check=False)
    build_output = build.stdout.strip().splitlines()
    record("npm run build", build.returncode == 0, build_output[-1] if build_output else "no build output")

    print("\nPASS/FAIL | CHECK | EVIDENCE")
    print("---|---|---")
    for name, passed, evidence in RESULTS:
        print(f"{'PASS' if passed else 'FAIL'} | {name} | {evidence}")
    failures = sum(not passed for _, passed, _ in RESULTS)
    print(f"\n{len(RESULTS) - failures}/{len(RESULTS)} checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())