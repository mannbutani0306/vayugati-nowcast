import asyncio
import unittest
from unittest.mock import AsyncMock, patch

import numpy as np

from backend.nowcast_engine import _demo_reflectivity_grid, compute_hazard_heads, get_hazard_heads


class HazardFlowTests(unittest.TestCase):
    def assert_nonzero_divergence(self, result):
        divergence = np.asarray(
            result["downburst"]["details"]["flow_divergence_per_minute"],
            dtype=float,
        )
        self.assertGreater(float(np.std(divergence)), 0.0)

    def test_fusion_grid_hazard_uses_dense_flow(self):
        previous = _demo_reflectivity_grid(45.0, offset_km=(-2.0, 1.0))
        current = _demo_reflectivity_grid(45.0)
        result = compute_hazard_heads(
            34.1,
            77.3,
            45.0,
            1200.0,
            0.0,
            reflectivity_frames_dbz=[previous, current],
        )
        self.assert_nonzero_divergence(result)

    def test_standalone_endpoint_synthesizes_dense_flow(self):
        with patch(
            "backend.nowcast_engine.get_lightning_feed",
            new=AsyncMock(return_value={"metadata": {"status": "OFFLINE"}, "features": []}),
        ):
            result = asyncio.run(
                get_hazard_heads(
                    lat=34.1,
                    lon=77.3,
                    reflectivity_dbz=45.0,
                    cape_jkg=1200.0,
                    lightning_rate_per_min=0.0,
                    speed_kmh=20.0,
                    bearing_deg=45.0,
                    accumulation_mm=None,
                    window_hours=None,
                    month=None,
                    climatology_mean_mm=None,
                    climatology_sd_mm=None,
                )
            )
        self.assert_nonzero_divergence(result)


if __name__ == "__main__":
    unittest.main()