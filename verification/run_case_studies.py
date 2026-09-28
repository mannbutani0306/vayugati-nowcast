"""Run reproducible synthetic relative-skill checks against persistence."""

import json
from pathlib import Path

import numpy as np

from backend.nowcast.optical_flow_dense import dense_farneback_flow
from .case_studies import advect_frame, synthetic_case_studies, truth_at_lead
from .metrics import csi, far, fss, pod


def _mean_std(values):
    return {
        "mean": float(np.mean(values)) if values else 0.0,
        "std": float(np.std(values, ddof=1)) if len(values) > 1 else 0.0,
    }


def _score_fields(observed, predicted):
    scores = {
        "CSI": csi(observed, predicted, threshold=45.0),
        "POD": pod(observed, predicted, threshold=45.0),
        "FAR": far(observed, predicted, threshold=45.0),
    }
    for radius in (1, 3, 5, 10):
        scores[f"FSS_{radius}px"] = fss(observed, predicted, radius=radius, threshold=45.0)
    scores["FSS"] = scores["FSS_3px"]
    return scores


def _reliability_bins(observed, probability, bins=10):
    bin_indices = np.minimum((probability * bins).astype(int), bins - 1)
    counts = np.bincount(bin_indices.ravel(), minlength=bins)
    probability_sums = np.bincount(bin_indices.ravel(), weights=probability.ravel(), minlength=bins)
    observed_sums = np.bincount(bin_indices.ravel(), weights=observed.ravel(), minlength=bins)
    return counts, probability_sums, observed_sums


def main():
    output_dir = Path(__file__).resolve().parent
    leads = [15, 30, 60, 120, 180, 360]
    seed_count = 20
    trial_scores = {}
    motion_trials = {}
    reliability_totals = [np.zeros(10, dtype=float) for _ in range(3)]

    for seed_index in range(seed_count):
        cases = synthetic_case_studies(seed=26084 + seed_index)
        for case in cases:
            flow = dense_farneback_flow(
                case["previous"], case["latest"],
                minutes_between_frames=10.0, km_per_pixel=1.0,
            )
            flow_mask = np.asarray(flow["mask"], dtype=bool)
            flow_u = np.asarray(flow["u_kmh"], dtype=float)
            flow_v = np.asarray(flow["v_kmh"], dtype=float)
            estimated_u = float(np.median(flow_u[flow_mask])) if flow_mask.any() else 0.0
            estimated_v = float(np.median(flow_v[flow_mask])) if flow_mask.any() else 0.0
            estimated_speed = float(np.hypot(estimated_u, estimated_v))
            estimated_bearing = float((np.degrees(np.arctan2(estimated_u, estimated_v)) + 360.0) % 360.0)
            motion_trials.setdefault(case["name"], []).append((estimated_speed, estimated_bearing))

            for lead in leads:
                trial_seed = 26084 + seed_index * 1000 + lead
                observed = truth_at_lead(case, lead, seed=trial_seed)
                predicted_nowcast = advect_frame(case["latest"], estimated_speed, estimated_bearing, lead)
                predicted_persistence = case["latest"]
                nowcast_scores = _score_fields(observed, predicted_nowcast)
                persistence_scores = _score_fields(observed, predicted_persistence)
                key = (case["name"], lead)
                trial_scores.setdefault(key, {"nowcast": {}, "persistence": {}})
                for metric, score in nowcast_scores.items():
                    trial_scores[key]["nowcast"].setdefault(metric, []).append(score)
                for metric, score in persistence_scores.items():
                    trial_scores[key]["persistence"].setdefault(metric, []).append(score)

                # This reflectivity-to-probability transform is only a synthetic reliability diagnostic.
                probability = np.clip((predicted_nowcast - 35.0) / 20.0, 0.0, 1.0)
                counts, probability_sums, observed_sums = _reliability_bins(observed >= 45.0, probability)
                for total, values in zip(reliability_totals, (counts, probability_sums, observed_sums)):
                    total += values

    rows = []
    for (case_name, lead), models in sorted(trial_scores.items(), key=lambda item: (item[0][0], item[0][1])):
        rows.append({
            "case": case_name,
            "lead_minutes": lead,
            "seed_count": seed_count,
            "nowcast": {metric: _mean_std(values) for metric, values in models["nowcast"].items()},
            "persistence": {metric: _mean_std(values) for metric, values in models["persistence"].items()},
        })

    aggregate_by_lead = []
    for lead in leads:
        lead_rows = [row for row in rows if row["lead_minutes"] == lead]
        aggregate_by_lead.append({
            "lead_minutes": lead,
            "nowcast_CSI": _mean_std([row["nowcast"]["CSI"]["mean"] for row in lead_rows]),
            "persistence_CSI": _mean_std([row["persistence"]["CSI"]["mean"] for row in lead_rows]),
        })

    reliability = []
    counts, probability_sums, observed_sums = reliability_totals
    for index, count in enumerate(counts):
        reliability.append({
            "bin_lower": index / 10,
            "bin_upper": (index + 1) / 10,
            "count": int(count),
            "mean_probability": float(probability_sums[index] / count) if count else None,
            "observed_frequency": float(observed_sums[index] / count) if count else None,
        })

    motion_vectors = []
    cases = synthetic_case_studies(seed=26084)
    for case in cases:
        trials = np.asarray(motion_trials[case["name"]], dtype=float)
        motion_vectors.append({
            "case": case["name"],
            "ground_truth_speed_kmh": case["speed_kmh"],
            "ground_truth_bearing_deg": case["bearing_deg"],
            "estimated_speed_kmh": _mean_std(trials[:, 0].tolist()),
            "estimated_bearing_deg": _mean_std(trials[:, 1].tolist()),
            "expectation": case["motion_expectation"],
        })

    result = {
        "status": "SYNTHETIC_RECONSTRUCTIONS_ONLY",
        "relative_skill": True,
        "domain_km": [384, 384],
        "seed_count_per_case": seed_count,
        "leads_minutes": leads,
        "cases": rows,
        "aggregate_by_lead": aggregate_by_lead,
        "motion_vectors": motion_vectors,
        "reliability_probability_basis": "Synthetic reflectivity-to-probability transform; not calibrated model probability.",
        "reliability": reliability,
    }
    (output_dir / "results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")

    report = "# VayuGati Verification Report\n\n"
    report += "SYNTHETIC RECONSTRUCTIONS only; these are not real radar reanalysis or operational forecasts. Scores compare Farneback advection with a frozen persistence baseline. The domain is 384 x 384 km-equivalent pixels, and each case uses 20 deterministic random seeds.\n\n"
    report += "## 60-minute CSI (mean +/- standard deviation)\n\n| Case | Nowcast CSI | Persistence CSI | Nowcast POD | Nowcast FAR | FSS r=1 | FSS r=3 | FSS r=5 | FSS r=10 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n"
    for row in rows:
        if row["lead_minutes"] != 60:
            continue
        report += (
            f"| {row['case']} | {row['nowcast']['CSI']['mean']:.3f} +/- {row['nowcast']['CSI']['std']:.3f} "
            f"| {row['persistence']['CSI']['mean']:.3f} +/- {row['persistence']['CSI']['std']:.3f} "
            f"| {row['nowcast']['POD']['mean']:.3f} | {row['nowcast']['FAR']['mean']:.3f} "
            f"| {row['nowcast']['FSS_1px']['mean']:.3f} | {row['nowcast']['FSS_3px']['mean']:.3f} "
            f"| {row['nowcast']['FSS_5px']['mean']:.3f} | {row['nowcast']['FSS_10px']['mean']:.3f} |\n"
        )
    report += "\n## CSI by lead time (all-case mean +/- standard deviation)\n\n| Lead (min) | Nowcast CSI | Persistence CSI |\n|---:|---:|---:|\n"
    for row in aggregate_by_lead:
        report += f"| {row['lead_minutes']} | {row['nowcast_CSI']['mean']:.3f} +/- {row['nowcast_CSI']['std']:.3f} | {row['persistence_CSI']['mean']:.3f} +/- {row['persistence_CSI']['std']:.3f} |\n"
    report += "\n## Reliability diagram\n\nProbabilities are a synthetic reflectivity-threshold diagnostic, not calibrated ML probabilities.\n\n| Forecast probability | Samples | Observed frequency |\n|---|---:|---:|\n"
    for row in reliability:
        observed_frequency = "n/a" if row["observed_frequency"] is None else f"{row['observed_frequency']:.3f}"
        report += f"| {row['bin_lower']:.1f}-{row['bin_upper']:.1f} | {row['count']} | {observed_frequency} |\n"
    report += "\n![Synthetic reliability diagram](reliability_diagram.png)\n"
    report += "\n## Known limitations\n\n- Truth is synthetic and generated from prescribed motion/evolution; it is not observed weather.\n- The nowcast is advection-only and has no growth or decay physics; it can legitimately lose to persistence in decaying or growing cases.\n- Results are not operational skill estimates and do not replace radar-based independent verification.\n- The 384 x 384 km-equivalent test domain reduces domain-exit artifacts but does not represent a geographic projection.\n"
    (output_dir / "VERIFICATION_REPORT.md").write_text(report, encoding="utf-8")
    try:
        import matplotlib.pyplot as plt

        plotted = [row for row in reliability if row["mean_probability"] is not None]
        plt.figure(figsize=(5, 5))
        plt.plot([0.0, 1.0], [0.0, 1.0], linestyle="--", color="#64748b", label="Ideal")
        if plotted:
            plt.plot(
                [row["mean_probability"] for row in plotted],
                [row["observed_frequency"] for row in plotted],
                marker="o",
                color="#b91c1c",
                label="Synthetic forecast bins",
            )
        plt.xlabel("Mean synthetic forecast probability")
        plt.ylabel("Observed frequency")
        plt.title("Synthetic reliability diagram")
        plt.grid(alpha=0.2)
        plt.legend()
        plt.savefig(output_dir / "reliability_diagram.png", dpi=120, bbox_inches="tight")
        plt.close()
    except ImportError:
        pass
    print(json.dumps({
        "status": result["status"],
        "cases": len(cases),
        "seeds_per_case": seed_count,
        "lead_rows": len(rows),
        "domain_km": result["domain_km"],
    }))


if __name__ == "__main__":
    main()
