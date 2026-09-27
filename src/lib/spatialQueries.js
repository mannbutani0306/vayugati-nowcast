/**
 * PostGIS-backed operational query and alert mutation helpers.
 * Geometry-only utilities in this module do not perform data fallback.
 */

import { supabase, isSupabaseConfigured, supabaseConfigurationError } from './supabaseClient';

const EARTH_RADIUS_KM = 6371.0088;

function requireDatabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(supabaseConfigurationError || 'Offline Database: Supabase is unavailable.');
  }
  return supabase;
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const radians = Math.PI / 180;
  const deltaLat = (lat2 - lat1) * radians;
  const deltaLon = (lon2 - lon1) * radians;
  const lat1Radians = lat1 * radians;
  const lat2Radians = lat2 * radians;
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1Radians) * Math.cos(lat2Radians) * Math.sin(deltaLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateBoundingBox(polygonCoordinates) {
  if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length === 0) {
    throw new Error('Polygon coordinates are required to calculate bounds.');
  }
  let coordinates = polygonCoordinates;
  if (Array.isArray(coordinates[0]?.[0])) coordinates = coordinates[0];

  const points = coordinates.map((pair) => {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    let [latitude, longitude] = pair.map(Number);
    if (latitude > 50 && longitude < 40) [latitude, longitude] = [longitude, latitude];
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
  }).filter(Boolean);
  if (!points.length) throw new Error('Polygon does not contain valid WGS84 coordinates.');

  const latitudes = points.map(([latitude]) => latitude);
  const longitudes = points.map(([, longitude]) => longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const bounds = [[minLat, minLon], [maxLat, maxLon]];
  return Object.assign(bounds, { minLat, minLon, maxLat, maxLon, leafletBounds: bounds });
}

export function destinationPoint(lat, lon, distanceKm, bearingDeg) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = bearingDeg * Math.PI / 180;
  const latitude = lat * Math.PI / 180;
  const longitude = lon * Math.PI / 180;
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance)
      + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const y = Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude);
  const x = Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(destinationLatitude);
  const destinationLongitude = longitude + Math.atan2(y, x);
  return { lat: destinationLatitude * 180 / Math.PI, lon: destinationLongitude * 180 / Math.PI };
}

export function computeCellBBox(lat, lon, radiusKm) {
  if (![lat, lon, radiusKm].every(Number.isFinite) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || radiusKm <= 0) {
    throw new Error('Valid WGS84 coordinates and positive radius are required.');
  }
  const latitudeDelta = radiusKm / EARTH_RADIUS_KM * 180 / Math.PI;
  const cosineLatitude = Math.cos(lat * Math.PI / 180);
  const longitudeDelta = Math.abs(cosineLatitude) < 1e-8 ? 180 : radiusKm / (EARTH_RADIUS_KM * cosineLatitude) * 180 / Math.PI;
  const minLat = Math.max(-90, lat - latitudeDelta);
  const maxLat = Math.min(90, lat + latitudeDelta);
  const minLon = Math.max(-180, lon - longitudeDelta);
  const maxLon = Math.min(180, lon + longitudeDelta);
  return { minLat, minLon, maxLat, maxLon, bounds: [[minLat, minLon], [maxLat, maxLon]] };
}

export function generateMotionConePolygon(centerLat, centerLon, speedKmh, headingDeg, leadMinutes = 60, spreadAngleDeg = 20) {
  if (![centerLat, centerLon, speedKmh, headingDeg, leadMinutes, spreadAngleDeg].every(Number.isFinite)) {
    throw new Error('Finite motion-cone inputs are required.');
  }
  const distance = speedKmh * leadMinutes / 60;
  const baseRadius = 2.5;
  const apex = destinationPoint(centerLat, centerLon, distance, headingDeg);
  const leftFlank = destinationPoint(centerLat, centerLon, distance * 1.05, (headingDeg - spreadAngleDeg + 360) % 360);
  const rightFlank = destinationPoint(centerLat, centerLon, distance * 1.05, (headingDeg + spreadAngleDeg) % 360);
  const leftBase = destinationPoint(centerLat, centerLon, baseRadius, (headingDeg + 270) % 360);
  const rightBase = destinationPoint(centerLat, centerLon, baseRadius, (headingDeg + 90) % 360);
  const midLeft = destinationPoint(centerLat, centerLon, distance / 2, (headingDeg - spreadAngleDeg * 0.7 + 360) % 360);
  const midRight = destinationPoint(centerLat, centerLon, distance / 2, (headingDeg + spreadAngleDeg * 0.7) % 360);
  return [
    [leftBase.lat, leftBase.lon], [midLeft.lat, midLeft.lon], [leftFlank.lat, leftFlank.lon],
    [apex.lat, apex.lon], [rightFlank.lat, rightFlank.lon], [midRight.lat, midRight.lon],
    [rightBase.lat, rightBase.lon], [centerLat, centerLon], [leftBase.lat, leftBase.lon],
  ];
}

export function isPointInPolygon(point, polygon) {
  if (!Array.isArray(point) || point.length < 2 || !Array.isArray(polygon) || polygon.length < 3) return false;
  const [latitude, longitude] = point;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [currentLat, currentLon] = polygon[index];
    const [previousLat, previousLon] = polygon[previous];
    const crosses = (currentLon > longitude) !== (previousLon > longitude)
      && latitude < ((previousLat - currentLat) * (longitude - currentLon)) / (previousLon - currentLon) + currentLat;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function calculatePolygonCentroid(polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) throw new Error('Polygon vertices are required.');
  const points = polygon.filter((point) => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite));
  if (!points.length) throw new Error('Polygon contains no valid coordinate pairs.');
  return {
    lat: points.reduce((sum, point) => sum + point[0], 0) / points.length,
    lon: points.reduce((sum, point) => sum + point[1], 0) / points.length,
  };
}

export async function fetchNearbyAlerts(latitude, longitude, radiusKm = 25) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { data: [], error: new Error('Valid WGS84 latitude and longitude are required.'), isOffline: false };
  }
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
    return { data: [], error: new Error('radiusKm must be between 0 and 500.'), isOffline: false };
  }
  let client;
  try {
    client = requireDatabase();
    const { data, error } = await client.rpc('get_active_alerts_within_radius', {
      user_lat: latitude,
      user_lon: longitude,
      radius_km: radiusKm,
    });
    if (error) return { data: [], error, isOffline: true };
    const severityTier = { Extreme: 'SEVERE', Severe: 'WARNING', Moderate: 'WATCH', Minor: 'INFO', Unknown: 'INFO' };
    return {
      data: (data || []).map((row) => ({
        ...row,
        id: row.alert_id,
        tier: severityTier[row.severity] || 'INFO',
        headline: row.headline_en,
        instruction: row.description_en,
        distanceKm: row.distance_km,
        etaMinutes: row.eta_minutes,
        isDirectHit: row.is_direct_intersection,
        speedKmh: row.cell_speed_kmh == null ? null : Number(row.cell_speed_kmh),
        bearingDeg: row.cell_bearing_deg == null ? null : Number(row.cell_bearing_deg),
        cellCentroid: row.cell_centroid_geojson || null,
        affectedGrid: row.identifier,
      })),
      error: null,
      isOffline: false,
    };
  } catch (error) {
    console.error('PostGIS nearby-alert query failed:', error);
    return { data: [], error, isOffline: true };
  }
}

export const getNearbyAlerts = fetchNearbyAlerts;

function pointFromGeoJson(geometry) {
  const coordinates = geometry?.coordinates;
  return Array.isArray(coordinates) && coordinates.length >= 2
    ? { lon: Number(coordinates[0]), lat: Number(coordinates[1]) }
    : { lon: null, lat: null };
}

function ringToCapString(geometry) {
  const ring = geometry?.coordinates?.[0];
  if (!Array.isArray(ring)) return '';
  return ring.map(([longitude, latitude]) => `${latitude},${longitude}`).join(' ');
}

function severityToTier(severity) {
  if (severity === 'Extreme') return 'SEVERE';
  if (severity === 'Severe') return 'WARNING';
  if (severity === 'Moderate') return 'WATCH';
  if (severity === 'Minor') return 'INFO';
  return 'INFO';
}

export async function fetchOfficerAlerts() {
  const client = requireDatabase();
  const { data, error } = await client.rpc('get_officer_cap_alerts');
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    trainingOnly: row.event_type === 'TRAINING_EXERCISE',
    cellId: row.cell_uid || row.id,
    cellName: row.location_label || row.cell_uid || row.event_type,
    hazardType: row.event_type,
    tier: severityToTier(row.severity),
    location: row.location_label || 'Area described by alert polygon',
    targetGrid: row.location_label || 'PostGIS alert geometry',
    affectedDistricts: [],
    riskScore: row.risk_score == null ? null : Number(row.risk_score),
    etaMinutes: row.eta_minutes,
    etaClock: row.eta_minutes == null ? 'Not provided' : `${row.eta_minutes} min`,
    leadTimeMinutes: row.eta_minutes,
    leadTimeHours: row.eta_minutes == null ? 'Not provided' : `${(row.eta_minutes / 60).toFixed(1)} h`,
    maxDbz: row.max_dbz,
    maxReflectivityDbz: row.max_dbz,
    rainRateMmHr: row.rain_rate_mm_hr,
    expectedRainfallRateMmHr: row.rain_rate_mm_hr,
    windGustKmh: row.wind_gust_kmh,
    createdTimestamp: row.created_at,
    polygon: ringToCapString(row.affected_zone_geojson),
    geometry: row.affected_zone_geojson,
    reviewedBy: row.approved_by,
    reviewedAt: row.approved_at || row.updated_at,
    headline_en: row.headline_en,
    headline: row.headline_en,
    description: row.description_en,
    aiDraftedText: row.description_en || row.headline_en,
    aiRationale: 'Review the source observations and warning geometry before broadcast.',
    rejectionReason: row.rejection_reason,
    status: row.status,
  }));
}

export async function fetchActiveConvectiveCells() {
  const client = requireDatabase();
  const { data, error } = await client.rpc('get_active_convective_cells');
  if (error) throw error;
  return (data || []).map((row) => {
    const center = pointFromGeoJson(row.centroid_geojson);
    return {
      databaseId: row.database_id,
      cellId: row.cell_uid,
      cellName: row.name || row.cell_uid,
      hazardType: 'CONVECTIVE CELL',
      sector: [row.district, row.state].filter(Boolean).join(', '),
      tier: row.risk_level,
      lat: center.lat,
      lon: center.lon,
      speedKmh: Number(row.speed_kmh ?? 0),
      headingDeg: Number(row.bearing_deg ?? 0),
      radarDbz: Number(row.reflectivity_dbz),
      echoTopKm: null,
      vilKgM2: null,
      cttCelsius: row.cloud_top_temp_c == null ? null : Number(row.cloud_top_temp_c),
      lightningRate: Number(row.lightning_rate_per_min ?? 0),
      rainRateMmHr: null,
      windGustKmh: null,
      etaMinutes: null,
      etaClock: 'Not provided',
      confidenceScore: null,
      baseRisk: null,
      predictedRisk: null,
      rawFeatures: {},
      shapAttributions: [],
      description: `Database track updated ${row.updated_at}`,
      growthTrend: 'Supabase PostGIS track',
      lastUpdated: row.updated_at,
      impactTargets: [],
      trackGeometry: row.track_geojson,
    };
  });
}

export async function recordForecasterAction({ actorId, action, entityType, entityId, rationale, oldValues, newValues }) {
  const client = requireDatabase();
  if (!actorId || !entityId || !action || !entityType) throw new Error('Actor, action, entity type, and entity id are required for audit logging.');
  const { error } = await client.from('audit_logs').insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    rationale: rationale || null,
    old_values: oldValues || null,
    new_values: newValues || null,
  });
  if (error) throw error;
  return { recorded: true };
}

export async function fetchCapAlertAuditLogs(limit = 100) {
  const client = requireDatabase();
  const { data, error } = await client.rpc('get_cap_alert_audit_logs', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

export function subscribeToLiveCells(onCellUpdateCallback, onStatus) {
  if (typeof onCellUpdateCallback !== 'function') throw new Error('A cell update callback is required.');
  const client = requireDatabase();
  const channel = client
    .channel('public:convective_cells')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'convective_cells' }, (payload) => {
      onCellUpdateCallback({ eventType: payload.eventType, cell: payload.new, oldCell: payload.old, timestamp: new Date().toISOString() });
    })
    .subscribe((status) => onStatus?.(status));
  return { unsubscribe: () => channel.unsubscribe() };
}

export function subscribeToCapAlerts(onAlert, onStatus) {
  if (typeof onAlert !== 'function') throw new Error('A CAP alert callback is required.');
  const client = requireDatabase();
  const channel = client
    .channel('public:cap_alerts:officer')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cap_alerts' }, (payload) => {
      onAlert({ eventType: payload.eventType, alert: payload.new, oldAlert: payload.old });
    })
    .subscribe((status) => onStatus?.(status));
  return { unsubscribe: () => channel.unsubscribe() };
}

export function subscribeToApprovedAlerts(onAlert, onStatus) {
  if (typeof onAlert !== 'function') throw new Error('An approved-alert callback is required.');
  const client = requireDatabase();
  const channel = client
    .channel('public:cap_alerts')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cap_alerts', filter: 'status=eq.APPROVED' }, ({ new: row }) => {
      if (row?.status === 'APPROVED') onAlert(row);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cap_alerts', filter: 'status=eq.APPROVED' }, ({ new: row }) => {
      if (row?.status === 'APPROVED') onAlert(row);
    })
    .subscribe((status) => onStatus?.(status));
  return { unsubscribe: () => channel.unsubscribe() };
}

function polygonToEwkt(value) {
  let points;
  if (typeof value === 'string') {
    points = value.trim().split(/\s+/).map((pair) => {
      const [latitude, longitude] = pair.split(',').map(Number);
      return [longitude, latitude];
    });
  } else if (value?.type === 'Polygon' && Array.isArray(value.coordinates?.[0])) {
    points = value.coordinates[0].map(([longitude, latitude]) => [Number(longitude), Number(latitude)]);
  } else {
    throw new Error('A polygon boundary is required to save a CAP alert.');
  }
  if (points.length < 4 || points.some(([longitude, latitude]) => !Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90)) {
    throw new Error('The CAP alert polygon must contain at least three valid WGS84 vertices.');
  }
  const [firstLon, firstLat] = points[0];
  const [lastLon, lastLat] = points[points.length - 1];
  if (firstLon !== lastLon || firstLat !== lastLat) points.push([firstLon, firstLat]);
  return `SRID=4326;POLYGON((${points.map(([longitude, latitude]) => `${longitude} ${latitude}`).join(',')}))`;
}

export async function submitDraftAlert(alertData) {
  if (!alertData?.headline_en) return { data: null, error: new Error('A CAP alert headline is required.') };
  try {
    const client = requireDatabase();
    const tierSeverity = { SEVERE: 'Extreme', WARNING: 'Severe', WATCH: 'Moderate', INFO: 'Minor' };
    const payload = {
      identifier: alertData.identifier || `IN-IMD-NOWCAST-${crypto.randomUUID()}`,
      sender: alertData.sender || 'dutyforecaster.nowcast@imd.gov.in',
      event_type: alertData.event_type || alertData.hazardType || 'THUNDERSTORM',
      urgency: alertData.urgency || 'Immediate',
      severity: alertData.severity || tierSeverity[alertData.tier] || 'Severe',
      certainty: alertData.certainty || 'Observed',
      headline_en: alertData.headline_en,
      headline_hi: alertData.headline_hi || '',
      headline_mr: alertData.headline_mr || '',
      description_en: alertData.description_en || alertData.description || '',
      description_hi: alertData.description_hi || '',
      description_mr: alertData.description_mr || '',
      affected_zone: polygonToEwkt(alertData.affected_zone || alertData.polygon),
      cell_uid: alertData.cell_uid || alertData.cellId || null,
      location_label: alertData.location || alertData.cellName || null,
      risk_score: alertData.risk_score ?? alertData.riskScore ?? null,
      eta_minutes: alertData.eta_minutes ?? alertData.etaMinutes ?? null,
      max_dbz: alertData.max_dbz ?? alertData.maxDbz ?? null,
      rain_rate_mm_hr: alertData.rain_rate_mm_hr ?? alertData.rainRateMmHr ?? null,
      wind_gust_kmh: alertData.wind_gust_kmh ?? alertData.windGustKmh ?? null,
      status: 'DRAFT',
    };
    const { data, error } = await client.from('cap_alerts').insert(payload).select().single();
    return { data, error };
  } catch (error) {
    console.error('Failed to persist CAP draft in Supabase:', error);
    return { data: null, error };
  }
}

export async function approveAlert(alertId) {
  if (!alertId) return { data: null, error: new Error('A CAP alert id is required.') };
  try {
    const client = requireDatabase();
    return await client.rpc('approve_cap_alert', { p_alert_id: alertId });
  } catch (error) {
    console.error('Failed to approve CAP alert in Supabase:', error);
    return { data: null, error };
  }
}

export async function beginAlertReview(alertId, editedText = {}) {
  if (!alertId) return { data: null, error: new Error('A CAP alert id is required.') };
  try {
    const client = requireDatabase();
    return await client.rpc('begin_cap_alert_review', {
      p_alert_id: alertId,
      p_headline_en: editedText.headline_en || null,
      p_description_en: editedText.description_en || null,
      p_severity: editedText.severity || null,
      p_location_label: editedText.location_label || null,
      p_eta_minutes: Number.isInteger(editedText.eta_minutes) ? editedText.eta_minutes : null,
      p_headline_hi: editedText.headline_hi || null,
      p_headline_mr: editedText.headline_mr || null,
      p_description_hi: editedText.description_hi || null,
      p_description_mr: editedText.description_mr || null,
    });
  } catch (error) {
    console.error('Failed to transition CAP alert into review:', error);
    return { data: null, error };
  }
}

export async function rejectAlert(alertId, rationale) {
  if (!alertId) return { data: null, error: new Error('A CAP alert id is required.') };
  try {
    const client = requireDatabase();
    return await client.rpc('reject_cap_alert', { p_alert_id: alertId, p_rationale: rationale });
  } catch (error) {
    console.error('Failed to reject CAP alert in Supabase:', error);
    return { data: null, error };
  }
}

export async function cancelAlert(alertId, rationale) {
  if (!alertId) return { data: null, error: new Error('A CAP alert id is required.') };
  try {
    const client = requireDatabase();
    return await client.rpc('cancel_cap_alert', { p_alert_id: alertId, p_rationale: rationale });
  } catch (error) {
    console.error('Failed to cancel CAP alert in Supabase:', error);
    return { data: null, error };
  }
}
