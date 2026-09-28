"""MOSDAC/INSAT infrared feed metadata and local archived TIR1 scenes."""

import base64
import io
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.warp import transform, transform_bounds
from dotenv import load_dotenv

PUBLIC_INSAT_IR_URL = "https://mausam.imd.gov.in/Satellite/3Dasiasec_ir1.jpg"
MOSDAC_GALLERY_URL = "https://mosdac.gov.in/gallery/index.html?prod=3SIMG_%27%2A_L1B_STD_IR1.jpg"
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
LOCAL_TIR_DIR = Path(os.getenv("MOSDAC_TIR_LOCAL_DIR", str(Path(os.getenv("DATA_DIR", "./data")) / "mosdac")))
LOCAL_SCENE_PATTERN = re.compile(
    r"3RIMG_(\d{2}[A-Z]{3}\d{4})_(\d{4})_L1C_ASIA_MER_.*_IMG_TIR1\.tif$",
    re.IGNORECASE,
)


def _parse_bounds(raw: str) -> Optional[list]:
    try:
        south, west, north, east = (float(value.strip()) for value in raw.split(","))
        if not (-90 <= south < north <= 90 and -180 <= west < east <= 180):
            return None
        return [[south, west], [north, east]]
    except (TypeError, ValueError):
        return None


def _offline(reason: str, started_at: float) -> Dict[str, Any]:
    return {
        "status": "UNCONFIGURED" if reason.startswith("Configure ") else "OFFLINE",
        "source": "MOSDAC INSAT-3D/3DR TIR1",
        "mode": "UNAVAILABLE",
        "reason": reason,
        "image_url": PUBLIC_INSAT_IR_URL,
        "gallery_url": MOSDAC_GALLERY_URL,
        "latency_ms": round((time.perf_counter() - started_at) * 1000),
    }


def _scene_time(path: Path) -> Optional[datetime]:
    match = LOCAL_SCENE_PATTERN.match(path.name)
    if not match:
        return None
    return datetime.strptime("".join(match.groups()).upper(), "%d%b%Y%H%M").replace(tzinfo=timezone.utc)


def get_local_real_scene() -> Dict[str, Any]:
    """Inspect local TIR1 scenes without interpreting undeclared raw values as BT."""
    scenes = sorted(
        ((timestamp, path) for path in LOCAL_TIR_DIR.glob("3RIMG_*_L1C_ASIA_MER_*_IMG_TIR1.tif")
         if (timestamp := _scene_time(path)) is not None),
        key=lambda item: item[0],
    )
    calibration_files = sorted(LOCAL_TIR_DIR.glob("3RIMG_*.h5")) + sorted(LOCAL_TIR_DIR.glob("3RIMG_*.H5"))
    inventory = {
        "status": "REAL_ARCHIVED - INSAT-3DR L1C TIR1" if scenes else "AWAITING REAL DATA",
        "source": "INSAT-3DR L1C TIR1",
        "source_url": "https://mosdac.gov.in/",


        "directory": str(LOCAL_TIR_DIR),
        "scene_count": len(scenes),
        "first_scene_time_utc": scenes[0][0].isoformat() if scenes else None,
        "last_scene_time_utc": scenes[-1][0].isoformat() if scenes else None,
        "scene_files": [path.name for _, path in scenes],
        "calibration_files": [path.name for path in calibration_files],
    }
    if not scenes:
        return {
            **inventory,
            "message": "AWAITING REAL DATA: place authorized 3RIMG_*_L1C_ASIA_MER_*_IMG_TIR1.tif scenes in the configured local MOSDAC directory.",
            "brightness_temperature_c": None,
            "cold_area_fractions": {str(value): None for value in (-20, -30, -40, -50, -60)},
            "analysis_status": "AWAITING REAL DATA",
        }

    latest_time, latest_path = scenes[-1]
    with rasterio.open(latest_path) as dataset:
        raster = dataset.read(1, masked=True)
        values = raster.compressed()
        bounds = transform_bounds(dataset.crs, "EPSG:4326", *dataset.bounds, densify_pts=21) if dataset.crs else None
        scale = min(1.0, 256.0 / max(dataset.width, dataset.height))
        preview_shape = (max(1, round(dataset.height * scale)), max(1, round(dataset.width * scale)))
        preview = dataset.read(1, out_shape=preview_shape, masked=True, resampling=Resampling.nearest)
        metadata = {
            "dtype": dataset.dtypes[0],
            "shape": [dataset.height, dataset.width],
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "transform": list(dataset.transform)[:6],
            "nodata": dataset.nodata,
            "tags": dataset.tags(),
            "band_tags": dataset.tags(1),
        }

    if values.size == 0:
        return {**inventory, "scene_time_utc": latest_time.isoformat(), "analysis_status": "NO_VALID_PIXELS", "message": f"No valid raster values in {latest_path.name}."}
    low, high = (float(np.percentile(values, percentile)) for percentile in (2, 98))
    gray = np.clip((preview.filled(low) - low) / max(high - low, 1e-6) * 255, 0, 255).astype(np.uint8)
    rgba = np.repeat(gray[:, :, None], 3, axis=2)
    alpha = np.where(np.ma.getmaskarray(preview), 0, 255).astype(np.uint8)[:, :, None]
    image = Image.fromarray(np.concatenate((rgba, alpha), axis=2), mode="RGBA")
    image_buffer = io.BytesIO()
    image.save(image_buffer, format="PNG", optimize=True)

    consecutive = len(scenes) >= 3 and all(
        (scenes[index][0] - scenes[index - 1][0]).total_seconds() == 1800
        for index in range(1, len(scenes))
    )
    units = (metadata["band_tags"].get("units") or metadata["tags"].get("units") or "").strip()
    calibrated = units.lower() in {"k", "kelvin", "c", "degc", "celsius"}
    reason = None if calibrated else (
        "Raster values have no declared temperature units or matching TIR1 calibration lookup. "
        "They are reported as raw values and are not interpreted as brightness temperature."
    )
    sequence_status = "AWAITING_CALIBRATION" if len(scenes) >= 3 and not calibrated else "INSUFFICIENT_SCENES" if len(scenes) < 3 else "NOT_RUN"
    return {
        **inventory,
        "scene_time_utc": latest_time.isoformat(),
        "scene_file": latest_path.name,
        "raster_metadata": metadata,
        "raw_value_statistics": {
            "minimum": float(np.min(values)),
            "maximum": float(np.max(values)),
            "mean": float(np.mean(values)),
            "standard_deviation": float(np.std(values)),
            "valid_pixel_count": int(values.size),
            "declared_units": units or None,
        },
        "brightness_temperature_c": None,
        "brightness_temperature_status": "AVAILABLE" if calibrated else "AWAITING_CALIBRATION",
        "cold_area_fractions": {str(value): None for value in (-20, -30, -40, -50, -60)},
        "temperature_analysis_message": reason,
        "real_scene_overlay": {
            "format": "PNG",
            "image_data_base64": base64.b64encode(image_buffer.getvalue()).decode("ascii"),
            "bounds_south_west_north_east": [bounds[1], bounds[0], bounds[3], bounds[2]] if bounds else None,
            "value_interpretation": "Raw TIR1 raster values stretched for visualization only; not brightness temperature.",
        },
        "sequence_analysis": {
            "scene_count": len(scenes),
            "consecutive_30_minute_scenes": consecutive,
            "initiation": sequence_status,
            "dense_flow": sequence_status,
            "status": "REAL_ARCHIVED",
        },
        "analysis_status": "AWAITING_CALIBRATION" if not calibrated else "REAL_ARCHIVED",
        "message": reason or "Calibrated TIR1 raster identified.",
    }


async def get_satellite_feed(lat: Optional[float] = None, lon: Optional[float] = None) -> Dict[str, Any]:
    """Return public IR imagery metadata or sample an explicitly calibrated raster."""
    started_at = time.perf_counter()
    raster_url = os.getenv("MOSDAC_TIR_GEOTIFF_URL", "").strip()
    tile_url = os.getenv("MOSDAC_TIR_TILE_URL", "").strip()
    tile_bounds = _parse_bounds(os.getenv("MOSDAC_TIR_BOUNDS", ""))
    if lat is None or lon is None:
        image_status = "AVAILABLE"
        image_last_modified = None
        image_error = None
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                image_response = await client.head(PUBLIC_INSAT_IR_URL)
                image_response.raise_for_status()
                image_last_modified = image_response.headers.get("last-modified")
        except Exception as exc:
            image_status = "OFFLINE"
            image_error = str(exc)
        return {
            "status": "CONFIGURED" if tile_url and tile_bounds else "PUBLIC_IMAGE_ONLY" if image_status == "AVAILABLE" else "OFFLINE",
            "source": "MOSDAC INSAT-3D/3DR TIR1",
            "mode": "TILE_OVERLAY" if tile_url and tile_bounds else "PUBLIC_IMAGE_ONLY",
            "reason": None if tile_url and tile_bounds else "Public infrared imagery is image-only; georeferenced tiles are not configured." if image_status == "AVAILABLE" else "Public infrared image endpoint is unavailable and no georeferenced tiles are configured.",
            "image_url": PUBLIC_INSAT_IR_URL,
            "image_status": image_status,
            "image_last_modified": image_last_modified,
            "image_error": image_error,
            "gallery_url": MOSDAC_GALLERY_URL,
            "tile_url": tile_url if tile_bounds else None,
            "bounds": tile_bounds,
            "latency_ms": round((time.perf_counter() - started_at) * 1000),
        }

    if not raster_url:
        return {
            **_offline("Configure MOSDAC_TIR_GEOTIFF_URL with a calibrated, georeferenced TIR1 GeoTIFF URL to enable point sampling.", started_at),
            "latitude": lat,
            "longitude": lon,
            "cloud_top_temperature_c": None,
            "severe_convective_threshold_c": -52.0,
            "valid_time": None,
        }

    try:
        from rasterio.io import MemoryFile

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            response = await client.get(raster_url)
            response.raise_for_status()
        with MemoryFile(response.content) as memory_file:
            with memory_file.open() as dataset:
                if dataset.crs is None:
                    raise ValueError("Configured TIR GeoTIFF has no CRS")
                sample_x, sample_y = transform("EPSG:4326", dataset.crs, [lon], [lat])
                row, column = dataset.index(sample_x[0], sample_y[0])
                if row < 0 or column < 0 or row >= dataset.height or column >= dataset.width:
                    raise ValueError("Requested point lies outside the TIR GeoTIFF bounds")
                value = float(dataset.read(1, window=((row, row + 1), (column, column + 1)))[0, 0])
                if dataset.nodata is not None and value == dataset.nodata:
                    value = None
                scale = float(dataset.scales[0] or 1.0)
                offset = float(dataset.offsets[0] or 0.0)
                temperature_c = None if value is None else value * scale + offset
                units = (dataset.tags(1).get("units") or "").lower()
                if temperature_c is not None and units in {"k", "kelvin"}:
                    temperature_c -= 273.15
                elif temperature_c is not None and units not in {"c", "degc", "celsius"}:
                    raise ValueError(f"TIR raster must declare Celsius or Kelvin units; received: {units or 'missing'}")
                valid_time = dataset.tags().get("valid_time") or dataset.tags().get("datetime")
        return {
            "status": "LIVE",
            "source": "MOSDAC INSAT-3D/3DR TIR1",
            "mode": "GEOTIFF_SAMPLE",
            "latitude": lat,
            "longitude": lon,
            "cloud_top_temperature_c": round(temperature_c, 2) if temperature_c is not None else None,
            "severe_convective_threshold_c": -52.0,
            "severe_threshold_exceeded": temperature_c is not None and temperature_c < -52.0,
            "valid_time": valid_time,
            "image_url": PUBLIC_INSAT_IR_URL,
            "latency_ms": round((time.perf_counter() - started_at) * 1000),
        }
    except ImportError:
        return _offline("Install rasterio to sample the configured MOSDAC GeoTIFF.", started_at)
    except Exception as exc:
        return _offline(f"MOSDAC TIR raster unavailable: {exc}", started_at)