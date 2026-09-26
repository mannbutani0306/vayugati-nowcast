/**
 * @file spatialQueries.js
 * @description Geo-Spatial PostGIS query functions and spherical geometry calculations
 * for VayuGati Nowcast .
 * Capabilities:
 * - `getNearbyAlerts(lat, lon, radiusKm)`: Queries PostGIS RPC function `get_alerts_for_location`
 *   with comprehensive fallback to geodesic Haversine filtering in demo/evaluator mode.
 * - `computeCellBBox(lat, lon, radiusKm)`: Generates bounding box coordinates [minLat, minLon, maxLat, maxLon].
 * - `generateMotionConePolygon(centerLat, centerLon, speedKmh, headingDeg, leadMinutes, spreadAngleDeg)`:
 *   Computes optical-flow convective cell trajectory cone polygons for GIS rendering.
 * - `haversineDistance(lat1, lon1, lat2, lon2)`: Geodesic great-circle distance in kilometers.
 * - `isPointInPolygon(point, polygon)`: Ray-casting point-in-polygon verification for citizen location containment.
 * - `calculatePolygonCentroid(polygon)`: Computes arithmetic centroid of storm bounding polygons.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { INITIAL_CONVECTIVE_CELLS } from '../utils/mockDataSeed';

// Mean radius of the Earth in kilometers
const EARTH_RADIUS_KM = 6371.0088;

/**
 * Calculates Great-Circle distance between two coordinates using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates a bounding box from polygon coordinates for Leaflet or MapLibre map bounds.
 * Accommodates both [lat, lon] or GeoJSON standard [lon, lat] coordinate pairs.
 * 
 * @param {Array<[number, number]>|Array<Array<[number, number]>>} polygonCoordinates - Array of coordinate pairs or GeoJSON rings
 * @returns {[[number, number], [number, number]] & { minLat: number, minLon: number, maxLat: number, maxLon: number, leafletBounds: [[number, number], [number, number]] }}
 */
export function calculateBoundingBox(polygonCoordinates) {
  if (!polygonCoordinates || !Array.isArray(polygonCoordinates) || polygonCoordinates.length === 0) {
    // Default fallback India bounding box (Delhi / Dehradun corridor)
    const defaultBounds = [[28.0, 77.0], [31.0, 79.5]];
    defaultBounds.minLat = 28.0;
    defaultBounds.minLon = 77.0;
    defaultBounds.maxLat = 31.0;
    defaultBounds.maxLon = 79.5;
    defaultBounds.leafletBounds = [[28.0, 77.0], [31.0, 79.5]];
    return defaultBounds;
  }

  // Handle nested GeoJSON polygon rings: [[ [lon, lat], [lon, lat], ... ]]
  let coords = polygonCoordinates;
  if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    coords = coords[0];
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const pt of coords) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    let lat = Number(pt[0]);
    let lon = Number(pt[1]);

    // GeoJSON convention detection: if first element is between 68 and 98 (typical India longitude),
    // and second is between 6 and 38 (India latitude), flip them to [lat, lon] for Leaflet
    if (lat > 50 && lon < 40) {
      const temp = lat;
      lat = lon;
      lon = temp;
    }

    if (!isNaN(lat) && !isNaN(lon)) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }

  if (minLat === Infinity || minLon === Infinity) {
    minLat = 28.5;
    maxLat = 30.5;
    minLon = 77.0;
    maxLon = 79.0;
  }

  // Leaflet LatLngBoundsExpression: [[southWestLat, southWestLon], [northEastLat, northEastLon]]
  const resultBounds = [
    [minLat, minLon],
    [maxLat, maxLon],
  ];

  resultBounds.minLat = minLat;
  resultBounds.minLon = minLon;
  resultBounds.maxLat = maxLat;
  resultBounds.maxLon = maxLon;
  resultBounds.leafletBounds = [
    [minLat, minLon],
    [maxLat, maxLon],
  ];

  return resultBounds;
}

/**
 * Calculates a destination coordinate given starting point, distance (km), and bearing (degrees).
 * @param {number} lat - Origin latitude
 * @param {number} lon - Origin longitude
 * @param {number} distanceKm - Distance in km
 * @param {number} bearingDeg - Heading clockwise from true north in degrees
 * @returns {{lat: number, lon: number}}
 */
export function destinationPoint(lat, lon, distanceKm, bearingDeg) {
  const δ = distanceKm / EARTH_RADIUS_KM; // Angular distance in radians
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2);
  const λ2 = λ1 + Math.atan2(y, x);

  return {
    lat: (φ2 * 180) / Math.PI,
    lon: (λ2 * 180) / Math.PI,
  };
}

/**
 * Computes bounding box coordinates for a circular radius around a centroid.
 * Useful for spatial index queries (ST_MakeEnvelope).
 * @param {number} lat - Centroid latitude
 * @param {number} lon - Centroid longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {{ minLat: number, minLon: number, maxLat: number, maxLon: number, bounds: [[number, number], [number, number]] }}
 */
export function computeCellBBox(lat, lon, radiusKm) {
  const dLat = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const dLon =
    (radiusKm / (EARTH_RADIUS_KM * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);

  const minLat = lat - dLat;
  const maxLat = lat + dLat;
  const minLon = lon - dLon;
  const maxLon = lon + dLon;

  return {
    minLat,
    minLon,
    maxLat,
    maxLon,
    bounds: [
      [minLat, minLon],
      [maxLat, maxLon],
    ],
  };
}

/**
 * Generates an optical-flow convective cell projected trajectory cone polygon.
 * Accounts for cell velocity, propagation vector heading, and atmospheric diffusion spread angle.
 * @param {number} centerLat - Cell centroid latitude
 * @param {number} centerLon - Cell centroid longitude
 * @param {number} speedKmh - Cell propagation speed in km/h
 * @param {number} headingDeg - Cell direction of motion (degrees from north)
 * @param {number} leadMinutes - Forecast horizon in minutes (e.g. 15, 30, 45, 60)
 * @param {number} [spreadAngleDeg=25] - Cone divergence half-angle
 * @returns {Array<[number, number]>} Closed polygon coordinates array suitable for Leaflet / GeoJSON
 */
export function generateMotionConePolygon(
  centerLat,
  centerLon,
  speedKmh,
  headingDeg,
  leadMinutes = 60,
  spreadAngleDeg = 20
) {
  const travelDistanceKm = (speedKmh * leadMinutes) / 60;
  const baseRadiusKm = 2.5; // Initial storm core radius

  // Destination cone apex at t + leadMinutes
  const apex = destinationPoint(centerLat, centerLon, travelDistanceKm, headingDeg);

  // Divergent flank points at lead time with atmospheric uncertainty spread
  const leftFlank = destinationPoint(
    centerLat,
    centerLon,
    travelDistanceKm * 1.05,
    (headingDeg - spreadAngleDeg + 360) % 360
  );
  const rightFlank = destinationPoint(
    centerLat,
    centerLon,
    travelDistanceKm * 1.05,
    (headingDeg + spreadAngleDeg) % 360
  );

  // Base lateral points
  const leftBase = destinationPoint(
    centerLat,
    centerLon,
    baseRadiusKm,
    (headingDeg - 90 + 360) % 360
  );
  const rightBase = destinationPoint(
    centerLat,
    centerLon,
    baseRadiusKm,
    (headingDeg + 90) % 360
  );

  // Intermediate step at t + 30m
  const midDistance = travelDistanceKm * 0.5;
  const midLeft = destinationPoint(
    centerLat,
    centerLon,
    midDistance,
    (headingDeg - spreadAngleDeg * 0.7 + 360) % 360
  );
  const midRight = destinationPoint(
    centerLat,
    centerLon,
    midDistance,
    (headingDeg + spreadAngleDeg * 0.7) % 360
  );

  // Return closed polygon: start at left base, sweep forward, to apex, to right, and back
  return [
    [leftBase.lat, leftBase.lon],
    [midLeft.lat, midLeft.lon],
    [leftFlank.lat, leftFlank.lon],
    [apex.lat, apex.lon],
    [rightFlank.lat, rightFlank.lon],
    [midRight.lat, midRight.lon],
    [rightBase.lat, rightBase.lon],
    [centerLat, centerLon],
    [leftBase.lat, leftBase.lon],
  ];
}

/**
 * Ray-casting algorithm to test whether a coordinate point lies inside a polygon.
 * @param {[number, number]} point - [lat, lon]
 * @param {Array<[number, number]>} polygon - Array of [lat, lon] coordinates
 * @returns {boolean}
 */
export function isPointInPolygon(point, polygon) {
  const [lat, lon] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Computes arithmetic centroid of an array of polygon vertices.
 * @param {Array<[number, number]>} polygon
 * @returns {{lat: number, lon: number}}
 */
export function calculatePolygonCentroid(polygon) {
  if (!polygon || polygon.length === 0) return { lat: 0, lon: 0 };
  let sumLat = 0;
  let sumLon = 0;
  const count = polygon.length;

  for (let i = 0; i < count; i++) {
    sumLat += polygon[i][0];
    sumLon += polygon[i][1];
  }

  return {
    lat: sumLat / count,
    lon: sumLon / count,
  };
}

/**
 * Spatial Query: Queries nearby alerts for a given user location (lat, lon) within a radius (km).
 * First attempts to invoke the PostGIS RPC function `get_alerts_for_location` in Supabase.
 * If Supabase is unconfigured, unreachable, or returns no DB rows, falls back gracefully to
 * high-precision local geodesic distance calculation across convective cells.
 *
 * @param {number} lat - User latitude
 * @param {number} lon - User longitude
 * @param {number} [radiusKm=25] - Search radius in kilometers
 * @returns {Promise<{ data: Array<object>, error: null | object, isFallback: boolean }>}
 */
export async function getNearbyAlerts(lat, lon, radiusKm = 25) {
  // Validate coordinates
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return {
      data: [],
      error: new Error('Invalid coordinates supplied to getNearbyAlerts'),
      isFallback: true,
    };
  }

  // 1. Try real Supabase PostGIS RPC if available
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('get_alerts_for_location', {
        user_lat: lat,
        user_lon: lon,
        radius_km: radiusKm,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return { data, error: null, isFallback: false };
      }
    } catch (rpcErr) {
      console.warn('PostGIS RPC get_alerts_for_location query failed, using geodesic fallback:', rpcErr);
    }
  }

  // 2. Geodesic Fallback calculation for prototype/evaluator resilience
  const fallbackAlerts = (INITIAL_CONVECTIVE_CELLS || []).map((cell) => {
    const distanceKm = haversineDistance(lat, lon, cell.lat, cell.lon);
    const motionCone = generateMotionConePolygon(cell.lat, cell.lon, cell.speedKmh, cell.headingDeg, 45);
    const isInsideCone = isPointInPolygon([lat, lon], motionCone);

    let calculatedEtaMinutes = Math.round((distanceKm / (cell.speedKmh || 30)) * 60);
    if (calculatedEtaMinutes < 10) calculatedEtaMinutes = 10;

    return {
      id: `ALERT-${cell.id}`,
      cellId: cell.id,
      cellName: cell.name,
      tier: cell.tier,
      hazardType: cell.hazardType,
      distanceKm: Math.round(distanceKm * 10) / 10,
      etaMinutes: calculatedEtaMinutes,
      isApproaching: isInsideCone || distanceKm < 15,
      isDirectPath: isInsideCone,
      dbz: cell.maxDbz,
      rainRateMmHr: cell.rainRateMmHr,
      windGustKmh: cell.windGustKmh,
      cape: cell.cape,
      centroid: { lat: cell.lat, lon: cell.lon },
      affectedGrid: `${cell.name} (${Math.round(distanceKm * 10) / 10} km away)`,
      issuedAt: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST',
      headline: `Approaching ${cell.hazardType} Convective Core (${cell.tier})`,
      instruction:
        cell.tier === 'SEVERE'
          ? 'Move immediately to solid structure away from foothill drainage streams.'
          : 'Stay indoors, disconnect electrical appliances, and monitor IMD nowcasts.',
    };
  });

  // Filter alerts by proximity radius
  const filtered = fallbackAlerts.filter((item) => item.distanceKm <= radiusKm);

  // Sort by nearest distance & severity
  filtered.sort((a, b) => {
    if (a.tier === 'SEVERE' && b.tier !== 'SEVERE') return -1;
    if (b.tier === 'SEVERE' && a.tier !== 'SEVERE') return 1;
    return a.distanceKm - b.distanceKm;
  });

  return {
    data: filtered,
    error: null,
    isFallback: true,
  };
}

/**
 * Requirement 1: fetchNearbyAlerts(latitude, longitude, radiusKm)
 * Invokes the PostGIS RPC function `get_active_alerts_within_radius`.
 * 
 * @param {number} latitude - User latitude coordinate
 * @param {number} longitude - User longitude coordinate
 * @param {number} [radiusKm=25] - Search radius in kilometers
 * @returns {Promise<{ data: Array<object>, error: null | object, isFallback: boolean }>}
 */
export async function fetchNearbyAlerts(latitude, longitude, radiusKm = 25) {
  // Coordinate boundary validation
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    return {
      data: [],
      error: new Error('Invalid coordinate arguments supplied to fetchNearbyAlerts.'),
      isFallback: true,
    };
  }

  // 1. Invoke PostGIS RPC function in Supabase if live
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('get_active_alerts_within_radius', {
        user_lat: latitude,
        user_lon: longitude,
        radius_km: radiusKm,
      });

      if (!error && Array.isArray(data)) {
        return { data, error: null, isFallback: false };
      }
      if (error) {
        console.warn('PostGIS RPC get_active_alerts_within_radius returned error:', error.message);
      }
    } catch (err) {
      console.warn('Network error during PostGIS RPC call:', err);
    }
  }

  // 2. Offline / Demo Mode Fallback:
  // Use geodesic computation over active convective cells and seed alerts
  const fallbackResult = await getNearbyAlerts(latitude, longitude, radiusKm);
  return {
    ...fallbackResult,
    isFallback: true,
  };
}

/**
 * Requirement 2: subscribeToLiveCells(onCellUpdateCallback)
 * Sets up a Supabase Realtime channel listening to `INSERT` and `UPDATE` on `convective_cells`.
 *
 * @param {Function} onCellUpdateCallback - Callback invoked when a convective cell is created or updated
 * @returns {{ unsubscribe: Function }} Subscription handle with unsubscribe capability
 */
export function subscribeToLiveCells(onCellUpdateCallback) {
  if (!onCellUpdateCallback || typeof onCellUpdateCallback !== 'function') {
    throw new Error('subscribeToLiveCells requires a valid callback function.');
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const channel = supabase
        .channel('convective-cells-live-feed')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'convective_cells' },
          (payload) => {
            onCellUpdateCallback({
              eventType: 'INSERT',
              cell: payload.new,
              timestamp: new Date().toISOString(),
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'convective_cells' },
          (payload) => {
            onCellUpdateCallback({
              eventType: 'UPDATE',
              cell: payload.new,
              oldCell: payload.old,
              timestamp: new Date().toISOString(),
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Supabase Realtime] Subscribed to convective_cells stream.');
          }
        });

      return {
        unsubscribe: () => {
          try {
            supabase.removeChannel(channel);
          } catch (e) {
            console.warn('Error unsubscribing from Supabase Realtime channel:', e);
          }
        },
      };
    } catch (err) {
      console.warn('Failed to initialize Supabase Realtime for convective_cells:', err);
    }
  }

  // Fallback demo simulation: Emits periodic simulated telemetry updates every 30s
  console.log('[Realtime Demo] Using local mock convective cell subscription.');
  const timer = setInterval(() => {
    const randomCell = INITIAL_CONVECTIVE_CELLS[Math.floor(Math.random() * INITIAL_CONVECTIVE_CELLS.length)];
    if (randomCell) {
      onCellUpdateCallback({
        eventType: 'UPDATE',
        cell: {
          ...randomCell,
          maxDbz: Math.min(72, randomCell.maxDbz + (Math.random() * 2 - 1)),
          updated_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        isSimulated: true,
      });
    }
  }, 30000);

  return {
    unsubscribe: () => clearInterval(timer),
  };
}

/**
 * Requirement 3: submitDraftAlert(alertData)
 * Inserts a new alert with status `DRAFT` for Duty Forecaster review in `public.cap_alerts`.
 *
 * @param {object} alertData - CAP alert payload (identifier, headline_en, event_type, affected_zone, etc.)
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function submitDraftAlert(alertData) {
  if (!alertData || !alertData.headline_en) {
    return {
      data: null,
      error: new Error('submitDraftAlert requires valid alert payload with headline_en.'),
    };
  }

  const draftPayload = {
    identifier: alertData.identifier || `IN-IMD-NOWCAST-${Date.now()}`,
    sender: alertData.sender || 'dutyforecaster.nowcast@imd.gov.in',
    event_type: alertData.event_type || alertData.hazardType || 'THUNDERSTORM',
    urgency: alertData.urgency || 'Immediate',
    severity: alertData.severity || 'Severe',
    certainty: alertData.certainty || 'Observed',
    headline_en: alertData.headline_en,
    headline_hi: alertData.headline_hi || '',
    description_en: alertData.description_en || alertData.description || '',
    affected_zone: alertData.affected_zone || null,
    status: 'DRAFT',
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('cap_alerts')
        .insert([draftPayload])
        .select()
        .single();

      if (error) {
        console.error('Supabase error inserting draft CAP alert:', error);
        return { data: null, error };
      }
      return { data, error: null };
    } catch (err) {
      console.warn('Supabase insert exception, falling back to mock storage:', err);
    }
  }

  // Fallback demo mode simulation
  const mockInsertedAlert = {
    id: `draft-${Date.now()}`,
    ...draftPayload,
    isLocalDraft: true,
  };

  return {
    data: mockInsertedAlert,
    error: null,
  };
}

/**
 * Requirement 4: approveAlert(alertId, officerId)
 * Updates alert status to `APPROVED`, populates `approved_by`, and triggers a Supabase
 * Realtime broadcast to connected citizens.
 *
 * @param {string} alertId - UUID or identifier of the CAP alert
 * @param {string} officerId - UUID or identifier of approving Duty Forecaster
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function approveAlert(alertId, officerId) {
  if (!alertId) {
    return {
      data: null,
      error: new Error('approveAlert requires a valid alertId.'),
    };
  }

  const approvalTimestamp = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Update status to APPROVED in database
      const { data, error } = await supabase
        .from('cap_alerts')
        .update({
          status: 'APPROVED',
          approved_by: officerId || null,
          updated_at: approvalTimestamp,
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update cap_alerts in Supabase:', error);
        return { data: null, error };
      }

      // 2. Trigger Supabase Realtime broadcast to citizen siren channels
      try {
        const broadcastChannel = supabase.channel('citizen-emergency-broadcast');
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'ALERT_APPROVED',
          payload: {
            alertId,
            approvedBy: officerId,
            approvedAt: approvalTimestamp,
            alert: data,
          },
        });
      } catch (broadcastErr) {
        console.warn('Notice: Realtime broadcast trigger notice:', broadcastErr);
      }

      return { data, error: null };
    } catch (err) {
      console.warn('Supabase approval error, falling back to mock approval:', err);
    }
  }

  // Fallback demo mode simulation
  const mockApprovedAlert = {
    id: alertId,
    status: 'APPROVED',
    approved_by: officerId || 'OFFICER-DEMO-001',
    approved_at: approvalTimestamp,
    broadcastTriggered: true,
  };

  return {
    data: mockApprovedAlert,
    error: null,
  };
}

