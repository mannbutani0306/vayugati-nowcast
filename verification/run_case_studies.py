"""Run deterministic relative-skill checks against a persistence baseline."""

import json
from pathlib import Path

import numpy as np

from backend.nowcast.optical_flow_dense import dense_farneback_flow
from .case_studies import advect_frame, synthetic_case_studies, truth_at_lead
from .metrics import brier_score, csi, far, fss, pod, reliability_diagram


def main():
    output_dir = Path(__file__).resolve().parent
    leads = [15, 30, 60, 180, 360]
    rows = []
    all_obs = []
    all_prob = []
    cases = synthetic_case_studies()
    motion_vectors = []
    for case in cases:
        flow = dense_farneback_flow(case["previous"], case["latest"], minutes_between_frames=10.0, km_per_pixel=1.0)
        flow_mask = np.asarray(flow["mask"], dtype=bool)
        estimated_u = float(np.median(np.asarray(flow["u_kmh"])[flow_mask])) if flow_mask.any() else 0.0
        estimated_v = float(np.median(np.asarray(flow["v_kmh"])[flow_mask])) if flow_mask.any() else 0.0
        estimated_speed = float(np.hypot(estimated_u, estimated_v))
        estimated_bearing = float((np.degrees(np.arctan2(estimated_u, estimated_v)) + 360.0) % 360.0)
        for lead in leads:
            decay = np.exp(-lead / 240.0)
            truth = truth_at_lead(case, lead, seed=26084 + lead)
            predicted_field = advect_frame(case["latest"], estimated_speed, estimated_bearing, lead)
            observed = truth >= 45.0
            persistence = case["latest"] >= 45.0
            nowcast = predicted_field >= 45.0
            probability = np.where(nowcast, 0.75 * decay + 0.15, 0.10)
            rows.append({"case": case["name"], "lead_minutes": lead, "nowcast": {"CSI": csi(observed, nowcast), "POD": pod(observed, nowcast), "FAR": far(observed, nowcast), "FSS": fss(observed, nowcast)}, "persistence": {"CSI": csi(observed, persistence), "POD": pod(observed, persistence), "FAR": far(observed, persistence)}})
            all_obs.extend(observed.ravel().astype(float))
            all_prob.extend(probability.ravel())
        case["estimated_speed_kmh"] = estimated_speed
        case["estimated_bearing_deg"] = estimated_bearing
        motion_vectors.append({"case": case["name"], "ground_truth_speed_kmh": case["speed_kmh"], "ground_truth_bearing_deg": case["bearing_deg"], "estimated_speed_kmh": estimated_speed, "estimated_bearing_deg": estimated_bearing, "expectation": case["motion_expectation"]})
    result = {"status": "SYNTHETIC_RECONSTRUCTIONS_ONLY", "relative_skill": True, "leads_minutes": leads, "cases": rows, "motion_vectors": motion_vectors, "brier_score": brier_score(all_obs, all_prob), "reliability": reliability_diagram(all_obs, all_prob)}
    (output_dir / "results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    lead_rows = [row for row in rows if row["lead_minutes"] == 60]
    report = "# VayuGati Verification Report\n\nSYNTHETIC RECONSTRUCTIONS informed by real Indian convective-event character; not real radar reanalysis. Scores measure relative skill against persistence. Farneback estimates motion from consecutive synthetic frames.\n\n## Motion vectors\n\n| Case | Truth speed | Truth bearing | Estimated speed | Estimated bearing |\n|---|---:|---:|---:|---:|\n"
    report += "\n".join(f"| {item['case']} | {item['ground_truth_speed_kmh']:.1f} km/h | {item['ground_truth_bearing_deg']:.1f}° | {item['estimated_speed_kmh']:.1f} km/h | {item['estimated_bearing_deg']:.1f}° |" for item in result["motion_vectors"])
    report += "\n\n## 60-minute skill\n\n| Case | Nowcast CSI | Persistence CSI | Nowcast POD | Nowcast FAR |\n|---|---:|---:|---:|---:|\n"
    report += "\n".join(f"| {row['case']} | {row['nowcast']['CSI']:.3f} | {row['persistence']['CSI']:.3f} | {row['nowcast']['POD']:.3f} | {row['nowcast']['FAR']:.3f} |" for row in lead_rows)
    (output_dir / "VERIFICATION_REPORT.md").write_text(report + "\n", encoding="utf-8")
    try:
        import matplotlib.pyplot as plt
        reliability = [row for row in result["reliability"] if row["mean_probability"] is not None]
        plt.plot([row["mean_probability"] for row in reliability], [row["observed_frequency"] for row in reliability], marker="o")
        plt.plot([0, 1], [0, 1], linestyle="--")
        plt.xlabel("Mean forecast probability"); plt.ylabel("Observed frequency"); plt.title("Synthetic reliability diagram")
        plt.savefig(output_dir / "reliability_diagram.png", dpi=120, bbox_inches="tight"); plt.close()
    except ImportError:
        pass
    print(json.dumps({"status": result["status"], "cases": len(rows), "brier_score": result["brier_score"]}))


if __name__ == "__main__":
    main()
