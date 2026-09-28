import unittest

import numpy as np

from backend.hazards.initiation import detect_initiation


class InitiationTests(unittest.TestCase):
    def test_new_35_dbz_crossing_with_rapid_cooling_is_detected(self):
        frames = [np.full((2, 2), value) for value in (20.0, 26.0, 32.0)]
        frames.append(np.array([[36.0, 20.0], [20.0, 20.0]]))
        result = detect_initiation(frames, -4.0)
        self.assertEqual([(item["row"], item["column"]) for item in result["detections"]], [(0, 0)])

    def test_crossing_without_rapid_cooling_is_not_detected(self):
        frames = [np.full((2, 2), value) for value in (20.0, 26.0, 32.0)]
        frames.append(np.array([[36.0, 20.0], [20.0, 20.0]]))
        self.assertFalse(detect_initiation(frames, -3.9)["detections"])

    def test_preexisting_cell_is_not_detected_as_new(self):
        frames = [np.full((2, 2), value) for value in (36.0, 37.0, 38.0, 39.0)]
        self.assertFalse(detect_initiation(frames, -8.0)["detections"])


if __name__ == "__main__":
    unittest.main()