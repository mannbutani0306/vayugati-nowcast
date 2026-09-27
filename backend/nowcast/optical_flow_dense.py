"""Dense Farneback optical flow for reflectivity-grid advection."""

from typing import Any, Dict

import numpy as np

try:
    import cv2
except ImportError:  # Keep the legacy API importable before optional deps install.
    cv2 = None


def dense_farneback_flow(
    previous_reflectivity: Any,
    current_reflectivity: Any,
    *,
    minutes_between_frames: float = 10.0,
    km_per_pixel: float = 1.0,
    clear_air_threshold_dbz: float = 18.0,
) -> Dict[str, Any]:
    """Return masked u/v fields in km/h and derived speed/bearing fields.

    Farneback estimates image motion, not Doppler wind. Clear-air pixels are
    masked because texture noise there is not a convective echo motion signal.
    """
    previous = np.asarray(previous_reflectivity, dtype=np.float32)
    current = np.asarray(current_reflectivity, dtype=np.float32)
    if previous.ndim != 2 or current.shape != previous.shape or min(previous.shape) < 2:
        raise ValueError("reflectivity frames must be matching 2-D grids at least 2x2")
    if minutes_between_frames <= 0 or km_per_pixel <= 0:
        raise ValueError("frame interval and km_per_pixel must be positive")
    if cv2 is None:
        raise RuntimeError("opencv-python-headless is required for dense optical flow")

    def normalize(frame: np.ndarray) -> np.ndarray:
        return np.clip((frame - clear_air_threshold_dbz) * 4.0, 0.0, 255.0).astype(np.uint8)

    flow_pixels = cv2.calcOpticalFlowFarneback(
        normalize(previous), normalize(current), None,
        pyr_scale=0.5, levels=3, winsize=15, iterations=3,
        poly_n=5, poly_sigma=1.2, flags=0,
    )
    scale = km_per_pixel * 60.0 / minutes_between_frames
    u_kmh = flow_pixels[..., 0] * scale
    v_kmh = -flow_pixels[..., 1] * scale
    mask = (previous >= clear_air_threshold_dbz) | (current >= clear_air_threshold_dbz)
    u_kmh = np.where(mask, u_kmh, 0.0)
    v_kmh = np.where(mask, v_kmh, 0.0)
    speed = np.hypot(u_kmh, v_kmh)
    bearing = (np.degrees(np.arctan2(u_kmh, v_kmh)) + 360.0) % 360.0
    return {
        "u_kmh": u_kmh.tolist(),
        "v_kmh": v_kmh.tolist(),
        "speed_kmh": speed.tolist(),
        "bearing_deg": bearing.tolist(),
        "mask": mask.tolist(),
        "metadata": {
            "algorithm": "Farneback dense optical flow",
            "mode": "DERIVED_FROM_REFLECTIVITY",
            "clear_air_threshold_dbz": clear_air_threshold_dbz,
            "minutes_between_frames": minutes_between_frames,
            "km_per_pixel": km_per_pixel,
        },
    }
