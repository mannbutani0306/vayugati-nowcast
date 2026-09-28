import asyncio
import unittest
from unittest.mock import AsyncMock, patch

import numpy as np

from backend.nowcast_engine import (
    _demo_reflectivity_grid,
    compute_hazard_heads,
    generate_forecast_track_cones,
    get_live_fusion_grid,
    get_hazard_heads,
)


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

    def test_scenario_track_cones_cover_six_hour_horizon(self):
        cones = generate_forecast_track_cones(30.3, 78.0, 30.0, 45.0)
        self.assertEqual(cones[-1]["lead_time_minutes"], 360)
        self.assertAlmostEqual(cones[-1]["advection_distance_km"], 180.0)

    def test_scenario_track_rejects_lead_times_beyond_six_hours(self):
        with self.assertRaises(ValueError):
            generate_forecast_track_cones(30.3, 78.0, 30.0, 45.0, [361])

    def test_fusion_grid_exposes_six_hour_scenario_horizon(self):
        payload = get_live_fusion_grid(
            min_lat=6.0,
            min_lon=68.0,
            max_lat=38.0,
            max_lon=98.0,
            include_display_grid=False,
            decimate=2,
        )
        self.assertEqual(payload["data_mode"], "DEMO_FIXTURE")
        self.assertEqual(payload["metadata"]["lead_times_included"][-1], 360)
        self.assertEqual(payload["metadata"]["forecast_horizon_status"], "SCENARIO_EXTRAPOLATION_ONLY")

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