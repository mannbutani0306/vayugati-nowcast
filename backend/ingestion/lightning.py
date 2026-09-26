"""Blitzortung proxy adapter returning validated India-region GeoJSON."""

import os
import time
from datetime import datetime, timezone
from typing import Any, Dict

import httpx

INDIA_BOUNDS = {"south": 8.0, "west": 68.0, "north": 37.0, "east": 97.0}


def _offline(reason: str, started_at: float) -> Dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [],
        "metadata": {
            "status": "UNCONFIGURED" if reason.startswith("Configure ") else "OFFLINE",
            "source": "Blitzortung Open Network via configured proxy",
            "mode": "UNAVAILABLE",
            "reason": reason,
            "bounds": INDIA_BOUNDS,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "latency_ms": round((time.perf_counter() - started_at) * 1000),
        },
    }


async def get_lightning_feed(timeout_sec: float = 8.0) -> Dict[str, Any]:
    """Fetch GeoJSON from an operator-configured proxy; Blitzortung has no documented public API."""
    started_at = time.perf_counter()
    proxy_url = os.getenv("BLITZORTUNG_PROXY_URL", "").strip()
    if not proxy_url:
        return _offline(
            "Configure BLITZORTUNG_PROXY_URL with an authorized proxy endpoint returning GeoJSON. The public Blitzortung map does not publish a documented anonymous GeoJSON API.",
            started_at,
        )

    try:
        async with httpx.AsyncClient(timeout=timeout_sec, follow_redirects=True) as client:
            response = await client.get(proxy_url)
            response.raise_for_status()
            payload = response.json()

        if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
            raise ValueError("Proxy response must be a GeoJSON FeatureCollection")

        features = []
        for feature in payload["features"]:
            geometry = feature.get("geometry") or {}
            coordinates = geometry.get("coordinates") or []
            props = feature.get("properties") or {}
            if geometry.get("type") != "Point" or len(coordinates) < 2:
                continue
            try:
                lon, lat = float(coordinates[0]), float(coordinates[1])
            except (TypeError, ValueError):
                continue
            if not (INDIA_BOUNDS["west"] <= lon <= INDIA_BOUNDS["east"] and INDIA_BOUNDS["south"] <= lat <= INDIA_BOUNDS["north"]):
                continue
            try:
                stroke_count = max(1, int(props.get("stroke_count", props.get("count", 1))))
            except (TypeError, ValueError):
                stroke_count = 1
            timestamp = props.get("timestamp") or props.get("time")
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "timestamp": timestamp,
                    "stroke_count": stroke_count,
                    "source": "Blitzortung proxy",
                },
            })

        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "status": "LIVE",
                "source": "Blitzortung Open Network via configured proxy",
                "mode": "PROXY_GEOJSON",
                "bounds": INDIA_BOUNDS,
                "feature_count": len(features),
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "latency_ms": round((time.perf_counter() - started_at) * 1000),
            },
        }
    except Exception as exc:
        return _offline(f"Lightning proxy request failed: {exc}", started_at)
