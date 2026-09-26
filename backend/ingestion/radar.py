"""IMD radar image/tile feed adapter with explicit georeference requirements."""

import os
import time
from typing import Any, Dict, Optional

import httpx

IMD_RADAR_PAGE = "https://mausam.imd.gov.in/responsive/radar.php"
IMD_DELHI_RADAR_GIF = "https://mausam.imd.gov.in/Radar/caz_delhi.gif"


def _parse_bounds(raw: str) -> Optional[list]:
    try:
        values = [float(value.strip()) for value in raw.split(",")]
        if len(values) != 4:
            return None
        south, west, north, east = values
        if not (-90 <= south < north <= 90 and -180 <= west < east <= 180):
            return None
        return [[south, west], [north, east]]
    except (TypeError, ValueError):
        return None


async def get_radar_feed() -> Dict[str, Any]:
    """Expose a configured IMD-compatible WMS/TMS layer only with declared bounds."""
    started_at = time.perf_counter()
    tile_template = os.getenv("IMD_RADAR_TILE_URL", "").strip()
    wms_layer = os.getenv("IMD_RADAR_WMS_LAYER", "").strip()
    bounds = _parse_bounds(os.getenv("IMD_RADAR_BOUNDS", ""))

    if tile_template and bounds:
        return {
            "status": "CONFIGURED",
            "source": "IMD Doppler Weather Radar",
            "mode": "WMS" if wms_layer else "XYZ_TMS_TILES",
            "tile_url": tile_template,
            "layer_name": wms_layer or None,
            "bounds": bounds,
            "attribution": "India Meteorological Department",
            "updated_at": None,
            "image_status": "NOT_CHECKED",
            "latency_ms": round((time.perf_counter() - started_at) * 1000),
        }

    public_image = await check_radar_image()

    reason = (
        "Configure IMD_RADAR_TILE_URL and IMD_RADAR_BOUNDS (south,west,north,east) for a georeferenced overlay. "
        "The public Delhi GIF is not georeferenced and must not be placed as a map overlay."
    )
    status = "UNCONFIGURED"
    if tile_template and not bounds:
        reason = "IMD_RADAR_TILE_URL is set but IMD_RADAR_BOUNDS is missing or invalid."

    return {
        "status": status,
        "source": "IMD Doppler Weather Radar",
        "mode": "PUBLIC_IMAGE_ONLY",
        "reason": reason,
        "image_url": IMD_DELHI_RADAR_GIF,
        "source_page": IMD_RADAR_PAGE,
        "image_status": public_image["status"],
        "image_last_modified": public_image.get("last_modified"),
        "tile_url": None,
        "bounds": None,
        "latency_ms": round((time.perf_counter() - started_at) * 1000),
    }


async def check_radar_image(timeout_sec: float = 5.0) -> Dict[str, Any]:
    """Check the public station image availability without treating it as a raster layer."""
    started_at = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout_sec, follow_redirects=True) as client:
            response = await client.head(IMD_DELHI_RADAR_GIF)
            response.raise_for_status()
        return {
            "status": "AVAILABLE",
            "content_type": response.headers.get("content-type"),
            "last_modified": response.headers.get("last-modified"),
            "latency_ms": round((time.perf_counter() - started_at) * 1000),
        }
    except Exception as exc:
        return {
            "status": "OFFLINE",
            "reason": str(exc),
            "latency_ms": round((time.perf_counter() - started_at) * 1000),
        }
