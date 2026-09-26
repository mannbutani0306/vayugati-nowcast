"""MOSDAC/INSAT infrared feed metadata and optional georeferenced raster sampling."""

import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

PUBLIC_INSAT_IR_URL = "https://mausam.imd.gov.in/Satellite/3Dasiasec_ir1.jpg"
MOSDAC_GALLERY_URL = "https://mosdac.gov.in/gallery/index.html?prod=3SIMG_%27%2A_L1B_STD_IR1_V%27%2A.jpg"


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


async def get_satellite_feed(lat: Optional[float] = None, lon: Optional[float] = None) -> Dict[str, Any]:
    """Return latest public IR image reference and optionally sample a configured GeoTIFF.

    MOSDAC's public gallery image is visual IR imagery, not a calibrated temperature
    raster. Point temperatures are only returned when a georeferenced, calibrated
    GeoTIFF URL is configured through MOSDAC_TIR_GEOTIFF_URL and rasterio is installed.
    """
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
        import rasterio
        from rasterio.io import MemoryFile
        from rasterio.warp import transform

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
                nodata = dataset.nodata
                if nodata is not None and value == nodata:
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
