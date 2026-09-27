"""Downburst gust proxy using reflectivity gradients and dense flow divergence."""

from typing import Any

import numpy as np

from . import HazardResult, compact, unavailable


def assess_downburst(
    reflectivity_dbz: Any,
    flow_u_kmh: Any = None,
    flow_v_kmh: Any = None,
    *,
    grid_spacing_km: float = 1.0,
    status: str = "AVAILABLE",
    source: str = "reflectivity grid and dense optical flow",
) -> HazardResult:
    """Estimate gust potential from echo gradients plus flow divergence.

    Operational downburst diagnosis needs Doppler radial velocity, thermodynamic
    profiles, and surface observations. Until those observations are configured,
    this equation is a documented heuristic proxy, not a verified gust retrieval.
    Flow components are in km/h; their spatial divergence is converted to min^-1.
    """
    if flow_u_kmh is None or flow_v_kmh is None:
        return unavailable(
            "downburst",
            "km/h gust proxy",
            "Dense optical-flow u/v fields are required; no live flow grid was supplied.",
            status="UNAVAILABLE",
            source=source,
        )
    if not np.isfinite(grid_spacing_km) or grid_spacing_km <= 0:
        raise ValueError("grid_spacing_km must be a positive finite number")

    reflectivity = np.asarray(reflectivity_dbz, dtype=float)
    flow_u = np.asarray(flow_u_kmh, dtype=float)
    flow_v = np.asarray(flow_v_kmh, dtype=float)
    if reflectivity.ndim != 2 or min(reflectivity.shape, default=0) < 2:
        raise ValueError("reflectivity_dbz must be a 2-D grid at least 2x2")
    if flow_u.shape != reflectivity.shape or flow_v.shape != reflectivity.shape:
        raise ValueError("flow u/v grids must match the reflectivity grid shape")

    grad_y, grad_x = np.gradient(reflectivity, grid_spacing_km)
    reflectivity_gradient = np.hypot(grad_x, grad_y)
    u_per_minute = flow_u / 60.0
    v_per_minute = flow_v / 60.0
    du_dy, du_dx = np.gradient(u_per_minute, grid_spacing_km)
    dv_dy, dv_dx = np.gradient(v_per_minute, grid_spacing_km)
    divergence_per_minute = du_dx + dv_dy
    gust = np.clip(
        20.0
        + 8.0 * reflectivity_gradient
        + 1200.0 * np.maximum(0.0, divergence_per_minute),
        0.0,
        160.0,
    )
    severity = np.select(
        [gust >= 110.0, gust >= 90.0, gust >= 70.0],
        [3, 2, 1],
        default=0,
    ).astype(int)
    return HazardResult(
        name="downburst",
        field=compact(gust),
        probability=None,
        severity=compact(severity),
        unit_label="km/h gust proxy",
        status=status,
        source=source,
        caveat="Heuristic proxy only; confirm with Doppler velocity and surface gust observations.",
        details={
            "reflectivity_gradient_dbz_per_km": compact(reflectivity_gradient),
            "flow_divergence_per_minute": compact(divergence_per_minute),
        },
    )