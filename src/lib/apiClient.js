const DEFAULT_API_BASE = 'http://localhost:8000/api/v1';

export const API_BASE_URL = (import.meta.env.VITE_NOWCAST_API_URL || DEFAULT_API_BASE).replace(/\/+$/, '');

async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutSignal = AbortSignal.timeout(10000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
    signal,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let metadata;
    try {
      const payload = await response.json();
      const detail = payload?.detail;
      message = (typeof detail === 'string' ? detail : detail?.message) || payload?.message || message;
      metadata = detail?.metadata || payload?.metadata;
    } catch (error) {
      // Ignore JSON parse failures and keep the default HTTP status message.
    }
    const requestError = new Error(message);
    requestError.metadata = metadata;
    throw requestError;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function normalizeRiskTier(value) {
  const normalized = String(value || 'INFO').toUpperCase();
  if (normalized.includes('SEVERE') || normalized === 'CRITICAL') return 'SEVERE';
  if (normalized.includes('WARNING')) return 'WARNING';
  if (normalized.includes('WATCH')) return 'WATCH';
  return 'INFO';
}

export function averageCoordinateFromPolygon(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return { lat: 0, lon: 0 };

  const flattened = geometry.coordinates.flat(Infinity);
  if (flattened.length < 2) return { lat: 0, lon: 0 };

  let latSum = 0;
  let lonSum = 0;
  let count = 0;

  for (let i = 0; i < flattened.length; i += 2) {
    if (typeof flattened[i] !== 'number' || typeof flattened[i + 1] !== 'number') continue;
    lonSum += flattened[i];
    latSum += flattened[i + 1];
    count += 1;
  }

  if (!count) return { lat: 0, lon: 0 };

  return {
    lat: latSum / count,
    lon: lonSum / count,
  };
}

export function normalizeLiveCellFeature(feature) {
  const props = feature?.properties || {};
  const centroid = averageCoordinateFromPolygon(feature?.geometry);
  const tier = normalizeRiskTier(props.risk_level);
  const confidence = Number(props.confidence ?? 0.5);

  return {
    cellId: props.cell_uid || feature?.id || `CELL-${Math.random().toString(36).slice(2, 8)}`,
    cellName: props.name || 'Live Convective Cell',
    hazardType: props.feature_type || 'CONVECTIVE CELL',
    sector: `${props.state || 'Operational'} • ${props.district || 'Field Sector'}`,
    tier,
    lat: centroid.lat || props.lat || 0,
    lon: centroid.lon || props.lon || 0,
    speedKmh: Number(props.speed_kmh ?? 30),
    headingDeg: Number(props.bearing_deg ?? 45),
    headingText: `${props.bearing_deg ?? 45}°`,
    radarDbz: Number(props.reflectivity_dbz ?? 0),
    echoTopKm: Number(props.cloud_top_temp_c ? Math.abs(props.cloud_top_temp_c) / 10 : 0),
    vilKgM2: Number(props.reflectivity_dbz ? Math.max(20, props.reflectivity_dbz * 1.1) : 0),
    cttCelsius: Number(props.cloud_top_temp_c ?? -30),
    lightningRate: Number(props.lightning_rate_per_min ?? props.lightning_rate ?? 0),
    rainRateMmHr: Number(props.rain_rate_mm_hr ?? 0),
    windGustKmh: Number(props.wind_gust_kmh ?? 0),
    etaMinutes: Number(props.lead_time_minutes ?? 15),
    etaClock: `${Number(props.lead_time_minutes ?? 15)} min`,
    confidenceScore: Number.isFinite(confidence) ? confidence : 0.5,
    baseRisk: 0.12,
    predictedRisk: Number.isFinite(confidence) ? confidence : 0.5,
    rawFeatures: {
      cape: {
        value: null,
        unit: 'J/kg',
        label: 'Surface-Based CAPE',
        climatology: 1850,
        sensor: 'Open-Meteo NWP pending point sounding',
      },
      cloudTopGlaciation: {
        value: Number(props.cloud_top_temp_c ?? 0),
        unit: '°C',
        coolingRate: `${props.cloud_top_cooling_rate ?? 0} °C / 15min`,
        label: 'Cloud-Top Glaciation (IR)',
        climatology: -42.0,
        sensor: 'INSAT / Infrared Retrieval',
      },
      lightningRate: {
        value: Number(props.lightning_rate_per_min ?? props.lightning_rate ?? 0),
        unit: 'strikes/min',
        threshold: '>0 strikes/min',
        jumpSigma: '+0.0σ',
        label: 'Ground Lightning Flash Rate',
        climatology: 8.0,
        sensor: 'Operational Lightning Network',
      },
      dopplerShear: {
        value: null,
        unit: 'm/s',
        layer: '0–6 km Bulk Shear',
        label: '0–6 km Wind Shear',
        climatology: 14.0,
        sensor: 'Open-Meteo NWP pending point sounding',
      },
    },
    shapAttributions: [],
    description: `${props.name || 'Convective cell'} is active with ${tier.toLowerCase()} risk and ${props.confidence ? `${(props.confidence * 100).toFixed(1)}%` : 'moderate'} model confidence.`,
    growthTrend: 'Live backend feed',
    lastUpdated: 'just now',
    impactTargets: [],
  };
}

export function normalizeLiveCells(payload) {
  if (!payload || !Array.isArray(payload.features)) return [];
  return payload.features
    .filter((feature) => feature?.properties?.feature_type === 'CURRENT_CONVECTIVE_CELL')
    .map(normalizeLiveCellFeature);
}

export async function fetchLiveFusionGrid(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return apiFetch(`/live-fusion-grid${queryString ? `?${queryString}` : ''}`);
}

export async function fetchHealthStatus() {
  return apiFetch('/health');
}

export async function fetchSatelliteFeed(params = {}, options = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query.set(key, String(value));
  });
  return apiFetch(`/ingestion/satellite${query.size ? `?${query.toString()}` : ''}`, options);
}

export async function fetchRadarFeed(options = {}) {
  return apiFetch('/ingestion/radar', options);
}

export async function fetchLightningFeed(options = {}) {
  return apiFetch('/ingestion/lightning', options);
}

/**
 * @typedef {Object} InstabilityNwpPayload
 * @property {number | null} current_cape
 * @property {number | null} cin_estimate
 * @property {number | null} lifted_index
 * @property {number | null} max_gust_kmh
 * @property {number | null} wind_shear_ms
 * @property {number | null} pwat_mm
 * @property {number | null} precipitation_mm
 * @property {number | null} surface_pressure_hpa
 * @property {string} timestamp
 * @property {{source: string, mode: 'LIVE' | 'CACHED' | 'PARTIAL' | 'OFFLINE', latency_ms: number, model: string}} metadata
 */

/** @returns {Promise<InstabilityNwpPayload>} */
export async function fetchInstabilityIndex({ lat, lon, model = 'ncep_gfs_seamless', signal }) {
  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    model,
  });

  return apiFetch(`/instability-index?${query.toString()}`, { signal });
}
