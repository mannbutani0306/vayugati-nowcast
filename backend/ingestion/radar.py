"""IMD radar image/tile feed adapter with explicit georeference requirements."""

import os
import time
from datetime import datetime, timezone
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


def _make_radar_observation_summary(status: str, *, source: str, mode: str, updated_at: Optional[str], reason: Optional[str] = None, tile_url: Optional[str] = None, bounds: Optional[list] = None, image_url: Optional[str] = None, image_status: Optional[str] = None, image_last_modified: Optional[str] = None, feature_count: int = 0, latency_ms: int = 0, source_kind: str = "OBSERVED") -> Dict[str, Any]:
    """Return a consistent DWR status object with explicit source and staleness metadata."""
    timestamp_utc = updated_at or None
    staleness_seconds = None
    if timestamp_utc:
        try:
            if isinstance(timestamp_utc, str):
                timestamp_value = datetime.fromisoformat(timestamp_utc.replace("Z", "+00:00"))
            else:
                timestamp_value = timestamp_utc
            if timestamp_value.tzinfo is None:
                timestamp_value = timestamp_value.replace(tzinfo=timezone.utc)
            staleness_seconds = max(0.0, (datetime.now(timezone.utc) - timestamp_value).total_seconds())
        except (TypeError, ValueError):
            staleness_seconds = None

    return {
        "status": status,
        "source": source,
        "source_kind": source_kind,
        "mode": mode,
        "reason": reason,
        "timestamp_utc": timestamp_utc,
        "staleness_seconds": round(staleness_seconds) if staleness_seconds is not None else None,
        "tile_url": tile_url,
        "bounds": bounds,
        "image_url": image_url,
        "image_status": image_status,
        "image_last_modified": image_last_modified,
        "feature_count": feature_count,
        "latency_ms": latency_ms,
        "observation_status": "AVAILABLE" if status == "LIVE" else "NOT_AVAILABLE",
        "requires_authorized_feed": source_kind == "OBSERVED",
        "updated_at": timestamp_utc,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
    }


async def get_radar_feed() -> Dict[str, Any]:
    """Expose a configured IMD-compatible WMS/TMS layer only with declared bounds."""
    started_at = time.perf_counter()
    tile_template = os.getenv("IMD_RADAR_TILE_URL", "").strip()
    wms_layer = os.getenv("IMD_RADAR_WMS_LAYER", "").strip()
    bounds = _parse_bounds(os.getenv("IMD_RADAR_BOUNDS", ""))

    if tile_template and bounds:
        return _make_radar_observation_summary(
            "LIVE",
            source="IMD Doppler Weather Radar",
            mode="WMS" if wms_layer else "XYZ_TMS_TILES",
            updated_at=None,
            tile_url=tile_template,
            bounds=bounds,
            image_status="NOT_CHECKED",
            latency_ms=round((time.perf_counter() - started_at) * 1000),
            source_kind="OBSERVED",
        )

    public_image = await check_radar_image()

    reason = (
        "Configure IMD_RADAR_TILE_URL and IMD_RADAR_BOUNDS (south,west,north,east) for a georeferenced overlay. "
        "The public Delhi GIF is not georeferenced and must not be placed as a map overlay."
    )
    status = "UNCONFIGURED"
    if tile_template and not bounds:
        reason = "IMD_RADAR_TILE_URL is set but IMD_RADAR_BOUNDS is missing or invalid."

    return _make_radar_observation_summary(
        status,
        source="IMD Doppler Weather Radar",
        mode="PUBLIC_IMAGE_ONLY",
        updated_at=None,
        reason=reason,
        image_url=IMD_DELHI_RADAR_GIF,
        image_status=public_image["status"],
        image_last_modified=public_image.get("last_modified"),
        latency_ms=round((time.perf_counter() - started_at) * 1000),
        source_kind="PUBLIC_IMAGE_ONLY",
    )


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
