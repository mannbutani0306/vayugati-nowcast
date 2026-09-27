"""Hail probability heuristic for reflectivity/CAPE input fields."""

from typing import Any

import numpy as np

from . import HazardResult, compact


def assess_hail(
    reflectivity_dbz: Any,
    cape_jkg: Any,
    *,
    status: str = "AVAILABLE",
    source: str = "reflectivity and CAPE inputs",
) -> HazardResult:
    """Estimate hail probability from the requested heuristic.

    Reflectivity above 55 dBZ is used as a hail-core signature; CAPE supplies
    the buoyancy that can suspend hailstones in strong updrafts. This is a
    documented proxy, not a calibrated operational hail classifier.
    """
    reflectivity, cape = np.broadcast_arrays(
        np.asarray(reflectivity_dbz, dtype=float),
        np.asarray(cape_jkg, dtype=float),
    )
    logit = 0.25 * (reflectivity - 55.0) + 0.002 * cape - 1.2
    probability = 1.0 / (1.0 + np.exp(-np.clip(logit, -60.0, 60.0)))
    severity = np.select(
        [probability >= 0.80, probability >= 0.60, probability >= 0.35],
        [3, 2, 1],
        default=0,
    ).astype(int)
    return HazardResult(
        name="hail",
        field=compact(probability),
        probability=compact(probability),
        severity=compact(severity),
        unit_label="probability",
        status=status,
        source=source,
        caveat="Heuristic thresholds; not calibrated against a verified hail-observation dataset.",
        details={"logit": compact(logit)},
    )