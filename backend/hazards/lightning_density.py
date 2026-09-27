"""Point-to-grid lightning density calculations with explicit source status."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, Optional, Sequence, Tuple

import numpy as np

from . import HazardResult, compact, unavailable


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def assess_lightning_density(
    features: Iterable[Dict[str, Any]] | None,
    bounds: Tuple[float, float, float, float],
    *,
    grid_shape: Tuple[int, int] = (1, 1),
    window_minutes: int = 15,
    now: Optional[datetime] = None,
    status: str = "LIVE",
    source: str = "configured lightning GeoJSON",
) -> HazardResult:
    """Grid timestamped point strokes into strokes/km^2/window.

    ``bounds`` is (south, west, north, east). Severity remains unclassified:
    no verified IMD/WMO category table in strokes/km^2 per 15 minutes was found
    for this implementation, so this function deliberately does not assign colors.
    """
    if features is None:
        return unavailable("lightning_density", "strokes/km^2/15 min", "No lightning features were supplied.", status="UNAVAILABLE", source=source)
    rows, cols = grid_shape
    south, west, north, east = bounds
    if rows < 1 or cols < 1 or not (south < north and west < east) or window_minutes <= 0:
        raise ValueError("valid bounds, positive grid dimensions, and window_minutes are required")

    now_utc = now.astimezone(timezone.utc) if now and now.tzinfo else (now.replace(tzinfo=timezone.utc) if now else datetime.now(timezone.utc))
    cutoff = now_utc - timedelta(minutes=window_minutes)
    counts = np.zeros((rows, cols), dtype=float)
    accepted = 0
    for feature in features:
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        properties = feature.get("properties") or {}
        if geometry.get("type") != "Point" or len(coordinates) < 2:
            continue
        try:
            lon, lat = float(coordinates[0]), float(coordinates[1])
            strokes = max(1, int(properties.get("stroke_count", properties.get("count", 1))))
        except (TypeError, ValueError):
            continue
        timestamp = _parse_timestamp(properties.get("timestamp") or properties.get("time"))
        if timestamp is None or timestamp < cutoff or timestamp > now_utc:
            continue
        if not (west <= lon <= east and south <= lat <= north):
            continue
        row = min(rows - 1, max(0, int((north - lat) / (north - south) * rows)))
        col = min(cols - 1, max(0, int((lon - west) / (east - west) * cols)))
        counts[row, col] += strokes
        accepted += 1

    if not accepted:
        return unavailable(
            "lightning_density",
            "strokes/km^2/15 min",
            "No timestamped strikes inside the requested bounds and time window.",
            status="UNAVAILABLE" if status == "LIVE" else status,
            source=source,
        )

    lat_mid = (south + north) / 2.0
    cell_area_km2 = (
        (111.32 * (north - south) / rows)
        * (111.32 * np.cos(np.radians(lat_mid)) * (east - west) / cols)
    )
    density = counts / max(float(cell_area_km2), 1e-9)
    return HazardResult(
        name="lightning_density",
        field=compact(density),
        probability=None,
        severity=None,
        unit_label="strokes/km^2/15 min",
        status=status,
        source=source,
        caveat="Severity is UNCLASSIFIED until a verified IMD/WMO threshold source for this unit/window is available.",
        details={"strokes_per_cell": compact(counts), "cell_area_km2": float(cell_area_km2), "severity_status": "UNCLASSIFIED"},
    )


def synthetic_lightning_points(
    latitude: float,
    longitude: float,
    strikes_per_minute: float,
    *,
    now: Optional[datetime] = None,
    radius_km: float = 5.0,
    representative_points: int = 16,
) -> list[Dict[str, Any]]:
    """Create deterministic, explicitly synthetic fixture strokes around a cell."""
    timestamp = now or datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    total_strokes = max(0, int(round(float(strikes_per_minute) * 15.0)))
    point_count = min(max(1, representative_points), max(1, total_strokes))
    base_count, remainder = divmod(total_strokes, point_count)
    features = []
    for index in range(point_count):
        angle = 2.0 * np.pi * index / point_count
        radial_fraction = 0.25 + 0.75 * ((index % 4) / 3.0)
        lat_offset = radius_km * radial_fraction * np.cos(angle) / 111.32
        lon_scale = max(1.0, 111.32 * np.cos(np.radians(latitude)))
        lon_offset = radius_km * radial_fraction * np.sin(angle) / lon_scale
        stroke_count = base_count + (1 if index < remainder else 0)
        if stroke_count <= 0:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [longitude + lon_offset, latitude + lat_offset]},
            "properties": {
                "timestamp": timestamp.astimezone(timezone.utc).isoformat(),
                "stroke_count": stroke_count,
                "source": "synthetic demo proxy; not an observation",
            },
        })
    return features