"""Marshall-Palmer rain-rate and 60-minute persistence heuristic."""

from typing import Any, Sequence

import numpy as np

from . import HazardResult, compact, unavailable


def reflectivity_to_rain_rate(reflectivity_dbz: Any) -> np.ndarray:
    """Convert dBZ to mm/h with Z=200 R^1.6."""
    reflectivity = np.asarray(reflectivity_dbz, dtype=float)
    linear_z = np.power(10.0, reflectivity / 10.0)
    return np.power(linear_z / 200.0, 1.0 / 1.6)


def assess_cloudburst(
    reflectivity_frames_dbz: Sequence[Any] | None,
    *,
    status: str = "AVAILABLE",
    source: str = "four 15-minute reflectivity frames",
) -> HazardResult:
    """Compute peak rain rate and fraction of four steps at >=100 mm/h.

    The four frames must represent successive 15-minute observations. A single
    reflectivity image cannot establish 60-minute persistence and is not expanded
    into invented history.
    """
    if reflectivity_frames_dbz is None or len(reflectivity_frames_dbz) < 4:
        return unavailable(
            "cloudburst",
            "mm/h and 60-minute sustained fraction",
            "Four consecutive 15-minute reflectivity frames are required; no time series was supplied.",
            status="UNAVAILABLE",
            source=source,
        )

    frames = [np.asarray(frame, dtype=float) for frame in reflectivity_frames_dbz[-4:]]
    if any(frame.shape != frames[0].shape for frame in frames):
        raise ValueError("all cloudburst reflectivity frames must have the same shape")
    if any(frame.ndim not in (0, 2) for frame in frames):
        raise ValueError("reflectivity frames must be scalars or 2-D grids")

    rain_rates = np.stack([reflectivity_to_rain_rate(frame) for frame in frames])
    sustained_fraction = np.mean(rain_rates >= 100.0, axis=0)
    peak_rain_rate = np.max(rain_rates, axis=0)
    severity = np.select(
        [sustained_fraction > 0.60, sustained_fraction > 0.35],
        [3, 2],
        default=0,
    ).astype(int)
    return HazardResult(
        name="cloudburst",
        field=compact(peak_rain_rate),
        probability=compact(sustained_fraction),
        severity=compact(severity),
        unit_label="peak rain rate mm/h",
        status=status,
        source=source,
        caveat="Marshall-Palmer Z-R relation is an approximate rainfall retrieval and requires local calibration.",
        details={
            "peak_rain_rate_mm_hr": compact(peak_rain_rate),
            "sustained_fraction_60m": compact(sustained_fraction),
            "rain_rate_frames_mm_hr": compact(rain_rates),
            "threshold_mm_hr": 100.0,
        },
    )