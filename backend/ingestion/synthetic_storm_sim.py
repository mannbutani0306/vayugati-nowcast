"""Deterministic demo storm lifecycle used only when observation feeds are unavailable."""

import math
from datetime import datetime, timezone


def simulate_storm_cell(step: int = 0, cape_jkg: float = 1800.0, cin_jkg: float = -40.0, wind_850_kmh: float = 25.0):
    """Return initiation -> mature -> dissipate fixture state with explicit mode."""
    phase = (step % 12) / 11.0
    lifecycle = "INITIATION" if phase < 0.3 else "MATURE" if phase < 0.75 else "DISSIPATION"
    intensity = max(0.0, math.sin(math.pi * phase))
    return {
        "mode": "SIMULATED_DEMO_FIXTURE",
        "status": "SIMULATED",
        "source": "deterministic storm lifecycle; not an observation",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "lifecycle": lifecycle,
        "reflectivity_dbz": round(18.0 + intensity * min(48.0, 20.0 + cape_jkg / 180.0), 2),
        "cape_jkg": cape_jkg,
        "cin_jkg": cin_jkg,
        "wind_850_kmh": wind_850_kmh,
    }
