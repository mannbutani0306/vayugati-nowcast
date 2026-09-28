import unittest

from backend.hazards.rain_anomaly import assess_rain_anomaly


class RainAnomalyTests(unittest.TestCase):
    def test_leh_2010_satellite_estimate_triggers_anomaly_not_fixed_rate(self):
        result = assess_rain_anomaly(40.0, 3.0, 8, 15.0, 16.7, status="DOCUMENTED_CASE")
        self.assertTrue(result["triggered"])
        self.assertFalse(result["fixed_threshold_comparison"]["triggered"])
        self.assertAlmostEqual(result["rate_mm_hr"], 13.333333, places=5)
        self.assertAlmostEqual(result["exceedance_ratio"], 40 / 15)

    def test_leh_2011_anomaly_can_trigger_without_reported_impact(self):
        result = assess_rain_anomaly(40.0, 6.0, 7, 12.6, 12.1, status="DOCUMENTED_CASE")
        self.assertEqual(result["class"], "EXTREME")
        self.assertTrue(result["triggered"])
        self.assertFalse(result["fixed_threshold_comparison"]["triggered"])

    def test_normal_accumulation_does_not_trigger(self):
        result = assess_rain_anomaly(10.0, 6.0, 7, 12.6, 12.1)
        self.assertEqual(result["class"], "NORMAL")
        self.assertFalse(result["triggered"])


if __name__ == "__main__":
    unittest.main()