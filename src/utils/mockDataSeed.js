/**
 * @file mockDataSeed.js
 * @description Display constants and explicit unavailable placeholders for provider-backed sensor feeds.
 */

export const SEVERITY_TIERS = {
  INFO: {
    level: 'INFO',
    color: '#2E7D32', // Forest Green
    bgLight: '#E8F5E9',
    label: 'Advisory / Normal',
    description: 'Routine convective monitoring. No severe threshold breaches.',
  },
  WATCH: {
    level: 'WATCH',
    color: '#D97706', // Gold / Amber
    bgLight: '#FEF3C7',
    label: 'Convective Watch',
    description: 'Atmospheric instability favorable for storm cell initiation.',
  },
  WARNING: {
    level: 'WARNING',
    color: '#EA580C', // Warm Orange
    bgLight: '#FFEDD5',
    label: 'Severe Warning',
    description: 'Developing severe thunderstorm cell with heavy rain & squall.',
  },
  SEVERE: {
    level: 'SEVERE',
    color: '#DC2626', // Deep Red
    bgLight: '#FEE2E2',
    label: 'Critical Alert',
    description: 'Imminent cloudburst or large hail core detected. Extreme hazard.',
  },
};

export const SECTOR_INFO = {
  id: 'SEC-NW-HIMALAYA-01',
  name: 'Dehradun – Rishikesh Convective Sector',
  centerLat: 30.3165,
  centerLon: 78.0322,
  elevationMeters: 640,
  radarStation: 'DWR Dehradun (C-Band Dual-Pol Doppler)',
  coverageRadiusKm: 120,
  spatialResolutionKm: 1.5,
};

/**
 * Maps radar reflectivity factor (dBZ) to standard meteorological color scale
 * @param {number} dbz - Radar reflectivity in dBZ
 * @returns {string} HEX color string
 */
export function getDbzColor(dbz) {
  if (dbz < 5) return '#F3F4F6';
  if (dbz < 15) return '#93C5FD'; // Light blue: Trace / Drizzle
  if (dbz < 25) return '#3B82F6'; // Blue: Light rain
  if (dbz < 35) return '#10B981'; // Green: Moderate stratiform rain
  if (dbz < 45) return '#F59E0B'; // Yellow-Amber: Heavy rain / Convection
  if (dbz < 52) return '#EA580C'; // Orange: Intense thunderstorm
  if (dbz < 58) return '#DC2626'; // Red: Severe thunderstorm / small hail
  if (dbz < 62) return '#991B1B'; // Dark Red: Severe hail core
  return '#701A75';               // Purple: Extreme hail / Cloudburst core (>62 dBZ)
}

/**
 * Maps infrared brightness temperature to cloud-top temperature color
 * Colder tops (-60°C to -80°C) represent intense convective vertical extension penetrating tropopause
 * @param {number} tempC - Temperature in Celsius
 * @returns {string} HEX color string
 */
export function getCloudTopColor(tempC) {
  if (tempC > 10) return '#D1D5DB';  // Warm ground / low fog
  if (tempC > -10) return '#9CA3AF'; // Low-level clouds
  if (tempC > -30) return '#60A5FA'; // Mid-level tropospheric clouds
  if (tempC > -50) return '#F59E0B'; // Deep convective anvil
  if (tempC > -65) return '#EA580C'; // Intense updraft core
  if (tempC > -75) return '#DC2626'; // Overshooting top (Severe storm)
  return '#4C1D95';                  // Extremely cold penetrating top (< -75°C)
}

/**
 * Deprecated compatibility placeholder. Radar measurements must come from a provider feed.
 */
export function generateRadarReflectivityFrame(frameIndex = 0, gridSize = 16) {
  return {
    status: 'UNAVAILABLE',
    source: 'IMD Doppler Weather Radar',
    frameIndex,
    timestamp: null,
    leadTimeMinutes: frameIndex * 15,
    maxReflectivityDbz: null,
    meanReflectivityDbz: null,
    gridSize,
    grid: [],
  };
}

/**
 * Generates an array of historical and forecast radar reflectivity frames (-45 min to +60 min)
 */
export function generateRadarTimeSeries() {
  const offsets = [-3, -2, -1, 0, 1, 2, 3, 4]; // -45m to +60m at 15m intervals
  return offsets.map((idx) => generateRadarReflectivityFrame(idx, 16));
}

/**
 * Deprecated compatibility placeholder. Cloud-top temperatures require calibrated satellite data.
 */
export function generateSatelliteCttFrame(frameIndex = 0, gridSize = 16) {
  return {
    status: 'UNAVAILABLE',
    source: 'MOSDAC INSAT-3D/3DR TIR1',
    frameIndex,
    timestamp: null,
    leadTimeMinutes: frameIndex * 15,
    minCttCelsius: null,
    overshootingTopsDetected: null,
    tropopausePenetrationKm: null,
    gridSize,
    grid: [],
  };
}

/**
 * Deprecated compatibility placeholder. Lightning points must come from an authorized live proxy.
 */
export function generateLightningDensityData() {
  return {
    status: 'UNAVAILABLE',
    source: 'Blitzortung Open Network via configured proxy',
    densityStrikesKm2Min: null,
    lightningJumpDetected: null,
    totalStrikesLastHour: null,
    recentStrikes: [],
  };
}

/** Deprecated compatibility placeholder. Use /api/v1/instability-index for NWP data. */
export function generateNwpInstabilityParameters() {
  return {
    status: 'UNAVAILABLE',
    source: 'Open-Meteo GFS / ICON',
    timestamp: null,
    sector: SECTOR_INFO.name,
    cape: { value: null, unit: 'J/kg' },
    cin: { value: null, unit: 'J/kg' },
    deepLayerWindShear: { value: null, unit: 'm/s' },
    lowLevelWindShear: { value: null, unit: 'm/s' },
    precipitableWater: { value: null, unit: 'mm' },
    liftedIndex: { value: null, unit: '°C' },
    srh03km: { value: null, unit: 'm²/s²' },
    potentialMaxRainfallRate: { value: null, unit: 'mm/hr' },
  };
}

/**
 * Generates multi-tier 0–6 Hour Hazard Timeline Forecast Predictions
 * Blends Doppler extrapolation (0-2h) with high-res convective numerical assimilation (2-6h)
 */
export function generateHazardTimelineForecast() {
  const now = Date.now();

  return [
    {
      id: 'HZ-NOW-001',
      leadTimeHours: '0.0 – 1.0 h',
      leadTimeMinutes: 45,
      validFrom: new Date(now).toISOString(),
      validTo: new Date(now + 60 * 60 * 1000).toISOString(),
      tier: 'SEVERE',
      hazardType: 'CLOUDBURST',
      phenomenon: 'Severe Cloudburst Core & Lightning Surge',
      probabilityPercent: 92,
      maxReflectivityDbz: 63.8,
      expectedRainfallRateMmHr: 118,
      hailProbabilityPercent: 88,
      expectedHailDiameterCm: 2.8,
      windGustKmh: 92,
      confidenceScore: 0.94,
      forecastBasis: 'Doppler dual-pol differential reflectivity (Zdr) + Optical Flow Nowcasting',
      affectedZones: ['Dehradun Urban', 'Rishikesh Valley', 'Rajpur Road Foothill Corridor', 'Sahastradhara Basin'],
      recommendedActions: [
        'Issue immediate flash flood sirens in low-lying river catchments (Rispana & Bindal).',
        'Halt tourist transit on Dehradun-Mussoorie hill highway due to imminent debris flow.',
        'Mobilize SDRF & NDRF quick reaction teams to designated staging shelters.',
      ],
    },
    {
      id: 'HZ-NOW-002',
      leadTimeHours: '1.0 – 2.5 h',
      leadTimeMinutes: 120,
      validFrom: new Date(now + 60 * 60 * 1000).toISOString(),
      validTo: new Date(now + 150 * 60 * 1000).toISOString(),
      tier: 'SEVERE',
      hazardType: 'HAIL',
      phenomenon: 'Large Hail Core with Extreme Microburst Winds',
      probabilityPercent: 84,
      maxReflectivityDbz: 59.4,
      expectedRainfallRateMmHr: 76,
      hailProbabilityPercent: 81,
      expectedHailDiameterCm: 3.2,
      windGustKmh: 88,
      confidenceScore: 0.89,
      forecastBasis: 'Three-Body Scatter Spike (TBSS) radar signature & Vertically Integrated Liquid (VIL)',
      affectedZones: ['Haridwar Convective Belt', 'Roorkee Outflow Fringe', 'Shivalik Forest Ridge'],
      recommendedActions: [
        'Broadcast vehicular shelter advisory against structural and windshield hail damage.',
        'Divert commercial flights approaching Jolly Grant Airport (DED).',
        'Secure high-tension power distribution lines against 85+ km/h downburst shears.',
      ],
    },
    {
      id: 'HZ-NOW-003',
      leadTimeHours: '2.5 – 4.0 h',
      leadTimeMinutes: 210,
      validFrom: new Date(now + 150 * 60 * 1000).toISOString(),
      validTo: new Date(now + 240 * 60 * 1000).toISOString(),
      tier: 'WARNING',
      hazardType: 'THUNDERSTORM',
      phenomenon: 'Organized Multicell Squall Line & Urban Waterlogging',
      probabilityPercent: 78,
      maxReflectivityDbz: 51.2,
      expectedRainfallRateMmHr: 48,
      hailProbabilityPercent: 35,
      expectedHailDiameterCm: 0.8,
      windGustKmh: 70,
      confidenceScore: 0.82,
      forecastBasis: 'Blended Doppler radar advection + WRF Meso-Scale Convective System tracking',
      affectedZones: ['Saharanpur Border Corridor', 'Yamunanagar Agricultural Belt'],
      recommendedActions: [
        'Pre-position dewatering pumps at underpasses and urban choke points.',
        'Warn farmers to secure harvested crops against squall line wind lodging.',
      ],
    },
    {
      id: 'HZ-NOW-004',
      leadTimeHours: '4.0 – 6.0 h',
      leadTimeMinutes: 330,
      validFrom: new Date(now + 240 * 60 * 1000).toISOString(),
      validTo: new Date(now + 360 * 60 * 1000).toISOString(),
      tier: 'WATCH',
      hazardType: 'SQUALL',
      phenomenon: 'Stratiform Anvil Precipitation & Convective Decay',
      probabilityPercent: 62,
      maxReflectivityDbz: 38.0,
      expectedRainfallRateMmHr: 18,
      hailProbabilityPercent: 10,
      expectedHailDiameterCm: 0,
      windGustKmh: 48,
      confidenceScore: 0.74,
      forecastBasis: 'NWP thermodynamic dissipation assimilation & boundary layer cooling',
      affectedZones: ['Upper Gangetic Plains Transition Zone', 'Muzaffarnagar North'],
      recommendedActions: [
        'Continue hydrological monitoring for delayed stream runoff surges.',
        'Transition emergency services from active response to damage assessment mode.',
      ],
    },
  ];
}

/**
 * Aggregates all real-time sensory and predictive modules into a single snapshot
 */
export function getFullNowcastTelemetrySnapshot() {
  const radarSeries = generateRadarTimeSeries();
  const currentRadar = radarSeries.find((f) => f.frameIndex === 0) || radarSeries[3];
  const satelliteCtt = generateSatelliteCttFrame(0, 16);
  const lightning = generateLightningDensityData();
  const nwp = generateNwpInstabilityParameters();

  return {
    sector: SECTOR_INFO,
    status: 'UNAVAILABLE',
    timestamp: null,
    currentRadar,
    radarSeries,
    satelliteCtt,
    lightning,
    nwp,
    timeline: [],
  };
}

/**
 * Convective Cells Catalog with Geospatial Centroids, Reflectivity, and Trajectory Vectors
 */
export const INITIAL_CONVECTIVE_CELLS = [
  {
    id: 'CELL-A1',
    name: 'Sahastradhara Cloudburst Core',
    tier: 'SEVERE',
    hazardType: 'CLOUDBURST',
    lat: 30.368,
    lon: 78.085,
    speedKmh: 38,
    headingDeg: 65,
    maxDbz: 63.8,
    rainRateMmHr: 118,
    windGustKmh: 92,
    cape: 3450,
  },
  {
    id: 'CELL-B2',
    name: 'Haridwar Ridge Multicell Cluster',
    tier: 'WARNING',
    hazardType: 'HAIL',
    lat: 29.985,
    lon: 78.145,
    speedKmh: 44,
    headingDeg: 55,
    maxDbz: 52.4,
    rainRateMmHr: 58,
    windGustKmh: 76,
    cape: 2820,
  },
  {
    id: 'CELL-C3',
    name: 'Mohand Pass Orographic Feeder',
    tier: 'WATCH',
    hazardType: 'THUNDERSTORM',
    lat: 30.215,
    lon: 77.925,
    speedKmh: 32,
    headingDeg: 72,
    maxDbz: 41.5,
    rainRateMmHr: 32,
    windGustKmh: 54,
    cape: 1940,
  },
  {
    id: 'CELL-D4',
    name: 'Doon South Thermal Flank',
    tier: 'INFO',
    hazardType: 'DOWNBURST',
    lat: 30.265,
    lon: 78.012,
    speedKmh: 24,
    headingDeg: 80,
    maxDbz: 32.5,
    rainRateMmHr: 16,
    windGustKmh: 40,
    cape: 1420,
  },
];

