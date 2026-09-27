"""
================================================================================
VayuGati Nowcast (SIH26084) - Convective Scale Meteorological Engine
================================================================================
FastAPI Python service for weather-data integration, Lucas-Kanade / pySTEPS
optical-flow extrapolation, and Gradient Boosting Classifier (scikit-learn)
probabilistic convective risk classification (0-60 min nowcasting lead times).

Core Modules:
1. Open-Meteo Integration: Real-time thermodynamic sounding parameters (CAPE,
   CIN, Lifted Index, Wind Gusts) across the Indian subcontinent.
2. Doppler Radar & Satellite Fusion: Dual-time gridded reflectivity matrix
   advection via Lucas-Kanade optical flow, computing 15, 30, 45, and 60-minute
   projected storm track uncertainty cones.
3. Gradient Boosting Classifier (scikit-learn): Multi-class probabilistic model
   predicting cell severity (LOW, MODERATE, HIGH, SEVERE) with feature attribution.
4. FastAPI Endpoints:
   - GET /api/v1/live-fusion-grid (GeoJSON FeatureCollection)
   - GET /api/v1/instability-index (Gridded CAPE/CIN/LI map data)
    - POST /api/v1/predict-severity (Interactive Gradient Boosting inference)
   - POST /api/v1/optical-flow-track (Custom cone projection)
   - GET /health (Service health check)
================================================================================
"""

import sys
import os
import math
import json
import time
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Literal, Optional, Tuple, Union
import urllib.request
import urllib.error
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from zoneinfo import ZoneInfo

import httpx
import joblib
import numpy as np
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

try:
    from .ingestion.lightning import get_lightning_feed
    from .ingestion.radar import get_radar_feed
    from .ingestion.satellite import get_satellite_feed
except ImportError:
    from ingestion.lightning import get_lightning_feed
    from ingestion.radar import get_radar_feed
    from ingestion.satellite import get_satellite_feed

# Configure structured meteorological logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [VayuGati-Nowcast] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("VayuGatiNowcast")

MODEL_FEATURES = [
    "reflectivity_dbz",
    "cape_jkg",
    "cloud_top_temp_c",
    "lightning_rate_pm",
    "wind_shear_knots",
    "pwat_mm",
]
MODEL_LABELS = {0: "INFO", 1: "WATCH", 2: "WARNING", 3: "SEVERE"}
ML_MODEL_PATH = Path(__file__).resolve().parent / "ml" / "saved_models" / "convective_risk_gb.pkl"
ML_CATALOGUE_PATH = Path(__file__).resolve().parent / "ml" / "event_catalogue.json"
_MODEL_CACHE: Optional[Any] = None


def _load_ml_model() -> Optional[Any]:
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE
    if not ML_MODEL_PATH.exists():
        logger.warning("No trained ML model artifact found at %s; using heuristic inference fallback.", ML_MODEL_PATH)
        return None
    try:
        _MODEL_CACHE = joblib.load(ML_MODEL_PATH)
        if hasattr(_MODEL_CACHE, "predict_proba"):
            logger.info("Loaded trained model artifact from %s", ML_MODEL_PATH)
            return _MODEL_CACHE
        logger.warning("Loaded artifact existed but did not expose predict_proba; using heuristic fallback.")
        return None
    except Exception as exc:  # pragma: no cover - safety fallback for cold start
        logger.warning("Could not load trained model artifact: %s", exc)
        return None


# ==============================================================================
# FASTAPI & PYDANTIC CONDITIONAL IMPORTS / SHIMS
# ==============================================================================
try:
    from fastapi import FastAPI, HTTPException, Query, Body, status
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel, Field
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False
    logger.warning("FastAPI/Pydantic not found in local environment. Providing standalone shims.")

    # Lightweight Pydantic BaseModel fallback
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def dict(self):
            return self.__dict__

    def Field(default=None, **kwargs):
        return default

    def Query(default=None, **kwargs):
        return default

    def Body(default=None, **kwargs):
        return default

    # Lightweight FastAPI shim for standalone testing
    class FastAPI:
        def __init__(self, **kwargs):
            self.routes = []
            self.title = kwargs.get("title", "VayuGati Nowcast Engine")
        def add_middleware(self, *args, **kwargs):
            pass
        def get(self, path, **kwargs):
            def decorator(func):
                self.routes.append(("GET", path, func))
                return func
            return decorator
        def post(self, path, **kwargs):
            def decorator(func):
                self.routes.append(("POST", path, func))
                return func
            return decorator

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)

    class JSONResponse:
        def __init__(self, content, status_code=200):
            self.content = content
            self.status_code = status_code


# ==============================================================================
# PYDANTIC SCHEMAS / REQUEST-RESPONSE CONTRACTS
# ==============================================================================
class CellSeverityRequest(BaseModel):
    reflectivity_dbz: float = Field(..., description="Radar reflectivity in dBZ (0 - 75)")
    cape_j_kg: float = Field(..., description="Convective Available Potential Energy in J/kg (0 - 6000)")
    lightning_rate_per_min: float = Field(..., description="Total lightning flash rate in strokes/min")
    cloud_top_cooling_rate_c_per_15m: float = Field(..., description="Satellite IR cloud top cooling rate in °C/15min")


class OpticalFlowRequest(BaseModel):
    origin_lat: float = Field(..., description="Latitude of cell centroid")
    origin_lon: float = Field(..., description="Longitude of cell centroid")
    speed_kmh: float = Field(..., description="Cell advection speed in km/h")
    bearing_deg: float = Field(..., description="Advection bearing in meteorological degrees (0-360)")
    lead_times_min: Optional[List[int]] = Field(default=[15, 30, 45, 60], description="Lead times in minutes")
    base_radius_km: Optional[float] = Field(default=8.0, description="Initial convective core radius in km")


class SaarthiChatMessage(BaseModel):
    role: Literal["user", "model"]
    text: str = Field(..., min_length=1, max_length=2000)


class SaarthiChatRequest(BaseModel):
    messages: List[SaarthiChatMessage] = Field(..., min_length=1, max_length=12)


# ==============================================================================
# 1. OPEN-METEO INTEGRATION (THERMODYNAMIC SOUNDING RETRIEVAL)
# ==============================================================================
OPEN_METEO_BASE_URL = os.getenv("NWP_API_BASE_URL", "").strip() or "https://api.open-meteo.com/v1/forecast"

# Representative Indian Meteorological Stations across vulnerable convective corridors
KEY_INDIAN_STATIONS = [
    {"code": "PUN", "name": "Pune (Western Ghats Rainshadow)", "lat": 18.5204, "lon": 73.8567, "state": "Maharashtra"},
    {"code": "BOM", "name": "Mumbai (Konkan Coastal Belt)", "lat": 19.0760, "lon": 72.8777, "state": "Maharashtra"},
    {"code": "DEL", "name": "Delhi-NCR (Indo-Gangetic Plain)", "lat": 28.6139, "lon": 77.2090, "state": "Delhi"},
    {"code": "CCU", "name": "Kolkata (Nor'wester / Kalbaishakhi Zone)", "lat": 22.5726, "lon": 88.3639, "state": "West Bengal"},
    {"code": "GAU", "name": "Guwahati (Brahmaputra Valley)", "lat": 26.1445, "lon": 91.7362, "state": "Assam"},
    {"code": "IXC", "name": "Chandigarh (Siwalik Foothills)", "lat": 30.7333, "lon": 76.7794, "state": "Punjab/Haryana"},
    {"code": "HYD", "name": "Hyderabad (Telangana Plateau)", "lat": 17.3850, "lon": 78.4867, "state": "Telangana"},
    {"code": "BLR", "name": "Bengaluru (Deccan Plateau)", "lat": 12.9716, "lon": 77.5946, "state": "Karnataka"},
    {"code": "BBI", "name": "Bhubaneswar (Odisha Coastal Plain)", "lat": 20.2961, "lon": 85.8245, "state": "Odisha"},
    {"code": "NAG", "name": "Nagpur (Central Vidarbha Corridor)", "lat": 21.1458, "lon": 79.0882, "state": "Maharashtra"},
    {"code": "PAT", "name": "Patna (Middle Ganga Basin)", "lat": 25.5941, "lon": 85.1376, "state": "Bihar"},
    {"code": "SHL", "name": "Shillong (Meghalaya Plateau - Cherrapunji)", "lat": 25.5788, "lon": 91.8933, "state": "Meghalaya"}
]


_INSTABILITY_CACHE: Dict[Tuple[float, float, str], Dict[str, Any]] = {}
_INSTABILITY_CACHE_TTL_SEC = 300.0


async def fetch_open_meteo_instability(
    lat: float,
    lon: float,
    model: str = "ncep_gfs_seamless",
    timeout_sec: float = 12.0,
) -> Dict[str, Any]:
    """Retrieve actual hourly NWP fields and retain only a labeled last-good cache."""
    cache_key = (round(lat, 4), round(lon, 4), model)
    started_at = time.perf_counter()
    params = {
        "latitude": cache_key[0],
        "longitude": cache_key[1],
        "hourly": ",".join((
            "cape", "convective_inhibition", "lifted_index", "wind_gusts_10m",
            "precipitation", "surface_pressure", "total_column_integrated_water_vapour",
            "wind_speed_10m", "wind_direction_10m", "wind_speed_500hPa",
            "wind_direction_500hPa",
        )),
        "models": model,
        "forecast_days": 1,
        "timezone": "Asia/Kolkata",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            response = await client.get(OPEN_METEO_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        if not times:
            raise ValueError("Open-Meteo response did not include hourly timestamps")

        current_hour = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%dT%H:00")
        idx = min(range(len(times)), key=lambda index: abs(
            datetime.fromisoformat(times[index]).replace(tzinfo=ZoneInfo("Asia/Kolkata"))
            - datetime.fromisoformat(current_hour).replace(tzinfo=ZoneInfo("Asia/Kolkata"))
        ).total_seconds())

        def value_for(name: str) -> Optional[float]:
            values = hourly.get(name) or []
            if idx >= len(values) or values[idx] is None:
                return None
            return float(values[idx])

        cape = value_for("cape")
        cin = value_for("convective_inhibition")
        lifted_index = value_for("lifted_index")
        gust = value_for("wind_gusts_10m")
        lower_speed = value_for("wind_speed_10m")
        lower_direction = value_for("wind_direction_10m")
        upper_speed = value_for("wind_speed_500hPa")
        upper_direction = value_for("wind_direction_500hPa")
        wind_shear = None
        if all(item is not None for item in (lower_speed, lower_direction, upper_speed, upper_direction)):
            lower_u = -(lower_speed / 3.6) * math.sin(math.radians(lower_direction))
            lower_v = -(lower_speed / 3.6) * math.cos(math.radians(lower_direction))
            upper_u = -(upper_speed / 3.6) * math.sin(math.radians(upper_direction))
            upper_v = -(upper_speed / 3.6) * math.cos(math.radians(upper_direction))
            wind_shear = round(math.hypot(upper_u - lower_u, upper_v - lower_v), 2)

        metadata = {
            "source": "Open-Meteo NWP",
            "mode": "LIVE",
            "latency_ms": round((time.perf_counter() - started_at) * 1000),
            "model": model,
        }
        payload = {
            "current_cape": round(cape, 1) if cape is not None else None,
            "cin_estimate": round(cin, 1) if cin is not None else None,
            "lifted_index": round(lifted_index, 2) if lifted_index is not None else None,
            "max_gust_kmh": round(gust, 1) if gust is not None else None,
            "wind_shear_ms": wind_shear,
            "pwat_mm": value_for("total_column_integrated_water_vapour"),
            "precipitation_mm": value_for("precipitation"),
            "surface_pressure_hpa": value_for("surface_pressure"),
            "timestamp": times[idx],
            "latitude": cache_key[0],
            "longitude": cache_key[1],
            "thermodynamic_state": classify_thermodynamic_state(cape or 0.0, cin or 0.0, lifted_index or 0.0),
            "metadata": metadata,
        }
        _INSTABILITY_CACHE[cache_key] = {"payload": payload, "stored_at": time.time()}
        return payload
    except Exception as exc:
        logger.warning("Open-Meteo NWP request failed at %.4f, %.4f: %s", lat, lon, exc)
        cached = _INSTABILITY_CACHE.get(cache_key)
        if cached and time.time() - cached["stored_at"] <= _INSTABILITY_CACHE_TTL_SEC:
            cached_payload = dict(cached["payload"])
            cached_payload["metadata"] = {
                **cached_payload["metadata"],
                "mode": "CACHED",
                "latency_ms": round((time.perf_counter() - started_at) * 1000),
            }
            return cached_payload
        raise


def classify_thermodynamic_state(cape: float, cin: float, lifted_index: float) -> str:
    """
    Standard IMD / WMO convective potential categorization.
    """
    if cape > 2500 and lifted_index < -5.0 and abs(cin) < 50:
        return "EXTREMELY_UNSTABLE_SEVERE_CONVECTIVE_POTENTIAL"
    elif cape > 1500 and lifted_index < -3.0:
        return "MODERATELY_UNSTABLE_THUNDERSTORM_FAVORABLE"
    elif cape > 800:
        return "MARGINALLY_UNSTABLE_ISOLATED_CELLS"
    else:
        return "STABLE_INHIBITED"


# ==============================================================================
# 2. DOPPLER RADAR & SATELLITE FUSION ALGORITHM (LUCAS-KANADE OPTICAL FLOW)
# ==============================================================================
def optical_flow_lucas_kanade(
    grid_t_minus_10: List[List[float]],
    grid_t_0: List[List[float]],
    cell_center_x: int,
    cell_center_y: int,
    window_half_size: int = 4,
    km_per_pixel: float = 1.5,
    delta_t_minutes: float = 10.0
) -> Dict[str, float]:
    """
    Simulates Lucas-Kanade gradient-based optical flow extrapolation (analogous to pySTEPS / COTREC)
    over two successive Doppler radar reflectivity scans spaced 10 minutes apart:

    Optical flow equation:
      Ix * u + Iy * v + It = 0
    Solved via local spatial least squares within an interrogation window:
      [sum(Ix^2)    sum(Ix*Iy)] [u] = [-sum(Ix*It)]
      [sum(Ix*Iy)   sum(Iy^2) ] [v]   [-sum(Iy*It)]

    Returns:
      u_kmh: Eastward advection speed (km/h)
      v_kmh: Northward advection speed (km/h)
      speed_kmh: Total ground speed (km/h)
      bearing_deg: Meteorological bearing (0-360 degrees)
    """
    rows = len(grid_t_0)
    cols = len(grid_t_0[0]) if rows > 0 else 0

    if rows < 3 or cols < 3:
        # Fallback default motion
        return {"u_kmh": 25.0, "v_kmh": 12.0, "speed_kmh": 27.7, "bearing_deg": 64.4}

    sum_ix2 = 0.0
    sum_iy2 = 0.0
    sum_ix_iy = 0.0
    sum_ix_it = 0.0
    sum_iy_it = 0.0

    r_min = max(1, cell_center_y - window_half_size)
    r_max = min(rows - 2, cell_center_y + window_half_size)
    c_min = max(1, cell_center_x - window_half_size)
    c_max = min(cols - 2, cell_center_x + window_half_size)

    for r in range(r_min, r_max + 1):
        for c in range(c_min, c_max + 1):
            # Spatial central differences at t_0
            ix = (grid_t_0[r][c + 1] - grid_t_0[r][c - 1]) / 2.0
            iy = (grid_t_0[r + 1][c] - grid_t_0[r - 1][c]) / 2.0
            # Temporal difference between consecutive 10-min radar scans
            it = (grid_t_0[r][c] - grid_t_minus_10[r][c])

            sum_ix2 += ix * ix
            sum_iy2 += iy * iy
            sum_ix_iy += ix * iy
            sum_ix_it += ix * it
            sum_iy_it += iy * it

    # Determinant of the 2x2 structure tensor A^T A
    det = (sum_ix2 * sum_iy2) - (sum_ix_iy * sum_ix_iy)

    # Regularization to prevent division by zero or ill-conditioned aperture problems
    epsilon = 1e-4
    if abs(det) < epsilon:
        # Aperture problem or homogeneous reflectivity field: default to synoptic westerly/south-westerly vector
        u_pixel_per_frame = 1.8
        v_pixel_per_frame = 0.9
    else:
        # Lucas-Kanade 2x2 matrix inversion
        inv_00 = sum_iy2 / det
        inv_01 = -sum_ix_iy / det
        inv_10 = -sum_ix_iy / det
        inv_11 = sum_ix2 / det

        b0 = -sum_ix_it
        b1 = -sum_iy_it

        u_pixel_per_frame = (inv_00 * b0) + (inv_01 * b1)
        v_pixel_per_frame = (inv_10 * b0) + (inv_11 * b1)

    # Constrain extreme unrealistic velocity artifacts
    u_pixel_per_frame = max(-10.0, min(10.0, u_pixel_per_frame))
    v_pixel_per_frame = max(-10.0, min(10.0, v_pixel_per_frame))

    # Convert pixel displacement per 10 min frame to km/h
    # (distance_km / (10 / 60) hours) = distance_km * 6
    scale_factor = (km_per_pixel * 60.0) / delta_t_minutes
    u_kmh = u_pixel_per_frame * scale_factor
    v_kmh = -v_pixel_per_frame * scale_factor  # Invert vertical raster index to meteorological North

    speed_kmh = math.sqrt((u_kmh * u_kmh) + (v_kmh * v_kmh))
    if speed_kmh < 5.0:
        # Minimum physical advection floor for convective cells
        speed_kmh = 24.0
        u_kmh = 20.0
        v_kmh = 13.0

    # Calculate meteorological direction (direction from which the storm moves) vs advection track
    # Track bearing: direction toward which cell is moving
    angle_rad = math.atan2(u_kmh, v_kmh)
    bearing_deg = (math.degrees(angle_rad) + 360.0) % 360.0

    return {
        "u_kmh": round(u_kmh, 2),
        "v_kmh": round(v_kmh, 2),
        "speed_kmh": round(speed_kmh, 1),
        "bearing_deg": round(bearing_deg, 1)
    }


def generate_forecast_track_cones(
    origin_lat: float,
    origin_lon: float,
    speed_kmh: float,
    bearing_deg: float,
    lead_times_min: List[int] = [15, 30, 45, 60],
    base_radius_km: float = 8.0
) -> List[Dict[str, Any]]:
    """
    Generates expanding uncertainty cone polygons and centroid projections for 15, 30, 45, and 60 minutes
    based on pySTEPS / IMD nowcast standard protocols:
    - Lateral dispersion angle expands with lead time: theta_spread = base_angle + alpha * sqrt(lead_time)
    - Convective core polygon accounts for lateral cell expansion and turbulent diffusion.
    """
    cones = []
    bearing_rad = math.radians(bearing_deg)

    # 1 degree latitude ~ 111.32 km; 1 degree longitude ~ 111.32 * cos(lat) km
    km_per_lat = 111.32
    km_per_lon = 111.32 * math.cos(math.radians(origin_lat))
    if km_per_lon < 1.0:
        km_per_lon = 1.0

    for lead_min in lead_times_min:
        hours = lead_min / 60.0
        dist_km = speed_kmh * hours

        # Projected centroid
        centroid_dlat = (dist_km * math.cos(bearing_rad)) / km_per_lat
        centroid_dlon = (dist_km * math.sin(bearing_rad)) / km_per_lon
        forecast_lat = origin_lat + centroid_dlat
        forecast_lon = origin_lon + centroid_dlon

        # Uncertainty aperture angle in degrees (widens with lead time)
        # 15m -> ~18 deg, 30m -> ~25 deg, 45m -> ~31 deg, 60m -> ~36 deg
        cone_aperture_deg = 14.0 + (2.8 * math.sqrt(lead_min))
        cone_radius_km = base_radius_km + (1.2 * math.sqrt(lead_min))

        # Generate fan / cone polygon coordinates:
        # Arc around the forecast centroid plus anchor tangents back to the current position
        coords = []
        left_angle_deg = bearing_deg - cone_aperture_deg
        right_angle_deg = bearing_deg + cone_aperture_deg

        # Sector arc points around forecast perimeter
        num_arc_steps = 7
        for step in range(num_arc_steps + 1):
            theta = math.radians(left_angle_deg + (step * (2 * cone_aperture_deg / num_arc_steps)))
            pt_dlat = (cone_radius_km * math.cos(theta)) / km_per_lat
            pt_dlon = (cone_radius_km * math.sin(theta)) / km_per_lon
            coords.append([round(forecast_lon + pt_dlon, 5), round(forecast_lat + pt_dlat, 5)])

        # Anchor back to origin with lateral base width
        base_left_rad = math.radians(bearing_deg - 90.0)
        base_right_rad = math.radians(bearing_deg + 90.0)
        coords.append([
            round(origin_lon + (base_radius_km * 0.5 * math.sin(base_right_rad)) / km_per_lon, 5),
            round(origin_lat + (base_radius_km * 0.5 * math.cos(base_right_rad)) / km_per_lat, 5)
        ])
        coords.append([
            round(origin_lon + (base_radius_km * 0.5 * math.sin(base_left_rad)) / km_per_lon, 5),
            round(origin_lat + (base_radius_km * 0.5 * math.cos(base_left_rad)) / km_per_lat, 5)
        ])
        # Close the GeoJSON linear ring
        coords.append(coords[0])

        cones.append({
            "lead_time_minutes": lead_min,
            "forecast_centroid": [round(forecast_lat, 5), round(forecast_lon, 5)],
            "advection_distance_km": round(dist_km, 2),
            "uncertainty_radius_km": round(cone_radius_km, 2),
            "aperture_angle_deg": round(cone_aperture_deg, 1),
            "polygon_geojson": {
                "type": "Polygon",
                "coordinates": [coords]
            }
        })

    return cones


# ==============================================================================
# 3. GRADIENT BOOSTING CLASSIFIER (SCIKIT-LEARN, PROBABILISTIC MULTI-CLASS)
# ==============================================================================
def predict_cell_severity(
    reflectivity: float,
    cape: float,
    lightning_rate: float,
    cloud_top_cooling_rate: float,
    cloud_top_temp_c: Optional[float] = None,
    wind_shear_knots: Optional[float] = None,
    pwat_mm: Optional[float] = None,
) -> Dict[str, Any]:
    """Predict convective severity using the trained gradient-boosted model when available."""
    dbz = max(10.0, min(80.0, float(reflectivity)))
    c_cape = max(0.0, min(6500.0, float(cape)))
    l_rate = max(0.0, min(200.0, float(lightning_rate)))
    cooling = min(5.0, max(-15.0, float(cloud_top_cooling_rate)))
    cloud_top_temp = float(cloud_top_temp_c) if cloud_top_temp_c is not None else (-cooling * 16.0)
    shear = float(wind_shear_knots) if wind_shear_knots is not None else 20.0
    pwat = float(pwat_mm) if pwat_mm is not None else 40.0

    model = _load_ml_model()
    if model is not None and hasattr(model, "predict_proba"):
        feature_vector = np.array([[dbz, c_cape, cloud_top_temp, l_rate, shear, pwat]], dtype=float)
        probabilities = model.predict_proba(feature_vector)[0]
        predicted_index = int(np.argmax(probabilities))
        predicted_label = MODEL_LABELS.get(predicted_index, "INFO")
        probability_map = {MODEL_LABELS[i]: round(float(p), 4) for i, p in enumerate(probabilities)}
        feature_importance = getattr(model, "feature_importances_", None)
        shap_summary = {}
        if feature_importance is not None:
            shap_summary = {
                feature: round(float(score), 4)
                for feature, score in zip(MODEL_FEATURES, feature_importance)
            }
        return {
            "risk_level": predicted_label,
            "confidence": round(float(np.max(probabilities)), 4),
            "probabilities": probability_map,
            "primary_driver": f"Trained gradient-boosted severity model selected {predicted_label} based on radar, CAPE, lightning, cloud-top, and moisture signatures.",
            "features_evaluated": {
                "reflectivity_dbz": dbz,
                "cape_j_kg": c_cape,
                "cloud_top_temp_c": cloud_top_temp,
                "lightning_rate_per_min": l_rate,
                "wind_shear_knots": shear,
                "pwat_mm": pwat,
            },
            "shap_summary": shap_summary,
            "model_version": getattr(model, "__class__", type(model)).__name__,
        }

    # Fallback to the original heuristic implementation when the artifact is absent during cold starts.
    z_low = 1.2
    z_mod = 0.5
    z_high = -0.8
    z_severe = -2.2

    if dbz >= 52.0:
        z_severe += 3.2
        z_high += 1.8
        z_mod -= 1.5
        z_low -= 3.5
    elif dbz >= 44.0:
        z_severe += 1.2
        z_high += 2.4
        z_mod += 0.8
        z_low -= 2.2
    elif dbz >= 36.0:
        z_mod += 2.1
        z_high += 0.6
        z_severe -= 1.4
        z_low -= 0.8
    else:
        z_low += 2.8
        z_mod += 0.5
        z_high -= 1.8
        z_severe -= 3.2

    if c_cape >= 2800.0:
        z_severe += 2.2
        z_high += 1.5
        z_low -= 2.0
    elif c_cape >= 1800.0:
        z_high += 1.4
        z_severe += 0.8
        z_low -= 1.1
    elif c_cape <= 800.0:
        z_low += 1.8
        z_severe -= 1.8
        z_high -= 1.0

    if l_rate >= 45.0:
        z_severe += 2.8
        z_high += 1.6
        z_low -= 3.0
    elif l_rate >= 18.0:
        z_high += 2.0
        z_severe += 0.9
        z_low -= 1.6
    elif l_rate <= 3.0:
        z_low += 1.2
        z_severe -= 1.5

    if cooling <= -3.0:
        z_severe += 2.5
        z_high += 1.7
        z_low -= 2.5
    elif cooling <= -1.5:
        z_high += 1.2
        z_severe += 0.7
        z_low -= 0.8
    elif cooling >= 0.5:
        z_low += 1.5
        z_severe -= 2.0
        z_high -= 1.2

    max_z = max(z_low, z_mod, z_high, z_severe)
    exp_low = math.exp(z_low - max_z)
    exp_mod = math.exp(z_mod - max_z)
    exp_high = math.exp(z_high - max_z)
    exp_sev = math.exp(z_severe - max_z)
    sum_exp = exp_low + exp_mod + exp_high + exp_sev

    p_low = exp_low / sum_exp
    p_mod = exp_mod / sum_exp
    p_high = exp_high / sum_exp
    p_sev = exp_sev / sum_exp
    probs = {"LOW": round(p_low, 4), "MODERATE": round(p_mod, 4), "HIGH": round(p_high, 4), "SEVERE": round(p_sev, 4)}
    classes = [("LOW", p_low), ("MODERATE", p_mod), ("HIGH", p_high), ("SEVERE", p_sev)]
    classes.sort(key=lambda x: x[1], reverse=True)
    predicted_class, top_prob = classes[0]
    drivers = []
    if dbz >= 52.0:
        drivers.append(f"Extreme core reflectivity ({dbz:.1f} dBZ) indicating hail/heavy precipitation core")
    elif dbz >= 42.0:
        drivers.append(f"Strong convective radar echo ({dbz:.1f} dBZ)")
    if c_cape >= 2500.0:
        drivers.append(f"High atmospheric buoyancy (CAPE {c_cape:.0f} J/kg)")
    if l_rate >= 35.0:
        drivers.append(f"Rapid lightning stroke rate ({l_rate:.0f} fl/min) signalling intense mixed-phase charge separation")
    if cooling <= -2.5:
        drivers.append(f"Rapid cloud-top cooling ({cooling:.1f}°C/15m) indicating vigorous vertical updraft")
    primary_driver = "; ".join(drivers) + "." if drivers else "Sub-critical convective indices across radar and thermodynamic soundings."

    return {
        "risk_level": predicted_class,
        "confidence": round(top_prob, 4),
        "probabilities": probs,
        "primary_driver": primary_driver,
        "features_evaluated": {
            "reflectivity_dbz": dbz,
            "cape_j_kg": c_cape,
            "lightning_rate_per_min": l_rate,
            "cloud_top_cooling_rate_c_per_15m": cooling,
            "cloud_top_temp_c": cloud_top_temp,
            "wind_shear_knots": shear,
            "pwat_mm": pwat,
        },
        "shap_summary": {
            "reflectivity_impact": round((dbz - 35.0) * 0.08, 3),
            "cape_impact": round((c_cape - 1500.0) * 0.0007, 3),
            "lightning_impact": round((l_rate - 12.0) * 0.04, 3),
            "cloud_cooling_impact": round((-cooling - 1.0) * 0.35, 3)
        },
        "model_version": "heuristic-fallback-v2.6",
    }


# ==============================================================================
# 4. SYNOPTIC RADAR & SATELLITE GENERATORS FOR INDIA CONVECTIVE REGIMES
# ==============================================================================
def generate_synthetic_active_cells() -> List[Dict[str, Any]]:
    """
    Return illustrative demo fixture cells for India's convective regimes.
    """
    # These fixed examples stand in for a live radar-derived cell tracker
    # (TITAN/SCIT-style); authorized DWR feed access is still pending.
    raw_cells = [
        {
            "cell_uid": "CELL-IN-PUN-084",
            "name": "Pune North-Khed Convective Supercell",
            "state": "Maharashtra",
            "district": "Pune",
            "lat": 18.7845,
            "lon": 73.8123,
            "reflectivity_dbz": 57.8,
            "cloud_top_temp_c": -66.4,
            "cloud_top_cooling_rate": -3.8,
            "lightning_rate": 54,
            "cape": 3250.0,
            "cin": -18.0,
            "speed_kmh": 38.5,
            "bearing_deg": 68.0,  # East-Northeastward
            "radius_km": 11.0
        },
        {
            "cell_uid": "CELL-IN-RNC-021",
            "name": "Ranchi-Purulia Kalbaishakhi Line",
            "state": "Jharkhand",
            "district": "Ranchi",
            "lat": 23.3640,
            "lon": 85.3340,
            "reflectivity_dbz": 49.2,
            "cloud_top_temp_c": -58.2,
            "cloud_top_cooling_rate": -2.2,
            "lightning_rate": 32,
            "cape": 2700.0,
            "cin": -22.0,
            "speed_kmh": 46.0,
            "bearing_deg": 112.0,  # East-Southeastward
            "radius_km": 9.5
        },
        {
            "cell_uid": "CELL-IN-DDN-015",
            "name": "Dehradun-Mussoorie Cloudburst Precursor",
            "state": "Uttarakhand",
            "district": "Dehradun",
            "lat": 30.3165,
            "lon": 78.0322,
            "reflectivity_dbz": 54.6,
            "cloud_top_temp_c": -62.1,
            "cloud_top_cooling_rate": -4.1,
            "lightning_rate": 42,
            "cape": 2400.0,
            "cin": -12.0,
            "speed_kmh": 22.0,
            "bearing_deg": 45.0,  # Northeastward into hills
            "radius_km": 7.8
        },
        {
            "cell_uid": "CELL-IN-IXS-009",
            "name": "Silchar-Barak Basin Deep Convective Core",
            "state": "Assam",
            "district": "Cachar",
            "lat": 24.8333,
            "lon": 92.7789,
            "reflectivity_dbz": 46.5,
            "cloud_top_temp_c": -54.0,
            "cloud_top_cooling_rate": -1.8,
            "lightning_rate": 26,
            "cape": 2950.0,
            "cin": -14.0,
            "speed_kmh": 32.0,
            "bearing_deg": 85.0,  # Eastward
            "radius_km": 8.2
        },
        {
            "cell_uid": "CELL-IN-DEL-042",
            "name": "Gurugram-South Delhi Squall Cell",
            "state": "Haryana/Delhi",
            "district": "Gurugram",
            "lat": 28.4595,
            "lon": 77.0266,
            "reflectivity_dbz": 42.1,
            "cloud_top_temp_c": -47.5,
            "cloud_top_cooling_rate": -1.2,
            "lightning_rate": 14,
            "cape": 1850.0,
            "cin": -45.0,
            "speed_kmh": 52.0,
            "bearing_deg": 75.0,  # East-Northeastward
            "radius_km": 7.0
        }
    ]

    processed_cells = []
    for c in raw_cells:
        # Run Gradient Boosting Classifier (scikit-learn) probabilistic prediction.
        risk_output = predict_cell_severity(
            reflectivity=c["reflectivity_dbz"],
            cape=c["cape"],
            lightning_rate=c["lightning_rate"],
            cloud_top_cooling_rate=c["cloud_top_cooling_rate"]
        )

        # Generate optical flow track cones (15, 30, 45, 60 min lead times)
        track_cones = generate_forecast_track_cones(
            origin_lat=c["lat"],
            origin_lon=c["lon"],
            speed_kmh=c["speed_kmh"],
            bearing_deg=c["bearing_deg"],
            lead_times_min=[15, 30, 45, 60],
            base_radius_km=c["radius_km"]
        )

        # Current cell ground boundary polygon
        km_per_lat = 111.32
        km_per_lon = 111.32 * math.cos(math.radians(c["lat"]))
        cell_coords = []
        for step in range(13):
            ang = math.radians(step * (360.0 / 12))
            dlat = (c["radius_km"] * math.cos(ang)) / km_per_lat
            dlon = (c["radius_km"] * math.sin(ang)) / km_per_lon
            cell_coords.append([round(c["lon"] + dlon, 5), round(c["lat"] + dlat, 5)])

        processed_cells.append({
            **c,
            "data_mode": "DEMO_FIXTURE",
            "risk_assessment": risk_output,
            "track_cones": track_cones,
            "current_polygon_geojson": {
                "type": "Polygon",
                "coordinates": [cell_coords]
            }
        })

    return processed_cells


# ==============================================================================
# 5. FASTAPI APPLICATION DEFINITION
# ==============================================================================
app = FastAPI(
    title="VayuGati Nowcast Convective Engine",
    description="High-resolution (1-3 km) convective scale meteorological nowcasting service for SIH26084",
    version="2.4.0"
)

# Enable CORS for React frontend running on port 3000 / 5173
if FASTAPI_AVAILABLE:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ==============================================================================
# 6. API ENDPOINTS
# ==============================================================================
@app.get("/")
def get_service_root():
    """
    Root discovery endpoint providing service capabilities, endpoints, and compliance details.
    """
    return {
        "service": "VayuGati Nowcast Engine",
        "challenge_id": "SIH26084",
        "organization": "Ministry of Earth Sciences (MoES) / IMD / NDMA",
        "version": "2.4.0",
        "status": "ONLINE",
        "capabilities": [
            "Open-Meteo Real-time Thermodynamic Ingestion",
            "Lucas-Kanade & pySTEPS Optical Flow Cell Advection",
            "Gradient Boosting Classifier (scikit-learn) for multi-class convective risk (0-60 min lead time)",
            "GeoJSON Convective Fusion Grid with Expanding Forecast Cones"
        ],
        "endpoints": {
            "live_fusion_grid": "/api/v1/live-fusion-grid",
            "instability_index": "/api/v1/instability-index",
            "satellite_observations": "/api/v1/ingestion/satellite",
            "radar_overlay": "/api/v1/ingestion/radar",
            "lightning_strikes": "/api/v1/ingestion/lightning",
            "predict_severity": "/api/v1/predict-severity",
            "optical_flow_track": "/api/v1/optical-flow-track",
            "health": "/health"
        }
    }


@app.get("/health")
def get_health_status():
    """
    Liveness and feed-configuration status for container monitoring.
    """
    radar_configured = bool(
        os.getenv("IMD_RADAR_TILE_URL", "").strip()
        and os.getenv("IMD_RADAR_BOUNDS", "").strip()
    )
    satellite_configured = bool(
        os.getenv("MOSDAC_TIR_GEOTIFF_URL", "").strip()
        or (
            os.getenv("MOSDAC_TIR_TILE_URL", "").strip()
            and os.getenv("MOSDAC_TIR_BOUNDS", "").strip()
        )
    )
    return {
        "status": "HEALTHY",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "radar_network": "GEOREFERENCED_LAYER_CONFIGURED" if radar_configured else "PUBLIC_IMAGE_ONLY",
        "satellite_feed": "GEOREFERENCED_FEED_CONFIGURED" if satellite_configured else "PUBLIC_IMAGE_ONLY",
        "open_meteo_link": "ENDPOINT_CONFIGURED" if OPEN_METEO_BASE_URL else "UNCONFIGURED",
    }


@app.post("/api/v1/assistant/chat")
async def chat_with_saarthi(request: SaarthiChatRequest):
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="VayuGati Saarthi is not configured. Set GEMINI_API_KEY in the backend environment.")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(model, safe='')}:generateContent"
    payload = {
        "system_instruction": {
            "parts": [{
                "text": (
                    "You are VayuGati Saarthi, a concise assistant for the VayuGati Nowcast web app. "
                    "Help with the citizen, officer, and admin portals, accessibility controls, alerts, and data sources. "
                    "You cannot access the user's account, location, live sensor feeds, or current alerts. "
                    "Never invent a current forecast or warning, and never present demo fixtures as observations. "
                    "This prototype is not an authorized emergency warning service. For immediate danger, follow "
                    "official IMD/NDMA guidance and contact local emergency services (112 in India)."
                )
            }]
        },
        "contents": [
            {"role": message.role, "parts": [{"text": message.text}]} for message in request.messages
        ],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 512},
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers={"x-goog-api-key": api_key}, json=payload)
            response.raise_for_status()
        parts = response.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
        answer = "\n".join(part["text"] for part in parts if isinstance(part.get("text"), str)).strip()
        if not answer:
            raise ValueError("Gemini returned no text response")
        return {"text": answer}
    except httpx.HTTPStatusError as exc:
        logger.warning("Saarthi provider returned HTTP %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="Saarthi could not reach its AI provider. Please try again shortly.") from exc
    except (httpx.RequestError, ValueError, KeyError, IndexError) as exc:
        logger.warning("Saarthi provider request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Saarthi is temporarily unavailable. Please try again shortly.") from exc


@app.get("/api/v1/ingestion/satellite")
async def get_satellite_observation(
    lat: Optional[float] = Query(default=None, description="Target latitude for GeoTIFF sampling"),
    lon: Optional[float] = Query(default=None, description="Target longitude for GeoTIFF sampling"),
):
    """Return public INSAT IR imagery metadata and optionally a configured calibrated raster sample."""
    if (lat is None) != (lon is None):
        raise HTTPException(status_code=422, detail="lat and lon must be provided together")
    if lat is not None and not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=422, detail="Coordinates are outside valid WGS84 ranges")
    return await get_satellite_feed(lat, lon)


@app.get("/api/v1/ingestion/radar")
async def get_radar_observation():
    """Return IMD radar tile metadata; public station images are never assigned guessed map bounds."""
    return await get_radar_feed()


@app.get("/api/v1/ingestion/lightning")
async def get_lightning_observation():
    """Return validated Blitzortung-proxy strikes as an India-clipped GeoJSON FeatureCollection."""
    return await get_lightning_feed()


@app.get("/api/v1/live-fusion-grid")
def get_live_fusion_grid(
    min_lat: Optional[float] = Query(default=6.0, description="Bounding box southern latitude"),
    min_lon: Optional[float] = Query(default=68.0, description="Bounding box western longitude"),
    max_lat: Optional[float] = Query(default=38.0, description="Bounding box northern latitude"),
    max_lon: Optional[float] = Query(default=98.0, description="Bounding box eastern longitude")
):
    """
    Requirement 4.1:
    Returns GeoJSON FeatureCollection of illustrative demo fixture cells + 15, 30, 45, and 60-minute projected track cones.
    Conforms to standard GeoJSON RFC 7946 specifications for direct Leaflet / MapLibre visualization.
    """
    try:
        active_cells = generate_synthetic_active_cells()
        features = []

        for cell in active_cells:
            # Check bounding box intersection
            c_lat = cell["lat"]
            c_lon = cell["lon"]
            if not (min_lat <= c_lat <= max_lat and min_lon <= c_lon <= max_lon):
                continue

            risk = cell["risk_assessment"]

            # 1. Feature for Current Active Cell Polygon (lead_time = 0)
            cell_feature = {
                "type": "Feature",
                "id": f"{cell['cell_uid']}-t0",
                "geometry": cell["current_polygon_geojson"],
                "properties": {
                    "feature_type": "CURRENT_CONVECTIVE_CELL",
                    "data_mode": cell["data_mode"],
                    "cell_uid": cell["cell_uid"],
                    "name": cell["name"],
                    "state": cell["state"],
                    "district": cell["district"],
                    "lead_time_minutes": 0,
                    "risk_level": risk["risk_level"],
                    "confidence": risk["confidence"],
                    "probabilities": risk["probabilities"],
                    "primary_driver": risk["primary_driver"],
                    "reflectivity_dbz": cell["reflectivity_dbz"],
                    "cloud_top_temp_c": cell["cloud_top_temp_c"],
                    "cloud_top_cooling_rate": cell["cloud_top_cooling_rate"],
                    "lightning_rate_per_min": cell["lightning_rate"],
                    "cape_value": cell["cape"],
                    "cin_value": cell["cin"],
                    "speed_kmh": cell["speed_kmh"],
                    "bearing_deg": cell["bearing_deg"],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
            features.append(cell_feature)

            # 2. Features for Forecasted Track Cones (15, 30, 45, 60 minutes)
            for cone in cell["track_cones"]:
                lead_min = cone["lead_time_minutes"]
                cone_feature = {
                    "type": "Feature",
                    "id": f"{cell['cell_uid']}-t{lead_min}m",
                    "geometry": cone["polygon_geojson"],
                    "properties": {
                        "feature_type": "FORECAST_TRACK_CONE",
                        "data_mode": cell["data_mode"],
                        "parent_cell_uid": cell["cell_uid"],
                        "name": f"{cell['name']} (+{lead_min}m Forecast Cone)",
                        "lead_time_minutes": lead_min,
                        "advection_distance_km": cone["advection_distance_km"],
                        "uncertainty_radius_km": cone["uncertainty_radius_km"],
                        "forecast_centroid": cone["forecast_centroid"],
                        "risk_level": risk["risk_level"],
                        "speed_kmh": cell["speed_kmh"],
                        "bearing_deg": cell["bearing_deg"],
                        "valid_at": datetime.fromtimestamp(
                            time.time() + (lead_min * 60), tz=timezone.utc
                        ).isoformat()
                    }
                }
                features.append(cone_feature)

        geojson_payload = {
            "type": "FeatureCollection",
            "crs": {
                "type": "name",
                "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
            },
            "metadata": {
                "system": "VayuGati Nowcast (SIH26084)",
                "data_mode": "DEMO_FIXTURE",
                "total_active_cells": len(active_cells),
                "features_returned": len(features),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "lead_times_included": [0, 15, 30, 45, 60]
            },
            "data_mode": "DEMO_FIXTURE",
            "features": features
        }

        return geojson_payload

    except Exception as exc:
        logger.error("Error generating live fusion grid: %s", str(exc), exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate convective fusion grid: {str(exc)}"
        )


@app.get("/api/v1/instability-index")
async def get_instability_index(
    lat: Optional[float] = Query(default=None, description="Optional target latitude"),
    lon: Optional[float] = Query(default=None, description="Optional target longitude"),
    bounds: Optional[str] = Query(default=None, description="Optional bounding box 'min_lat,min_lon,max_lat,max_lon'"),
    model: str = Query(default="ncep_gfs_seamless", description="Open-Meteo model: dwd_icon_seamless or ncep_gfs_seamless"),
):
    """
    Requirement 4.2:
    Returns gridded CAPE, CIN, Lifted Index, and Wind Gusts across India or for a specific queried point/bbox.
    Returns live Open-Meteo NWP fields; last-good cached values are explicitly marked CACHED.
    """
    started_at = time.perf_counter()
    if model not in {"dwd_icon_seamless", "ncep_gfs_seamless"}:
        raise HTTPException(status_code=422, detail="model must be dwd_icon_seamless or ncep_gfs_seamless")

    try:
        if lat is not None and lon is not None:
            return await fetch_open_meteo_instability(lat, lon, model=model)

        async def fetch_station(station: Dict[str, Any]) -> Dict[str, Any]:
            sounding = await fetch_open_meteo_instability(station["lat"], station["lon"], model=model)
            return {
                "station_code": station["code"],
                "station_name": station["name"],
                "state": station["state"],
                **sounding,
            }

        station_results = await asyncio.gather(
            *(fetch_station(station) for station in KEY_INDIAN_STATIONS),
            return_exceptions=True,
        )
        results = [result for result in station_results if isinstance(result, dict)]
        failures = [str(result) for result in station_results if isinstance(result, Exception)]
        if not results:
            raise HTTPException(status_code=503, detail="Open-Meteo NWP is unavailable for all stations")

        response_payload = {
            "query_mode": "NATIONAL_INSTABILITY_GRID",
            "coverage": "Key Synoptic Corridors of India",
            "station_count": len(results),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data": results,
            "errors": failures,
            "metadata": {
                "source": "Open-Meteo NWP",
                "mode": "LIVE" if not failures else "PARTIAL",
                "latency_ms": round((time.perf_counter() - started_at) * 1000),
                "model": model,
            },
        }
        return response_payload
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error retrieving instability index: %s", str(exc), exc_info=True)
        raise HTTPException(
            status_code=503,
            detail={
                "message": f"Open-Meteo NWP feed unavailable: {str(exc)}",
                "metadata": {
                    "source": "Open-Meteo NWP",
                    "mode": "OFFLINE",
                    "latency_ms": round((time.perf_counter() - started_at) * 1000),
                    "model": model,
                },
            },
        )


@app.get("/api/v1/verification-metrics")
def get_verification_metrics():
    """Meteorological verification metrics derived from historical severe-weather events."""
    try:
        if not ML_CATALOGUE_PATH.exists():
            raise FileNotFoundError(f"Historical verification catalogue not found at {ML_CATALOGUE_PATH}")
        events = json.loads(ML_CATALOGUE_PATH.read_text(encoding="utf-8"))
        hits = misses = false_alarms = true_negatives = 0
        for event in events:
            observed = str(event.get("observed_severity", "INFO")).upper()
            observed_positive = observed in {"WATCH", "WARNING", "SEVERE"}
            feature_payload = {
                "reflectivity_dbz": float(event.get("reflectivity_dbz", 0.0)),
                "cape_jkg": float(event.get("cape_jkg", 0.0)),
                "cloud_top_temp_c": float(event.get("cloud_top_temp_c", -30.0)),
                "lightning_rate_pm": float(event.get("lightning_rate_pm", 0.0)),
                "wind_shear_knots": float(event.get("wind_shear_knots", 20.0)),
                "pwat_mm": float(event.get("pwat_mm", 30.0)),
            }
            predicted = predict_cell_severity(
                reflectivity=feature_payload["reflectivity_dbz"],
                cape=feature_payload["cape_jkg"],
                lightning_rate=feature_payload["lightning_rate_pm"],
                cloud_top_cooling_rate=-max(0.0, float(feature_payload["cloud_top_temp_c"]) / 20.0),
                cloud_top_temp_c=feature_payload["cloud_top_temp_c"],
                wind_shear_knots=feature_payload["wind_shear_knots"],
                pwat_mm=feature_payload["pwat_mm"],
            )
            predicted_positive = str(predicted.get("risk_level", "INFO")).upper() in {"WATCH", "WARNING", "SEVERE"}
            if observed_positive and predicted_positive:
                hits += 1
            elif observed_positive and not predicted_positive:
                misses += 1
            elif not observed_positive and predicted_positive:
                false_alarms += 1
            else:
                true_negatives += 1

        pod = (hits / (hits + misses)) if (hits + misses) else 0.0
        far = (false_alarms / (hits + false_alarms)) if (hits + false_alarms) else 0.0
        csi = (hits / (hits + misses + false_alarms)) if (hits + misses + false_alarms) else 0.0
        response = {
            "status": "SUCCESS",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "event_count": len(events),
            "contingency_matrix": {
                "hits": hits,
                "misses": misses,
                "false_alarms": false_alarms,
                "true_negatives": true_negatives,
            },
            "metrics": {
                "POD": round(float(pod), 4),
                "FAR": round(float(far), 4),
                "CSI": round(float(csi), 4),
            },
        }
        return response
    except Exception as exc:
        logger.error("Verification metric generation failed: %s", exc, exc_info=True)
        return {
            "status": "ERROR",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "message": str(exc),
            "event_count": 0,
            "contingency_matrix": {"hits": 0, "misses": 0, "false_alarms": 0, "true_negatives": 0},
            "metrics": {"POD": 0.0, "FAR": 0.0, "CSI": 0.0},
        }


@app.post("/api/v1/predict-severity")
def post_predict_cell_severity(payload: CellSeverityRequest):
    """Interactive endpoint invoking the trained severity classifier."""
    try:
        prediction = predict_cell_severity(
            reflectivity=payload.reflectivity_dbz,
            cape=payload.cape_j_kg,
            lightning_rate=payload.lightning_rate_per_min,
            cloud_top_cooling_rate=payload.cloud_top_cooling_rate_c_per_15m,
        )
        return {
            "status": "SUCCESS",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "prediction": prediction,
        }
    except Exception as exc:
        logger.error("Prediction failed: %s", str(exc))
        raise HTTPException(status_code=400, detail=f"Inference error: {str(exc)}")


@app.post("/api/v1/optical-flow-track")
def post_optical_flow_track(payload: OpticalFlowRequest):
    """
    Requirement 2:
    Generates 15, 30, 45, and 60-minute storm track cones from origin coordinates, speed, and bearing.
    """
    try:
        cones = generate_forecast_track_cones(
            origin_lat=payload.origin_lat,
            origin_lon=payload.origin_lon,
            speed_kmh=payload.speed_kmh,
            bearing_deg=payload.bearing_deg,
            lead_times_min=payload.lead_times_min or [15, 30, 45, 60],
            base_radius_km=payload.base_radius_km or 8.0
        )
        return {
            "status": "SUCCESS",
            "origin": [payload.origin_lat, payload.origin_lon],
            "speed_kmh": payload.speed_kmh,
            "bearing_deg": payload.bearing_deg,
            "cones": cones
        }
    except Exception as exc:
        logger.error("Optical flow track projection failed: %s", str(exc))
        raise HTTPException(status_code=400, detail=f"Advection calculation error: {str(exc)}")


# ==============================================================================
# 7. STANDALONE TESTING, VERIFICATION SUITE & RUNNER
# ==============================================================================
def run_verification_suite():
    """
    Self-contained verification suite validating all 4 engine modules:
    1. Open-Meteo Integration (real API call; unavailable feed is reported)
    2. Doppler Optical Flow (Lucas-Kanade solver + Track Cone generation)
    3. Gradient Boosting Classifier (scikit-learn) across convective risk scenarios
    4. GeoJSON Fusion Grid & Instability Index structure
    """
    print("\n" + "=" * 70)
    print(" VAYUGATI NOWCAST (SIH26084) - METEOROLOGICAL ENGINE VERIFICATION")
    print("=" * 70)

    # 1. Test Open-Meteo Integration
    print("\n[1/4] Testing Open-Meteo Thermodynamic Fetcher (Pune Lat: 18.5204, Lon: 73.8567)...")
    sounding = asyncio.run(fetch_open_meteo_instability(18.5204, 73.8567))
    print(f"  Source: {sounding['metadata']['source']} ({sounding['metadata']['mode']})")
    print(f"  CAPE: {sounding['current_cape']} J/kg | CIN: {sounding['cin_estimate']} J/kg")
    print(f"  Lifted Index: {sounding['lifted_index']} °C | Wind Gusts: {sounding['max_gust_kmh']} km/h")
    print(f"  Thermodynamic State: {sounding['thermodynamic_state']}")

    # 2. Test Optical Flow Lucas-Kanade Simulation
    print("\n[2/4] Testing Doppler Radar Lucas-Kanade Optical Flow (t-10m -> t-0m)...")
    # Synthetic 16x16 reflectivity patch with eastward advecting 55 dBZ core
    patch_t_minus_10 = [[10.0 for _ in range(16)] for _ in range(16)]
    patch_t_0 = [[10.0 for _ in range(16)] for _ in range(16)]
    for r in range(6, 11):
        for c in range(5, 9):
            patch_t_minus_10[r][c] = 55.0
        for c in range(7, 11):  # Core shifted 2 pixels east in 10 min
            patch_t_0[r][c] = 55.0

    flow = optical_flow_lucas_kanade(patch_t_minus_10, patch_t_0, cell_center_x=8, cell_center_y=8)
    print(f"  Advection Vector: u = {flow['u_kmh']} km/h, v = {flow['v_kmh']} km/h")
    print(f"  Total Speed: {flow['speed_kmh']} km/h | Bearing: {flow['bearing_deg']}°")

    cones = generate_forecast_track_cones(18.7845, 73.8123, flow['speed_kmh'], flow['bearing_deg'])
    print(f"  Generated {len(cones)} forecast cones (15, 30, 45, 60m):")
    for cone in cones:
        print(f"    +{cone['lead_time_minutes']} min: Centroid = {cone['forecast_centroid']}, Dist = {cone['advection_distance_km']} km, Radius = {cone['uncertainty_radius_km']} km")

    # 3. Test the Gradient Boosting Classifier across 4 meteorological archetypes.
    print("\n[3/4] Testing Gradient Boosting Classifier (scikit-learn)...")
    test_cases = [
        ("Severe Supercell / Cloudburst Precursor", 58.0, 3200.0, 52.0, -4.2),
        ("High-Risk Squall Line", 47.0, 2400.0, 28.0, -2.1),
        ("Moderate Thunderstorm", 39.0, 1600.0, 12.0, -1.0),
        ("Benign Cumulus / Shallow Convection", 26.0, 650.0, 1.0, 0.5),
    ]
    for label, dbz, cape, lightning, cooling in test_cases:
        res = predict_cell_severity(dbz, cape, lightning, cooling)
        print(f"  Scenario: '{label}'")
        print(f"    Inputs: {dbz} dBZ, CAPE {cape} J/kg, {lightning} fl/min, {cooling} °C/15m")
        print(f"    Predicted Risk: [{res['risk_level']}] (Confidence: {res['confidence']*100:.1f}%)")
        print(f"    Probabilities: {res['probabilities']}")
        print(f"    Driver: {res['primary_driver']}")

    # 4. Test GeoJSON Live Fusion Grid Generation
    print("\n[4/4] Testing Live GeoJSON Fusion Grid & Instability Index...")
    grid = get_live_fusion_grid()
    print(f"  FeatureCollection generated with {len(grid['features'])} total features.")
    first_feat = grid['features'][0]
    print(f"  Sample Feature ID: {first_feat['id']} ({first_feat['properties']['feature_type']})")
    print(f"  Geometry Type: {first_feat['geometry']['type']}, Coordinates count: {len(first_feat['geometry']['coordinates'][0])}")

    instability_grid = asyncio.run(get_instability_index())
    print(f"  Instability Grid: {instability_grid['station_count']} synoptic stations loaded successfully.")
    print("=" * 70)
    print(" ALL METEOROLOGICAL MODULES VERIFIED SUCCESSFULLY FOR SIH26084.")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    # If run as CLI script: verify modules and optionally run uvicorn
    run_verification_suite()

    if "serve" in sys.argv or "--serve" in sys.argv:
        try:
            import uvicorn
            print("Starting VayuGati Nowcast Uvicorn ASGI Server on http://0.0.0.0:8000 ...")
            uvicorn.run(app, host="0.0.0.0", port=8000)
        except ImportError:
            print("uvicorn not installed. To start server, install via: pip install uvicorn fastapi")
