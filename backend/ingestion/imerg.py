"""Local-only reader for archived GPM IMERG V07 half-hourly HDF5 files."""

from __future__ import annotations

import os
import re
import csv
import calendar
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import h5py
import numpy as np
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")
DATA_DIR = Path(os.getenv("DATA_DIR", str(PROJECT_ROOT / "data"))).resolve()
CASE_DIRECTORIES = {
    "leh_2010_08_05": DATA_DIR / "imerg_halfhourly" / "leh_2010_08_05",
    "leh_2011_07_25": DATA_DIR / "imerg_halfhourly" / "leh_2011_07_25",
}
TIME_PATTERN = re.compile(r"3IMERG\.(\d{8})-S(\d{6})")
FILL_VALUE = -9999.9
AWAITING_INSTRUCTIONS = (
    "Place GPM_3IMERGHH V07 HDF5 subsets in data/imerg_halfhourly/leh_2010_08_05/ "
    "and data/imerg_halfhourly/leh_2011_07_25/. No archived-data network download is attempted."
)


def parse_imerg_timestamp(path: Path) -> datetime:
    match = TIME_PATTERN.search(path.name)
    if not match:
        raise ValueError(f"Could not parse IMERG UTC timestamp from filename: {path.name}")
    return datetime.strptime("".join(match.groups()), "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)


def discover_imerg_files(case_id: str) -> list[Path]:
    if case_id not in CASE_DIRECTORIES:
        raise ValueError(f"Unknown IMERG case directory: {case_id}")
    directory = CASE_DIRECTORIES[case_id]
    return sorted(
        (path for path in directory.glob("*.HDF5") if TIME_PATTERN.search(path.name)),
        key=parse_imerg_timestamp,
    )


def imerg_inventory(case_id: str) -> dict[str, Any]:
    paths = discover_imerg_files(case_id)
    return {
        "case_id": case_id,
        "source": "NASA GPM IMERG V07",
        "source_url": "https://gpm.nasa.gov/data/imerg",
        "files_found": len(paths),
        "first_timestamp_utc": parse_imerg_timestamp(paths[0]).isoformat() if paths else None,
        "last_timestamp_utc": parse_imerg_timestamp(paths[-1]).isoformat() if paths else None,
        "status": "REAL_ARCHIVED" if paths else "AWAITING REAL DATA",
        "files": [path.name for path in paths],
    }
def read_imerg_case(
    case_id: str,
    bounds: tuple[float, float, float, float] = (30.0, 74.0, 36.0, 82.0),
) -> dict[str, Any]:
    """Read actual rate fields in mm/h and coordinate-derived pixel dimensions."""
    paths = discover_imerg_files(case_id)
    inventory = imerg_inventory(case_id)
    if not paths:
        return {**inventory, "frames": [], "instructions": AWAITING_INSTRUCTIONS}

    min_lat, min_lon, max_lat, max_lon = bounds
    frames = []
    reference_lat = reference_lon = None
    fill_values = {-9999.9, -9999.0}
    for path in paths:
        with h5py.File(path, "r") as root:
            if "Grid/precipitation" not in root or "Grid/lat" not in root or "Grid/lon" not in root:
                raise ValueError(f"{path.name} does not contain inspected IMERG Grid precipitation/lat/lon variables")
            rate_dataset = root["Grid/precipitation"]
            lat = np.asarray(root["Grid/lat"][:], dtype=float)
            lon = np.asarray(root["Grid/lon"][:], dtype=float)
            if rate_dataset.attrs.get("Units", b"").decode("ascii", "ignore") != "mm/hr":
                units = rate_dataset.attrs.get("Units", rate_dataset.attrs.get("units", b""))
                if isinstance(units, bytes):
                    units = units.decode("ascii", "ignore")
                if units != "mm/hr":
                    raise ValueError(f"Unexpected precipitation units in {path.name}: {units!r}")
            lat_indices = np.flatnonzero((lat >= min_lat) & (lat <= max_lat))
            lon_indices = np.flatnonzero((lon >= min_lon) & (lon <= max_lon))
            if not lat_indices.size or not lon_indices.size:
                raise ValueError(f"Requested bounds are outside the coordinate coverage in {path.name}")
            raw = np.asarray(
                rate_dataset[
                    0,
                    lon_indices.min():lon_indices.max() + 1,
                    lat_indices.min():lat_indices.max() + 1,
                ],
                dtype=np.float32,
            ).T[::-1, :]
            fill = rate_dataset.attrs.get("_FillValue", FILL_VALUE)
            if isinstance(fill, np.ndarray):
                fill = float(fill.item())
            mask = ~np.isfinite(raw) | (raw == float(fill))
            for known_fill in fill_values:
                mask |= raw == known_fill
            rate = raw.copy()
            rate[mask] = np.nan
            frames.append({
                "timestamp_utc": parse_imerg_timestamp(path).isoformat(),
                "source_file": path.name,
                "precipitation_rate_mm_hr": rate,
                "valid_mask": ~mask,
            })
            reference_lat = lat[lat_indices.min():lat_indices.max() + 1][::-1]
            reference_lon = lon[lon_indices.min():lon_indices.max() + 1]

    lat_step = float(np.median(np.abs(np.diff(reference_lat))))
    lon_step = float(np.median(np.abs(np.diff(reference_lon))))
    mean_lat = float(np.mean(reference_lat))
    return {
        **inventory,
        "status": "REAL_ARCHIVED",
        "frames_loaded": len(frames),
        "frame_shape": list(frames[0]["precipitation_rate_mm_hr"].shape),
        "bounds": {"min_lat": min_lat, "min_lon": min_lon, "max_lat": max_lat, "max_lon": max_lon},
        "latitude": reference_lat,
        "longitude": reference_lon,
        "km_per_pixel": {
            "east_west": lon_step * 111.32 * float(np.cos(np.deg2rad(mean_lat))),
            "north_south": lat_step * 111.32,
            "mean": (lon_step * 111.32 * float(np.cos(np.deg2rad(mean_lat))) + lat_step * 111.32) / 2.0,
            "method": "0.1-degree coordinate spacing; longitude scaled by cosine of mean latitude.",
        },
        "units": "mm/hr",
        "variable": "Grid/precipitation",
        "coordinate_variables": ["Grid/lat", "Grid/lon"],
        "data_status": "REAL_ARCHIVED",
        "frames": frames,
    }


def read_monthly_context() -> dict[str, Any]:
    """Parse the local Giovanni monthly-rate CSV for context only, never nowcasting."""
    path = DATA_DIR / "imerg_monthly" / "monthly_mean.csv"
    region_label = os.getenv("IMERG_MONTHLY_REGION_LABEL", "UNVERIFIED - confirm shape in Giovanni")
    if not path.exists():
        return {
            "status": "AWAITING REAL DATA",
            "source": "IMERG monthly Giovanni CSV",
            "source_url": "https://gpm.nasa.gov/data/imerg",
            "region_label": region_label,
            "monthly_context": [],
            "instructions": "Place the Giovanni monthly export at data/imerg_monthly/monthly_mean.csv.",
            "usage": "Context only - not a nowcast input.",
        }

    lines = path.read_text(encoding="utf-8-sig").splitlines()
    if len(lines) <= 8:
        return {
            "status": "AWAITING REAL DATA",
            "source": "IMERG monthly Giovanni CSV",
            "source_url": "https://gpm.nasa.gov/data/imerg",
            "region_label": region_label,
            "monthly_context": [],
            "instructions": "The local CSV has no rows after the eight-line Giovanni preamble.",
            "usage": "Context only - not a nowcast input.",
        }
    preamble = {}
    for line in lines[:8]:
        key, separator, value = line.partition(",")
        if separator:
            preamble[key.strip().rstrip(":")] = value.strip().strip('"')
    reader = csv.DictReader(lines[8:], skipinitialspace=True)
    expected_column = "mean_GPM_3IMERGM_07_precipitation"
    if not reader.fieldnames or "time" not in reader.fieldnames or expected_column not in reader.fieldnames:
        raise ValueError(f"Unexpected Giovanni monthly CSV columns: {reader.fieldnames}")

    monthly_values: dict[int, list[float]] = {month: [] for month in range(1, 13)}
    annual_values: dict[int, dict[int, float]] = {}
    count = 0
    fill_value = float(preamble.get("Fill Value (mean_GPM_3IMERGM_07_precipitation)", -9999.9))
    for row in reader:
        try:
            rate = float(row[expected_column])
            timestamp = datetime.strptime(row["time"].strip(), "%Y-%m-%d %H:%M:%S")
        except (TypeError, ValueError):
            continue
        if not np.isfinite(rate) or np.isclose(rate, fill_value):
            continue
        total_mm = rate * 24.0 * calendar.monthrange(timestamp.year, timestamp.month)[1]
        monthly_values[timestamp.month].append(total_mm)
        annual_values.setdefault(timestamp.year, {})[timestamp.month] = total_mm
        count += 1

    climatology = [
        {
            "month": month,
            "month_name": calendar.month_abbr[month],
            "mean_precipitation_mm": float(np.mean(monthly_values[month])) if monthly_values[month] else None,
            "valid_year_count": len(monthly_values[month]),
            "status": "REAL_ARCHIVED",
        }
        for month in range(1, 13)
    ]
    jjas_totals = [value for year in annual_values.values() for month, value in year.items() if month in (6, 7, 8, 9)]
    other_totals = [value for year in annual_values.values() for month, value in year.items() if month not in (6, 7, 8, 9)]
    jjas_mean = float(np.mean(jjas_totals)) if jjas_totals else None
    other_mean = float(np.mean(other_totals)) if other_totals else None
    return {
        "status": "REAL_ARCHIVED",
        "source": "GPM IMERG 3IMERGM V07 via NASA Giovanni",
        "source_url": "https://gpm.nasa.gov/data/imerg",
        "giovanni_reproduction_url": preamble.get("URL to Reproduce Results"),
        "region_label": region_label,
        "region_status": "UNVERIFIED - confirm shape in Giovanni" if region_label.startswith("UNVERIFIED") else "CONFIGURED",
        "input_filename": path.name,
        "input_row_count": count,
        "input_units": "mm/hr monthly-mean rate",
        "conversion": "monthly-mean rate x 24 hours x calendar days in month = mm/month",
        "monthly_context": climatology,
        "jjas_mean_month_mm": jjas_mean,
        "non_jjas_mean_month_mm": other_mean,
        "jjas_vs_rest_ratio": jjas_mean / other_mean if jjas_mean is not None and other_mean else None,
        "usage": "Seasonal context only - not a nowcast input and not radar data.",
    }