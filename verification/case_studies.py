"""Deterministic synthetic motion cases, not real radar reanalysis.

Each case has an explicit known ground-truth motion vector. Truth fields are
advected from the latest field for each lead, then perturbed with bounded
growth/decay noise to represent redevelopment without hiding the translation.
"""

import cv2
import numpy as np


def advect_frame(field: np.ndarray, speed_kmh: float, bearing_deg: float, lead_minutes: float) -> np.ndarray:
    """Translate a grid using meteorological bearing (0=north, 90=east)."""
    distance = speed_kmh * lead_minutes / 60.0
    dx = distance * np.sin(np.radians(bearing_deg))
    dy = -distance * np.cos(np.radians(bearing_deg))
    matrix = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(field.astype(np.float32), matrix, (field.shape[1], field.shape[0]), borderMode=cv2.BORDER_CONSTANT, borderValue=8.0)


def _storm_field(rng: np.random.Generator, size: int = 96, width_scale: float = 1.0) -> np.ndarray:
    y, x = np.mgrid[0:size, 0:size]
    field = np.full((size, size), 8.0, dtype=np.float32)
    for cx, cy, amplitude, width in ((25, 45, 58, 7 * width_scale), (45, 50, 48, 10 * width_scale), (68, 42, 38, 8 * width_scale)):
        field += amplitude * np.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * width ** 2)))
    return np.clip(field + rng.normal(0, 0.7, field.shape), 0, 75).astype(np.float32)


def synthetic_case_studies(seed: int = 26084):
    rng = np.random.default_rng(seed)
    specs = [
        ("Himachal monsoon cloudburst character", 6.0, 35.0, 2.5, "near-stationary orographic case; persistence should tie a correct nowcast"),
        ("Delhi-NCR pre-monsoon hail/dust-storm character", 45.0, 80.0, 1.0, "fast-moving organized pre-monsoon storm"),
        ("Chennai coastal squall-line character", 30.0, 110.0, 1.0, "moderate-fast organized coastal line"),
    ]
    cases = []
    for name, speed_kmh, bearing_deg, width_scale, expectation in specs:
        latest = _storm_field(rng, width_scale=width_scale)
        previous = advect_frame(latest, speed_kmh, bearing_deg, -10.0)
        cases.append({
            "name": name,
            "label": "SYNTHETIC_RECONSTRUCTION",
            "latest": latest,
            "previous": previous,
            "speed_kmh": speed_kmh,
            "bearing_deg": bearing_deg,
            "motion_expectation": expectation,
        })
    return cases


def truth_at_lead(case: dict, lead_minutes: int, seed: int) -> np.ndarray:
    """Create the known-motion truth field for one lead time."""
    truth = advect_frame(case["latest"], case["speed_kmh"], case["bearing_deg"], lead_minutes)
    rng = np.random.default_rng(seed)
    growth = 1.0 + 0.04 * np.sin(lead_minutes / 45.0)
    return np.clip(truth * growth + rng.normal(0, 1.2, truth.shape), 0, 75)
