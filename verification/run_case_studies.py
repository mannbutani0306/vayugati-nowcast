"""Run deterministic relative-skill checks against a persistence baseline."""

import json
from pathlib import Path

import numpy as np

from .case_studies import synthetic_case_studies
from .metrics import brier_score, csi, far, fss, pod, reliability_diagram


def main():
    output_dir = Path(__file__).resolve().parent
    leads = [15, 30, 60, 180, 360]
    rows = []
    all_obs = []
    all_prob = []
    for case in synthetic_case_studies():
        observed = case["observed"] >= 45.0
        persistence = case["latest"] >= 45.0
        for lead in leads:
            decay = np.exp(-lead / 240.0)
            nowcast = np.roll(case["latest"], max(1, lead // 30), axis=1) >= 45.0
            probability = np.where(nowcast, 0.75 * decay + 0.15, 0.10)
            rows.append({"case": case["name"], "lead_minutes": lead, "nowcast": {"CSI": csi(observed, nowcast), "POD": pod(observed, nowcast), "FAR": far(observed, nowcast), "FSS": fss(observed, nowcast)}, "persistence": {"CSI": csi(observed, persistence), "POD": pod(observed, persistence), "FAR": far(observed, persistence)}})
            all_obs.extend(observed.ravel().astype(float))
            all_prob.extend(probability.ravel())
    result = {"status": "SYNTHETIC_RECONSTRUCTIONS_ONLY", "relative_skill": True, "leads_minutes": leads, "cases": rows, "brier_score": brier_score(all_obs, all_prob), "reliability": reliability_diagram(all_obs, all_prob)}
    (output_dir / "results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    lead_rows = [row for row in rows if row["lead_minutes"] == 60]
    report = "# VayuGati Verification Report\n\nSYNTHETIC RECONSTRUCTIONS informed by real Indian convective-event character; not real radar reanalysis. Scores measure relative skill against persistence.\n\n| Case | Nowcast CSI | Persistence CSI | Nowcast POD | Nowcast FAR |\n|---|---:|---:|---:|---:|\n"
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
