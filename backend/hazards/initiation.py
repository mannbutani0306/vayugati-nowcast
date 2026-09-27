"""Minimal convective initiation detector from short reflectivity histories."""

from datetime import datetime, timezone
from typing import Any, Sequence

import numpy as np


def detect_initiation(reflectivity_frames_dbz: Sequence[Any], cloud_top_cooling_rate_c_per_15m: float, threshold_dbz: float = 35.0):
    """Find cells crossing 35 dBZ for the first time with rapid cooling.

    A cooling rate more negative than about -4 C/15 min is a documented
    rapid-development satellite proxy; this remains a heuristic until INSAT
    calibrated cloud-top retrievals and cell tracking are configured.
    """
    if len(reflectivity_frames_dbz) < 3:
        raise ValueError("at least three reflectivity frames are required")
    frames = np.stack([np.asarray(frame, dtype=float) for frame in reflectivity_frames_dbz])
    if frames.ndim != 3 or any(frame.shape != frames[0].shape for frame in frames):
        raise ValueError("reflectivity frames must be matching 2-D grids")
    crossed = (frames[-1] >= threshold_dbz) & np.all(frames[:-1] < threshold_dbz, axis=0)
    eligible = crossed & (float(cloud_top_cooling_rate_c_per_15m) <= -4.0)
    rows, cols = np.where(eligible)
    return {
        "status": "HEURISTIC_DETECTION",
        "threshold_dbz": threshold_dbz,
        "cooling_rate_c_per_15m": float(cloud_top_cooling_rate_c_per_15m),
        "rapid_cooling_gate": float(cloud_top_cooling_rate_c_per_15m) <= -4.0,
        "detections": [
            {"row": int(row), "column": int(column), "reflectivity_dbz": float(frames[-1, row, column]), "first_detected_at": datetime.now(timezone.utc).isoformat()}
            for row, column in zip(rows, cols)
        ],
    }
