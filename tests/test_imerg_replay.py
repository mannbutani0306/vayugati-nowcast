import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import h5py
import numpy as np

from backend.ingestion.imerg import read_imerg_frame


class ImergReplayTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.path = Path(self.temp_dir.name) / (
            "3B-HHR.MS.MRG.3IMERG.20100805-S000000-E002959.0000.V07B.HDF5"
        )
        with h5py.File(self.path, "w") as root:
            grid = root.create_group("Grid")
            grid.create_dataset("lat", data=np.array([30.0, 30.1, 30.2]))
            grid.create_dataset("lon", data=np.array([74.0, 74.1, 74.2]))
            dataset = grid.create_dataset(
                "precipitation",
                data=np.array([[[1.0, 2.0, 3.0], [4.0, -9999.9, 6.0], [7.0, 8.0, 9.0]]]),
            )
            dataset.attrs["Units"] = "mm/hr"
            dataset.attrs["_FillValue"] = -9999.9

    def tearDown(self):
        self.temp_dir.cleanup()

    @patch("backend.ingestion.imerg.discover_imerg_files")
    def test_returns_timestamped_json_safe_grid(self, discover_files):
        discover_files.return_value = [self.path]

        frame = read_imerg_frame("leh_2010_08_05", 0)

        self.assertEqual(frame["status"], "REAL_ARCHIVED")
        self.assertEqual(frame["timestamp_utc"], "2010-08-05T00:00:00+00:00")
        self.assertEqual(frame["units"], "mm/hr")
        self.assertEqual(frame["latitude"], [30.2, 30.1, 30.0])
        self.assertEqual(len(frame["precipitation_rate_mm_hr"]), 3)
        self.assertIsNone(frame["precipitation_rate_mm_hr"][1][1])

    @patch("backend.ingestion.imerg.discover_imerg_files")
    def test_rejects_out_of_range_frame(self, discover_files):
        discover_files.return_value = [self.path]

        with self.assertRaises(IndexError):
            read_imerg_frame("leh_2010_08_05", 1)

    @patch("backend.ingestion.imerg.discover_imerg_files")
    def test_reports_missing_archive_without_reading_a_file(self, discover_files):
        discover_files.return_value = []

        result = read_imerg_frame("leh_2010_08_05", 0)

        self.assertEqual(result["status"], "AWAITING REAL DATA")
        self.assertEqual(result["frames"], [])


if __name__ == "__main__":
    unittest.main()