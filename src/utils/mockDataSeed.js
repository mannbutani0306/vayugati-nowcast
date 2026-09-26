/**
 * @file mockDataSeed.js
 * @description Meteorological mock data generators for VayuGati Nowcast .
 * Synthesizes high-resolution multi-sensor inputs:
 * 1. Radar Reflectivity (0–65 dBZ) grid frames (1–3 km spatial resolution)
 * 2. Satellite Cloud-Top Temperature (CTT: -80°C to +20°C)
 * 3. Lightning Strike Density (IC/CG strikes/km²/min)
 * 4. NWP Convective Instability Parameters (CAPE, CIN, Bulk Shear, PWAT, SRH)
 * 5. 0–6 Hour Hazard Timeline Predictions (Thunderstorm, Hail, Cloudburst)
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
 * Generates an N x N 2D grid frame representing Doppler radar reflectivity (0-65 dBZ)
 * Simulates convective cell initiation, intensification, and downwind advection
 * @param {number} frameIndex - Temporal step offset (-3 to +4)
 * @param {number} gridSize - Dimension of square grid (default 16x16)
 */
export function generateRadarReflectivityFrame(frameIndex = 0, gridSize = 16) {
  const grid = [];
  // Center of the simulated storm core moving east-northeastward over time
  const coreX = 6 + frameIndex * 1.1;
  const coreY = 5 + frameIndex * 0.9;
  const secondaryCoreX = 12 - frameIndex * 0.4;
  const secondaryCoreY = 11 + frameIndex * 0.3;

  for (let r = 0; r < gridSize; r++) {
    const row = [];
    for (let c = 0; c < gridSize; c++) {
      // Distance from primary convective cell core
      const dist1 = Math.sqrt(Math.pow(r - coreY, 2) + Math.pow(c - coreX, 2));
      // Distance from secondary merging feeder cell
      const dist2 = Math.sqrt(Math.pow(r - secondaryCoreY, 2) + Math.pow(c - secondaryCoreX, 2));

      // Peak reflectivity grows toward peak nowcast frame (T0 to T+30m)
      const maturity = Math.max(0.6, 1 - Math.abs(frameIndex - 1) * 0.12);
      const peakDbz = 64.5 * maturity;

      let dbz1 = peakDbz * Math.exp(-Math.pow(dist1 / 2.3, 2));
      let dbz2 = 48.0 * Math.exp(-Math.pow(dist2 / 2.0, 2));

      // Combine cell reflections with background atmospheric noise
      let combined = Math.max(dbz1, dbz2);
      if (combined < 8) {
        combined = Math.max(0, combined + (Math.sin(r * 2.1 + c * 1.7) * 2.5));
      }

      // Clamp strictly to meteorological Doppler scale (0 to 65 dBZ)
      const val = Math.min(65, Math.max(0, Math.round(combined * 10) / 10));
      row.push(val);
    }
    grid.push(row);
  }

  return {
    frameIndex,
    timestamp: new Date(Date.now() + frameIndex * 15 * 60 * 1000).toISOString(),
    leadTimeMinutes: frameIndex * 15,
    maxReflectivityDbz: Math.max(...grid.flat()),
    meanReflectivityDbz: Math.round((grid.flat().reduce((a, b) => a + b, 0) / (gridSize * gridSize)) * 10) / 10,
    gridSize,
    grid,
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
 * Generates Satellite Cloud-Top Temperature (CTT) frame (-80°C to +20°C)
 * Inverted correlation with radar: highest convective dBZ corresponds to lowest infrared temperatures
 * @param {number} frameIndex - Temporal step
 * @param {number} gridSize - Grid resolution
 */
export function generateSatelliteCttFrame(frameIndex = 0, gridSize = 16) {
  const radarFrame = generateRadarReflectivityFrame(frameIndex, gridSize);
  const grid = [];

  for (let r = 0; r < gridSize; r++) {
    const row = [];
    for (let c = 0; c < gridSize; c++) {
      const dbz = radarFrame.grid[r][c];
      // Convective core with > 55 dBZ generates overshooting tops down to -78°C
      // Clear air (< 10 dBZ) radiates warm ground temperature (~ +18°C)
      let temp = 18 - (dbz / 65) * 94; // Scale from +18°C down to -76°C
      temp += (Math.cos(r * 1.5 + c * 1.2) * 1.8); // Atmospheric turbulence
      const rounded = Math.min(22, Math.max(-80, Math.round(temp * 10) / 10));
      row.push(rounded);
    }
    grid.push(row);
  }

  const flattened = grid.flat();
  return {
    frameIndex,
    timestamp: radarFrame.timestamp,
    leadTimeMinutes: frameIndex * 15,
    minCttCelsius: Math.min(...flattened),
    overshootingTopsDetected: Math.min(...flattened) < -65,
    tropopausePenetrationKm: Math.min(...flattened) < -72 ? 16.4 : 14.2,
    gridSize,
    grid,
  };
}

/**
 * Generates real-time Lightning Strike Density & active discharge metrics
 * Sudden surge in lightning flash rate (lightning jump) reliably predicts severe hail & cloudburst onset
 */
export function generateLightningDensityData() {
  const totalStrikesLastHour = 482;
  const intraCloudCount = 371;      // IC flashes indicative of vigorous storm updraft
  const cloudToGroundCount = 111;   // CG flashes impacting surface infrastructure

  // Generate localized cluster of recent strikes
  const recentStrikes = [];
  const baseLat = SECTOR_INFO.centerLat;
  const baseLon = SECTOR_INFO.centerLon;

  for (let i = 0; i < 28; i++) {
    const isNegativeCG = Math.random() > 0.15;
    recentStrikes.push({
      id: `LTG-${Date.now()}-${i}`,
      lat: Number((baseLat + (Math.random() - 0.45) * 0.18).toFixed(4)),
      lon: Number((baseLon + (Math.random() - 0.4) * 0.18).toFixed(4)),
      type: Math.random() > 0.3 ? 'IC' : 'CG',
      polarity: isNegativeCG ? '-CG' : '+CG',
      peakCurrentKa: Math.round(18 + Math.random() * 85),
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 900000)).toISOString(),
      elevationKm: Number((4.5 + Math.random() * 8.5).toFixed(1)),
    });
  }

  return {
    densityStrikesKm2Min: 14.8, // Extreme density threshold (>10 is severe)
    lightningJumpDetected: true, // Updraft surge indicator
    totalStrikesLastHour,
    intraCloudCount,
    cloudToGroundCount,
    icCgRatio: Number((intraCloudCount / Math.max(1, cloudToGroundCount)).toFixed(2)),
    rateChangePercentLast15m: +42.5, // Rapid escalation
    highestPeakCurrentKa: 104,
    statusTier: 'SEVERE',
    recentStrikes,
  };
}

/**
 * Generates Numerical Weather Prediction (NWP) atmospheric instability parameters
 * Derived from high-resolution WRF/IMD model sounding assimilation
 */
export function generateNwpInstabilityParameters() {
  return {
    timestamp: new Date().toISOString(),
    sector: SECTOR_INFO.name,
    // Convective Available Potential Energy (0-4000 J/kg)
    cape: {
      value: 2940,
      unit: 'J/kg',
      tier: 'SEVERE',
      normMin: 0,
      normMax: 4000,
      assessment: 'Extreme thermodynamic instability. Energetic potential for explosive vertical updrafts.',
    },
    // Convective Inhibition (CIN: -10 to -250 J/kg)
    cin: {
      value: -24,
      unit: 'J/kg',
      tier: 'WARNING',
      normMin: -250,
      normMax: 0,
      assessment: 'Weak capping inversion. Pre-existing cap breached by orographic foothill lifting.',
    },
    // Deep-Layer Bulk Wind Shear (0-6 km)
    deepLayerWindShear: {
      value: 26.8,
      unit: 'm/s',
      knots: 52,
      tier: 'SEVERE',
      normMin: 0,
      normMax: 40,
      assessment: 'Strong vertical shear organizing cells into long-lived multicell clusters / supercell.',
    },
    // Low-Level Wind Shear (0-1 km)
    lowLevelWindShear: {
      value: 12.4,
      unit: 'm/s',
      tier: 'WARNING',
      assessment: 'High boundary-layer shear driving intense downdraft gust fronts and squall lines.',
    },
    // Precipitable Water (PWAT)
    precipitableWater: {
      value: 62.4,
      unit: 'mm',
      tier: 'SEVERE',
      normMin: 10,
      normMax: 70,
      assessment: 'Atmospheric moisture column saturated. High cloudburst precipitation efficiency.',
    },
    // Lifted Index (LI)
    liftedIndex: {
      value: -7.2,
      unit: '°C',
      tier: 'SEVERE',
      assessment: 'Extreme convective instability.',
    },
    // Storm Relative Helicity (0-3 km SRH)
    srh03km: {
      value: 275,
      unit: 'm²/s²',
      tier: 'SEVERE',
      assessment: 'Significant rotational potential supporting hail embryogenesis and sustained updrafts.',
    },
    // Equivalent Cloudburst Rain Rate Potential
    potentialMaxRainfallRate: {
      value: 114,
      unit: 'mm/hr',
      threshold: '> 100 mm/hr = Cloudburst definition',
    },
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
  const timeline = generateHazardTimelineForecast();

  return {
    sector: SECTOR_INFO,
    timestamp: new Date().toISOString(),
    currentRadar,
    radarSeries,
    satelliteCtt,
    lightning,
    nwp,
    timeline,
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

