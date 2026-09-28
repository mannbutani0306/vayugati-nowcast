import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import SHAPExplainabilityCard from '../components/SHAPExplainabilityCard';
import DataStatusBadge from '../components/DataStatusBadge';
import { fetchInstabilityIndex, fetchLiveFusionGrid, fetchRealCases, fetchRealSatelliteScene, fetchRealVerificationResults, fetchVerificationResults, normalizeLiveCells } from '../lib/apiClient';
import {
  generateMotionConePolygon,
  haversineDistance,
  calculateBoundingBox,
  calculatePolygonCentroid,
  subscribeToLiveCells,
  fetchActiveConvectiveCells,
  fetchOfficerAlerts,
  subscribeToCapAlerts,
  beginAlertReview,
  approveAlert,
  rejectAlert,
  recordForecasterAction,
  submitDraftAlert,
} from '../lib/spatialQueries';
import { convertGeoJsonToCapPolygon } from '../utils/geoJsonPolygon';
import {
  Radio,
  Zap,
  CloudRain,
  AlertTriangle,
  Bell,
  CheckCircle2,
  TrendingUp,
  Clock,
  Activity,
  Compass,
  ShieldAlert,
  Layers,
  BrainCircuit,
  Download,
  Eye,
  EyeOff,
  Filter,
  Maximize2,
  Minimize2,
  PenTool,
  RotateCcw,
  Check,
  X,
  FileText,
  Sliders,
  Sparkles,
  MapPin,
  RefreshCw,
  Send,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';

const RPC_SCHEMA_ERROR = 'Database setup required: in Supabase SQL Editor, apply missing migrations 20260926_schema.sql through 20260929_restore_citizen_alert_rpc.sql in order, then redeploy Vercel.';

function getOperationalDataError(error, fallback) {
  if (error?.code === 'PGRST202') return RPC_SCHEMA_ERROR;
  return error?.message || fallback;
}

// Radar Station Profiles across vulnerable Indian orographic & coastal zones
const RADAR_STATIONS = [
  {
    id: 'DWR-DDN',
    name: 'DWR Dehradun (Shivalik/Garhwal)',
    station: 'C-Band Polarimetric Radar',
    lat: 30.3165,
    lon: 78.0322,
    elevationM: 680,
    rangeKm: 250,
  },
  {
    id: 'DWR-MUM',
    name: 'DWR Mumbai (Western Ghats)',
    station: 'S-Band Doppler Radar (Colaba)',
    lat: 18.9067,
    lon: 72.8147,
    elevationM: 35,
    rangeKm: 250,
  },
  {
    id: 'DWR-DEL',
    name: 'DWR Delhi (Palam/NCR)',
    station: 'C-Band Polarimetric Radar',
    lat: 28.5847,
    lon: 77.0878,
    elevationM: 220,
    rangeKm: 250,
  },
  {
    id: 'DWR-KOL',
    name: 'DWR Kolkata (Gangetic Delta)',
    station: 'S-Band Doppler Radar',
    lat: 22.5726,
    lon: 88.3639,
    elevationM: 12,
    rangeKm: 250,
  },
];

// Active Convective Storm Cells Catalog
const INITIAL_CONVECTIVE_CELLS = [
  {
    cellId: 'CELL-A1',
    cellName: 'Sahastradhara Cloudburst Core',
    hazardType: 'CLOUDBURST',
    sector: 'Sahastradhara River Basin & Rajpur Foothills (Uttarakhand)',
    tier: 'SEVERE',
    lat: 30.368,
    lon: 78.085,
    speedKmh: 38,
    headingDeg: 65,
    radarDbz: 64.8,
    echoTopKm: 16.4,
    vilKgM2: 68.5,
    cttCelsius: -76.4,
    lightningRate: 52.4, // strikes/min
    rainRateMmHr: 118,
    windGustKmh: 92,
    etaMinutes: 18,
    etaClock: '18:32 IST',
    confidenceScore: 0.942,
    baseRisk: 0.12,
    predictedRisk: 0.942,
    rawFeatures: {
      cape: { value: 3850, unit: 'J/kg', label: 'Surface-Based CAPE', climatology: 1850, sensor: 'WRF 1-km Rapid Sounding' },
      cloudTopGlaciation: { value: -65.2, unit: '°C', coolingRate: '-18.4 °C / 15min', label: 'Cloud-Top Glaciation (IR)', climatology: -42.0, sensor: 'INSAT-3DR Rapid-Scan IR (10.8 µm)' },
      lightningRate: { value: 52.4, unit: 'strikes/min', threshold: '>40 strikes/min', jumpSigma: '+3.4σ', label: 'Ground Lightning Flash Rate', climatology: 8.0, sensor: 'GLD360 / Ground Lightning Network' },
      dopplerShear: { value: 28.5, unit: 'm/s', layer: '0–6 km Bulk Shear', label: 'Doppler Velocity Shear', climatology: 14.0, sensor: 'DWR C-Band Doppler Radar' },
    },
    shapAttributions: [
      { id: 'cape_spike', name: 'Vertical CAPE Spikes', symbol: 'CAPE_sfc', contributionPercent: 34, shapValue: +0.34, observedValue: '3,850 J/kg', baselineValue: '1,850 J/kg', unit: 'J/kg', sensor: 'WRF 1-km Sounding', category: 'Thermodynamics', physicsRationale: 'Extreme vertical thermodynamic instability (>3,500 J/kg) drives explosive updraft velocity (>38 m/s), breaching boundary layer capping inversion.', color: '#DC2626' },
      { id: 'glaciation_rate', name: 'Rapid Cloud-Top Glaciation', subtitle: '-65°C IR cooling rate', symbol: 'dT_ir/dt', contributionPercent: 28, shapValue: +0.28, observedValue: '-65.2 °C (cooling -18.4 °C/15m)', baselineValue: '-42.0 °C (-4.0 °C/15m)', unit: '°C/15min', sensor: 'INSAT-3DR Rapid-Scan 10.8µm', category: 'Satellite IR Radiometry', physicsRationale: 'Abrupt cloud-top cooling down to -65.2°C signifies violent overshooting dome penetrating tropopause, ensuring high precipitation efficiency aloft.', color: '#EA580C' },
      { id: 'lightning_jump', name: 'Ground Lightning Jump', subtitle: '>40 strikes/min (+3.4σ)', symbol: 'dF/dt (Jump)', contributionPercent: 22, shapValue: +0.22, observedValue: '52.4 strikes/min (3.4σ surge)', baselineValue: '8.0 strikes/min', unit: 'strikes/min', sensor: 'GLD360 Grid', category: 'Electrification', physicsRationale: 'Sustained flash rate exceeding 40 strikes/min directly validates heavy graupel-ice hydrometeor collisions aloft, 15 minutes ahead of cloudburst downdraft onset.', color: '#D97706' },
      { id: 'velocity_shear', name: 'Doppler Velocity Shear', subtitle: '0–6 km Bulk Shear', symbol: 'S_0-6km', contributionPercent: 16, shapValue: +0.16, observedValue: '28.5 m/s azimuthal shear', baselineValue: '14.0 m/s', unit: 'm/s', sensor: 'Doppler Weather Radar', category: 'Kinematics', physicsRationale: 'Deep-layer vertical wind shear (28.5 m/s) tilts convective updraft away from downdrafts, preventing premature precipitation loading.', color: '#2563EB' },
    ],
  },
  {
    cellId: 'CELL-B2',
    cellName: 'Haridwar Ridge Multicell Cluster',
    hazardType: 'HAIL & GUST FRONT',
    sector: 'Haridwar Bypass & Roorkee Fringe',
    tier: 'WARNING',
    lat: 29.985,
    lon: 78.125,
    speedKmh: 44,
    headingDeg: 55,
    radarDbz: 53.6,
    echoTopKm: 14.1,
    vilKgM2: 48.0,
    cttCelsius: -62.0,
    lightningRate: 28.5,
    rainRateMmHr: 58,
    windGustKmh: 76,
    etaMinutes: 32,
    etaClock: '18:46 IST',
    confidenceScore: 0.845,
    baseRisk: 0.12,
    predictedRisk: 0.845,
    rawFeatures: {
      cape: { value: 2450, unit: 'J/kg', label: 'Surface-Based CAPE', climatology: 1850, sensor: 'WRF 1-km Rapid Sounding' },
      cloudTopGlaciation: { value: -58.0, unit: '°C', coolingRate: '-11.2 °C / 15min', label: 'Cloud-Top Glaciation (IR)', climatology: -42.0, sensor: 'INSAT-3DR Rapid-Scan IR' },
      lightningRate: { value: 28.5, unit: 'strikes/min', threshold: '>20 strikes/min', jumpSigma: '+2.1σ', label: 'Ground Lightning Flash Rate', climatology: 8.0, sensor: 'GLD360 Ground Network' },
      dopplerShear: { value: 21.0, unit: 'm/s', layer: '0–6 km Bulk Shear', label: 'Doppler Velocity Shear', climatology: 14.0, sensor: 'DWR C-Band Doppler Radar' },
    },
    shapAttributions: [
      { id: 'glaciation_rate', name: 'Rapid Cloud-Top Glaciation', contributionPercent: 32, shapValue: +0.27, observedValue: '-58.0 °C', baselineValue: '-42.0 °C', color: '#EA580C', sensor: 'INSAT-3DR IR', physicsRationale: 'Overshooting top indicates cold graupel-rich anvil fostering hail growth.' },
      { id: 'cape_spike', name: 'Vertical CAPE Spikes', contributionPercent: 28, shapValue: +0.24, observedValue: '2,450 J/kg', baselineValue: '1,850 J/kg', color: '#DC2626', sensor: 'WRF Sounding', physicsRationale: 'Moderate-high instability sustaining multi-cell propagation.' },
      { id: 'velocity_shear', name: 'Doppler Velocity Shear', contributionPercent: 24, shapValue: +0.20, observedValue: '21.0 m/s', baselineValue: '14.0 m/s', color: '#2563EB', sensor: 'DWR Radar', physicsRationale: 'Unidirectional shear driving organized linear squall front.' },
      { id: 'lightning_jump', name: 'Ground Lightning Jump', contributionPercent: 16, shapValue: +0.13, observedValue: '28.5 strikes/min', baselineValue: '8.0 strikes/min', color: '#D97706', sensor: 'GLD360 Grid', physicsRationale: 'Moderate lightning surge marking active mixed-phase charging.' },
    ],
  },
  {
    cellId: 'CELL-C3',
    cellName: 'Mohand Pass Orographic Feeder',
    hazardType: 'SEVERE THUNDERSTORM',
    sector: 'Shivalik Tunnel Approach & Clement Town South',
    tier: 'WATCH',
    lat: 30.180,
    lon: 77.920,
    speedKmh: 32,
    headingDeg: 72,
    radarDbz: 42.4,
    echoTopKm: 11.8,
    vilKgM2: 29.5,
    cttCelsius: -48.5,
    lightningRate: 14.0,
    rainRateMmHr: 34,
    windGustKmh: 54,
    etaMinutes: 48,
    etaClock: '19:02 IST',
    confidenceScore: 0.718,
    baseRisk: 0.12,
    predictedRisk: 0.718,
    rawFeatures: {
      cape: { value: 1850, unit: 'J/kg', label: 'Surface-Based CAPE', climatology: 1850, sensor: 'WRF 1-km Rapid Sounding' },
      cloudTopGlaciation: { value: -48.5, unit: '°C', coolingRate: '-6.4 °C / 15min', label: 'Cloud-Top Glaciation (IR)', climatology: -42.0, sensor: 'INSAT-3DR IR' },
      lightningRate: { value: 14.0, unit: 'strikes/min', threshold: '>10 strikes/min', jumpSigma: '+1.4σ', label: 'Ground Lightning Flash Rate', climatology: 8.0, sensor: 'GLD360' },
      dopplerShear: { value: 16.5, unit: 'm/s', layer: '0–6 km Bulk Shear', label: 'Doppler Velocity Shear', climatology: 14.0, sensor: 'DWR Radar' },
    },
    shapAttributions: [
      { id: 'cape_spike', name: 'Vertical CAPE Spikes', contributionPercent: 35, shapValue: +0.22, observedValue: '1,850 J/kg', baselineValue: '1,850 J/kg', color: '#DC2626', sensor: 'WRF Sounding', physicsRationale: 'Foothill moisture convergence lifting parcels above condensation level.' },
      { id: 'lightning_jump', name: 'Ground Lightning Jump', contributionPercent: 26, shapValue: +0.16, observedValue: '14.0 strikes/min', baselineValue: '8.0 strikes/min', color: '#D97706', sensor: 'GLD360', physicsRationale: 'Localized electrification along ridge.' },
      { id: 'glaciation_rate', name: 'Rapid Cloud-Top Glaciation', contributionPercent: 22, shapValue: +0.14, observedValue: '-48.5 °C', baselineValue: '-42.0 °C', color: '#EA580C', sensor: 'INSAT-3DR', physicsRationale: 'Progressive cloud top deepening.' },
      { id: 'velocity_shear', name: 'Doppler Velocity Shear', contributionPercent: 17, shapValue: +0.10, observedValue: '16.5 m/s', baselineValue: '14.0 m/s', color: '#2563EB', sensor: 'DWR Radar', physicsRationale: 'Moderate boundary layer shear.' },
    ],
  },
  {
    cellId: 'CELL-D4',
    cellName: 'Doon Valley South Thermal Cell',
    hazardType: 'ISOLATED SHOWER',
    sector: 'ISBT Dehradun Inter-State Hub & Majra',
    tier: 'INFO',
    lat: 30.260,
    lon: 78.010,
    speedKmh: 22,
    headingDeg: 45,
    radarDbz: 29.5,
    echoTopKm: 8.2,
    vilKgM2: 12.0,
    cttCelsius: -28.0,
    lightningRate: 2.1,
    rainRateMmHr: 12,
    windGustKmh: 35,
    etaMinutes: 65,
    etaClock: '19:19 IST',
    confidenceScore: 0.442,
    baseRisk: 0.12,
    predictedRisk: 0.442,
    rawFeatures: {
      cape: { value: 1200, unit: 'J/kg', label: 'Surface-Based CAPE', climatology: 1850, sensor: 'WRF 1-km Rapid Sounding' },
      cloudTopGlaciation: { value: -28.0, unit: '°C', coolingRate: '-2.0 °C / 15min', label: 'Cloud-Top Glaciation (IR)', climatology: -42.0, sensor: 'INSAT-3DR' },
      lightningRate: { value: 2.1, unit: 'strikes/min', threshold: '<5 strikes/min', jumpSigma: '+0.2σ', label: 'Ground Lightning Flash Rate', climatology: 8.0, sensor: 'GLD360' },
      dopplerShear: { value: 9.5, unit: 'm/s', layer: '0–6 km Bulk Shear', label: 'Doppler Velocity Shear', climatology: 14.0, sensor: 'DWR Radar' },
    },
    shapAttributions: [
      { id: 'cape_spike', name: 'Vertical CAPE Spikes', contributionPercent: 38, shapValue: +0.12, observedValue: '1,200 J/kg', baselineValue: '1,850 J/kg', color: '#DC2626', sensor: 'WRF Sounding', physicsRationale: 'Weak daytime heating plume.' },
      { id: 'glaciation_rate', name: 'Rapid Cloud-Top Glaciation', contributionPercent: 25, shapValue: +0.08, observedValue: '-28.0 °C', baselineValue: '-42.0 °C', color: '#EA580C', sensor: 'INSAT-3DR', physicsRationale: 'Shallow cumulus congestus layer.' },
      { id: 'velocity_shear', name: 'Doppler Velocity Shear', contributionPercent: 20, shapValue: +0.06, observedValue: '9.5 m/s', baselineValue: '14.0 m/s', color: '#2563EB', sensor: 'DWR Radar', physicsRationale: 'Sub-threshold shear.' },
      { id: 'lightning_jump', name: 'Ground Lightning Jump', contributionPercent: 17, shapValue: +0.05, observedValue: '2.1 strikes/min', baselineValue: '8.0 strikes/min', color: '#D97706', sensor: 'GLD360', physicsRationale: 'Insignificant electrification.' },
    ],
  },
];

// Initial DRAFT alerts for the Review Queue
const INITIAL_DRAFT_ALERTS = [
  {
    id: 'DRAFT-IMD-001',
    cellId: 'CELL-A1',
    cellName: 'Sahastradhara Cloudburst Core',
    hazardType: 'CLOUDBURST',
    tier: 'SEVERE',
    location: 'Sahastradhara River Basin & Rajpur Foothills',
    targetGrid: '1.5 km Mesh • Sahastradhara / Rajpur Corridor',
    affectedDistricts: ['Sahastradhara Basin', 'Rajpur Road', 'Mussoorie Bypass', 'Rispana Catchment'],
    riskScore: 0.942,
    etaClock: '18:32 IST',
    etaMinutes: 18,
    maxDbz: 64.8,
    rainRateMmHr: 118,
    windGustKmh: 92,
    status: 'DRAFT',
    createdTimestamp: '18:14:10 IST',
    polygon: '30.3450,78.0620 30.3950,78.1150 30.3620,78.1680 30.3180,78.1050 30.3450,78.0620',
    headline_en: 'IMMINENT CLOUDBURST & FLASH FLOOD ALERT: Sahastradhara & Rajpur Foothills',
    headline_hi: 'आसन्न बादल फटने एवं फ्लैश फ्लड चेतावनी: सहस्त्रधारा व राजपुर तलहटी क्षेत्र',
    description: 'Doppler C-Band Zdr signature and +3.4σ lightning flash jump detect severe precipitation core. Rain rates exceeding 110 mm/hr will trigger immediate flash flooding in Rispana/Bindal stream beds within 18–30 minutes.',
    instruction: 'Move immediately to solid reinforced structures away from river beds and hill drainage culverts. Halt vehicular movement on Rajpur-Mussoorie bypass.',
  },
  {
    id: 'DRAFT-IMD-002',
    cellId: 'CELL-B2',
    cellName: 'Haridwar Ridge Multicell Cluster',
    hazardType: 'HAIL & DOWNBURST',
    tier: 'WARNING',
    location: 'Haridwar Bypass & Roorkee Fringe',
    targetGrid: '2.0 km Mesh • Shivalik Southern Escarpment',
    affectedDistricts: ['Haridwar Ghats', 'Roorkee Canal Fringe', 'Chidderwala Plains'],
    riskScore: 0.845,
    etaClock: '18:46 IST',
    etaMinutes: 32,
    maxDbz: 53.6,
    rainRateMmHr: 58,
    windGustKmh: 76,
    status: 'DRAFT',
    createdTimestamp: '18:18:22 IST',
    polygon: '29.9500,78.0800 30.0300,78.1500 29.9900,78.2200 29.9200,78.1400 29.9500,78.0800',
    headline_en: 'SEVERE HAIL & DOWNBURST WARNING: Haridwar & Roorkee Sub-Divisions',
    headline_hi: 'गंभीर ओलावृष्टि एवं अंधड़ चेतावनी: हरिद्वार एवं रुड़की उप-मंडल',
    description: 'Multicell cluster propagating along Shivalik southern escarpment. TBSS radar artifact indicates 2.5–3.0 cm hail shafts and surface wind gusts reaching 75 km/h.',
    instruction: 'Secure temporary tin sheds and agricultural produce. Pilgrims at Haridwar ghats should seek shelter in concrete pavilions.',
  },
  {
    id: 'DRAFT-IMD-003',
    cellId: 'CELL-C3',
    cellName: 'Mohand Pass Orographic Feeder',
    hazardType: 'THUNDERSTORM',
    tier: 'WATCH',
    location: 'Shivalik Tunnel Approach & Clement Town',
    targetGrid: '3.0 km Mesh • Mohand Pass Foothills',
    affectedDistricts: ['Mohand Pass', 'Shivalik Tunnel', 'Clement Town South'],
    riskScore: 0.718,
    etaClock: '19:02 IST',
    etaMinutes: 48,
    maxDbz: 42.4,
    rainRateMmHr: 34,
    windGustKmh: 54,
    status: 'DRAFT',
    createdTimestamp: '18:21:40 IST',
    polygon: '30.1500,77.8800 30.2200,77.9400 30.1900,78.0100 30.1300,77.9500 30.1500,77.8800',
    headline_en: 'THUNDERSTORM & GUST WATCH: Mohand Pass Highway Corridor',
    headline_hi: 'गर्जन के साथ भारी वर्षा निगरानी: मोहंड दर्रा राष्ट्रीय राजमार्ग',
    description: 'Moderate convective organization triggered by orographic ascent. Frequent cloud-to-ground lightning flashes and slippery hill road conditions expected.',
    instruction: 'Exercise caution while driving through hill tunnels and curves. Avoid parking vehicles underneath solitary tall trees.',
  },
];

// Tier color helpers
const TIER_COLORS = {
  SEVERE: {
    bg: '#DC2626',
    border: '#B91C1C',
    light: 'bg-red-50 text-red-700 border-red-200',
    fill: '#DC2626',
    badge: 'bg-red-600 text-white',
  },
  WARNING: {
    bg: '#EA580C',
    border: '#C2410C',
    light: 'bg-orange-50 text-orange-700 border-orange-200',
    fill: '#EA580C',
    badge: 'bg-orange-600 text-white',
  },
  WATCH: {
    bg: '#D97706',
    border: '#B45309',
    light: 'bg-amber-50 text-amber-700 border-amber-200',
    fill: '#D97706',
    badge: 'bg-amber-600 text-white',
  },
  INFO: {
    bg: '#2E7D32',
    border: '#1B5E20',
    light: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    fill: '#2E7D32',
    badge: 'bg-emerald-600 text-white',
  },
};

const TRACK_LEAD_OPTIONS_MIN = [15, 30, 45, 60, 120, 180, 240, 300, 360];

function formatSkillEstimate(value) {
  if (typeof value === 'number') return value.toFixed(3);
  if (!value || typeof value.mean !== 'number') return 'Unavailable';
  return `${value.mean.toFixed(3)} +/- ${(value.std || 0).toFixed(3)}`;
}

function documentedUtcMillis(value) {
  const match = value?.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?/);
  const time = match?.[3] || match?.[2];
  return match ? Date.parse(`${match[1]}T${time}:00Z`) : null;
}

export default function OfficerDashboard() {
  const { profile, session, isConfigured } = useAuth();
  const { translate } = useAccessibility();
  const dutyOfficer = profile?.full_name || 'Duty Met Officer Dr. Rajesh Swaminathan';
  const officerBadge = profile?.badge_id || 'IMD-NOWCAST-DEL-04';

  const mapLiveCellToDashboard = useCallback((backendCell) => ({
    ...backendCell,
    cellId: backendCell.cellId || backendCell.cell_uid,
    cellName: backendCell.cellName || 'Active Convective Cell',
    hazardType: backendCell.hazardType || 'CONVECTIVE CELL',
    sector: backendCell.sector || 'Operational Sector',
    tier: backendCell.tier || 'INFO',
    lat: backendCell.lat ?? 0,
    lon: backendCell.lon ?? 0,
    speedKmh: backendCell.speedKmh ?? null,
    headingDeg: backendCell.headingDeg ?? null,
    radarDbz: backendCell.radarDbz ?? null,
    echoTopKm: backendCell.echoTopKm ?? null,
    vilKgM2: backendCell.vilKgM2 ?? null,
    cttCelsius: backendCell.cttCelsius ?? null,
    lightningRate: backendCell.lightningRate ?? null,
    rainRateMmHr: backendCell.rainRateMmHr ?? null,
    windGustKmh: backendCell.windGustKmh ?? null,
    etaMinutes: backendCell.etaMinutes ?? null,
    etaClock: backendCell.etaClock || 'Not provided',
    confidenceScore: backendCell.confidenceScore ?? null,
    baseRisk: backendCell.baseRisk ?? null,
    predictedRisk: backendCell.predictedRisk ?? null,
    rawFeatures: backendCell.rawFeatures || {
      cape: { value: backendCell.cape ?? null, unit: 'J/kg', label: 'Surface-Based CAPE', climatology: 1850, sensor: 'Open-Meteo NWP pending point sounding' },
      cloudTopGlaciation: { value: backendCell.cttCelsius ?? null, unit: '°C', coolingRate: null, label: 'Cloud-Top Glaciation (IR)', sensor: 'Supabase cell observation' },
      lightningRate: { value: backendCell.lightningRate ?? null, unit: 'strikes/min', label: 'Ground Lightning Flash Rate', sensor: 'Supabase cell observation' },
      dopplerShear: { value: null, unit: 'm/s', layer: '0–6 km Bulk Shear', label: '0–6 km Wind Shear', climatology: 14.0, sensor: 'Open-Meteo NWP pending point sounding' },
    },
    shapAttributions: backendCell.shapAttributions || [],
    description: backendCell.description || `${backendCell.cellName || 'Convective cell'} remains active with ongoing risk surface development.`,
    growthTrend: backendCell.growthTrend || 'Live backend feed',
    lastUpdated: backendCell.lastUpdated || 'just now',
    impactTargets: backendCell.impactTargets || [],
  }), []);

  const [isScenarioMode, setIsScenarioMode] = useState(false);

  // Selected Radar Station
  const [selectedStation, setSelectedStation] = useState(RADAR_STATIONS[0]);

  // Real-Time Status Bar State
  const [socketStatus, setSocketStatus] = useState('CONNECTING');
  const [lastSweepTime, setLastSweepTime] = useState('Awaiting database observation');
  const [serverLatencyMs, setServerLatencyMs] = useState(null);
  const [sweepSweepCount, setSweepSweepCount] = useState(0);

  // Storm Cells & Queue State
  const [cells, setCells] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const loadSeq = useRef(0);
  const [selectedCellId, setSelectedCellId] = useState(null);
  const [trackLeadMinutes, setTrackLeadMinutes] = useState(45);
  const [queueFilter, setQueueFilter] = useState('ALL'); // 'ALL' | 'DRAFT' | 'SEVERE' | 'WARNING' | 'APPROVED'
  const [liveCellsLoading, setLiveCellsLoading] = useState(true);
  const [liveCellsError, setLiveCellsError] = useState('');
  const [databaseError, setDatabaseError] = useState('');
  const [nwpModel, setNwpModel] = useState('ncep_gfs_seamless');
  const [nwpByCell, setNwpByCell] = useState({});
  const [nwpStatus, setNwpStatus] = useState({ mode: 'LOADING', metadata: null });
  const [nwpError, setNwpError] = useState('');
  const [verificationData, setVerificationData] = useState(null);
  const [verificationError, setVerificationError] = useState('');
  const [realVerificationData, setRealVerificationData] = useState(null);
  const [realVerificationError, setRealVerificationError] = useState('');
  const [verificationView, setVerificationView] = useState('synthetic');
  const [realCaseData, setRealCaseData] = useState(null);
  const [realCaseError, setRealCaseError] = useState('');
  const [realSatelliteScene, setRealSatelliteScene] = useState(null);

  // GIS Layer Visibility Switches
  const [layerVisibility, setLayerVisibility] = useState({
    radarDbz: true,
    insatCloudTop: true,
    realInsatScene: false,
    lightningHeatmap: true,
    opticalFlowCones: true,
    warningPolygons: true,
  });

  // Layer Opacities
  const [layerOpacity, setLayerOpacity] = useState({
    radarDbz: 0.85,
    insatCloudTop: 0.70,
  });

  // GIS Polygon Drawing Tool State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState([]); // Array of [lat, lon]
  const [completedDrawnPolygon, setCompletedDrawnPolygon] = useState(null); // Array of [lat, lon]
  const [showPolygonAlertModal, setShowPolygonAlertModal] = useState(false);
  const [polygonAlertHeadline, setPolygonAlertHeadline] = useState('');
  const [polygonAlertTier, setPolygonAlertTier] = useState('SEVERE');
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');

  // XAI Modal State
  const [isXaiModalOpen, setIsXaiModalOpen] = useState(false);
  const [xaiTargetCell, setXaiTargetCell] = useState(null);

  // Alert Rejection Modal State
  const [rejectingAlert, setRejectingAlert] = useState(null);
  const [rejectionRationale, setRejectionRationale] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [pendingAlertActionId, setPendingAlertActionId] = useState(null);

  // Emergency Siren Broadcast Banner
  const [broadcastBanner, setBroadcastBanner] = useState(null);

  // XML Export Notification

  // Map Reference & Leaflet instances
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef({
    radarLayer: null,
    cloudTopLayer: null,
    lightningLayer: null,
    conesLayer: null,
    polygonsLayer: null,
    drawingLayer: null,
  });

  // Active selected cell
  const currentCell = useMemo(() => {
    const selected = cells.find((cell) => cell.cellId === selectedCellId);
    if (!selected) return null;

    const nwp = nwpByCell[selected.cellId];
    if (!nwp) return selected;

    return {
      ...selected,
      nwpData: nwp,
      rawFeatures: {
        ...selected.rawFeatures,
        cape: { ...selected.rawFeatures?.cape, value: nwp.current_cape, unit: 'J/kg', sensor: 'Open-Meteo NWP' },
        cin: { value: nwp.cin_estimate, unit: 'J/kg', label: 'Convective Inhibition', sensor: 'Open-Meteo NWP' },
        liftedIndex: { value: nwp.lifted_index, unit: '°C', label: 'Lifted Index', sensor: 'Open-Meteo NWP' },
        pwat: { value: nwp.pwat_mm, unit: 'mm', label: 'Precipitable Water', sensor: 'Open-Meteo NWP' },
        dopplerShear: { ...selected.rawFeatures?.dopplerShear, value: nwp.wind_shear_ms, unit: 'm/s', label: '0–6 km Wind Shear', sensor: 'Open-Meteo NWP' },
      },
    };
  }, [cells, selectedCellId, nwpByCell]);

  const selectedNwp = currentCell ? nwpByCell[currentCell.cellId] : null;
  const skillLeadRows = verificationData?.aggregate_by_lead || [];
  const skillChartPoints = (key) => skillLeadRows.map((row, index) => {
    const score = row[key]?.mean ?? 0;
    return `${40 + index * 104},${105 - score * 80}`;
  }).join(' ');
  const leh2010Case = realCaseData?.cases?.find((item) => item.event?.date_utc === '2010-08-05');
  const leh2011Case = realCaseData?.cases?.find((item) => item.event?.date_utc === '2011-07-25');
  const lehChronology = leh2010Case?.chronology || [];
  const impactEntry = lehChronology.find((item) => item.event.toLowerCase().includes('landslide'));
  const impactMillis = documentedUtcMillis(impactEntry?.time_utc);
  const anchorTimeline = [
    { label: 'Initiation', entry: lehChronology.find((item) => item.event.toLowerCase().includes('convection began')) },
    { label: 'Arrival', entry: lehChronology.find((item) => item.event.toLowerCase().includes('reached ladakh')) },
    { label: 'Peak rain', entry: lehChronology.find((item) => item.event.toLowerCase().includes('rainfall estimates south of leh were highest')) },
    { label: 'Landslide', entry: impactEntry },
  ].filter((item) => item.entry);

  // Counts for Badges
  const draftCount = alerts.filter((a) => a.status === 'DRAFT').length;
  const severeCount = alerts.filter((a) => a.tier === 'SEVERE' && a.status !== 'REJECTED').length;
  const approvedCount = alerts.filter((a) => a.status === 'APPROVED').length;

  useEffect(() => {
    let mounted = true;
    fetchVerificationResults()
      .then((payload) => { if (mounted) setVerificationData(payload); })
      .catch((error) => { if (mounted) setVerificationError(error.message || 'Verification results unavailable.'); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchRealCases()
      .then((payload) => { if (mounted) setRealCaseData(payload); })
      .catch((error) => { if (mounted) setRealCaseError(error.message || 'Documented case data unavailable.'); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchRealVerificationResults()
      .then((payload) => { if (mounted) setRealVerificationData(payload); })
      .catch((error) => { if (mounted) setRealVerificationError(error.message || 'Real archive verification unavailable.'); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchRealSatelliteScene()
      .then((payload) => { if (mounted) setRealSatelliteScene(payload); })
      .catch(() => { if (mounted) setRealSatelliteScene({ status: 'AWAITING REAL DATA', message: 'Local INSAT scene metadata unavailable.' }); });
    return () => { mounted = false; };
  }, []);

  // -------------------------------------------------------------
  // Load the operational source-of-truth rows from Supabase.
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const loadOperationalData = async () => {
      const alertRequest = ++loadSeq.current;
      setLiveCellsLoading(true);
      setLiveCellsError('');
      const [cellResult, alertResult] = await Promise.allSettled([fetchActiveConvectiveCells(), fetchOfficerAlerts()]);
      if (!isMounted) return;

      let databaseCellsLoaded = false;
      if (cellResult.status === 'fulfilled') {
        const databaseCells = cellResult.value.map(mapLiveCellToDashboard);
        if (databaseCells.length > 0) {
          databaseCellsLoaded = true;
          setCells(databaseCells);
          setIsScenarioMode(false);
          setSelectedCellId((previous) => databaseCells.some((cell) => cell.cellId === previous) ? previous : databaseCells[0]?.cellId || null);
          setLiveCellsError('');
        }
      }

      if (!databaseCellsLoaded) {
        try {
          const scenarioGrid = await fetchLiveFusionGrid();
          const scenarioCells = normalizeLiveCells(scenarioGrid).map(mapLiveCellToDashboard);
          if (scenarioCells.length > 0) {
            setCells(scenarioCells);
            setIsScenarioMode(scenarioGrid.data_mode === 'DEMO_FIXTURE');
            setSelectedCellId((previous) => scenarioCells.some((cell) => cell.cellId === previous) ? previous : scenarioCells[0]?.cellId || null);
            setLiveCellsError('');
          } else {
            setCells([]);
            setIsScenarioMode(false);
            setLiveCellsError(cellResult.status === 'rejected'
              ? getOperationalDataError(cellResult.reason, 'No active cells are available from Supabase or the scenario service.')
              : 'No active cells are available from Supabase or the scenario service.');
          }
        } catch (error) {
          setCells([]);
          setIsScenarioMode(false);
          setLiveCellsError(cellResult.status === 'rejected'
            ? getOperationalDataError(cellResult.reason, error.message || 'No active cells are available from Supabase or the scenario service.')
            : error.message || 'No active cells are available from Supabase or the scenario service.');
        }
      }

      if (alertResult.status === 'fulfilled' && alertRequest === loadSeq.current) {
        setAlerts(alertResult.value);
        setDatabaseError('');
      } else if (alertResult.status === 'rejected' && alertRequest === loadSeq.current) {
        setAlerts([]);
        setDatabaseError(getOperationalDataError(alertResult.reason, 'Unable to load alerts from Supabase.'));
      }
      setLiveCellsLoading(false);
    };

    loadOperationalData();

    return () => {
      isMounted = false;
    };
  }, [mapLiveCellToDashboard]);

  useEffect(() => {
    let mounted = true;
    let subscription;
    try {
      subscription = subscribeToCapAlerts(({ alert }) => {
        if (!alert?.id) return;
        const alertRequest = ++loadSeq.current;
        fetchOfficerAlerts()
          .then((rows) => { if (mounted && alertRequest === loadSeq.current) setAlerts(rows); })
          .catch((error) => {
            if (mounted && alertRequest === loadSeq.current) setDatabaseError(getOperationalDataError(error, 'Unable to refresh CAP alerts.'));
          });
      });
    } catch (error) {
      setDatabaseError(error.message || 'CAP alert realtime is unavailable.');
    }
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentCell) {
      setNwpStatus({ mode: 'OFFLINE', metadata: null });
      return undefined;
    }

    const controller = new AbortController();
    setNwpStatus({ mode: 'LOADING', metadata: null });
    setNwpError('');

    fetchInstabilityIndex({ lat: currentCell.lat, lon: currentCell.lon, model: nwpModel, signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const responseMode = payload.metadata?.mode || 'LIVE';
        setNwpByCell((previous) => ({ ...previous, [currentCell.cellId]: payload }));
        setNwpStatus({ mode: responseMode, metadata: payload.metadata });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error('Open-Meteo instability feed request failed:', error);
        setNwpError(error.message || 'Open-Meteo NWP is currently unreachable.');
        setNwpStatus({ mode: 'OFFLINE', metadata: error.metadata || null });
      });

    return () => controller.abort();
  }, [currentCell?.cellId, currentCell?.lat, currentCell?.lon, nwpModel]);

  useEffect(() => {
    let subHandle = null;
    try {
      subHandle = subscribeToLiveCells((event) => {
        if (event.cell) {
          fetchActiveConvectiveCells()
            .then((rows) => {
              const databaseCells = rows.map(mapLiveCellToDashboard);
              if (databaseCells.length > 0) {
                setCells(databaseCells);
                setIsScenarioMode(false);
              }
            })
            .catch((error) => setLiveCellsError(getOperationalDataError(error, 'Unable to refresh convective cells.')));
          setLastSweepTime(event.cell.updated_at || 'Database update received');
          setSweepSweepCount((count) => count + 1);
        }
      }, (status) => {
        setSocketStatus(status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setLiveCellsError(`Supabase Realtime connection ${status.toLowerCase()}.`);
        }
      });
    } catch (error) {
      setSocketStatus('OFFLINE');
      setLiveCellsError(error.message || 'Supabase Realtime is unavailable.');
    }

    return () => {
      if (subHandle && subHandle.unsubscribe) subHandle.unsubscribe();
    };
  }, [mapLiveCellToDashboard]);

  // -------------------------------------------------------------
  // LEAFLET MAP INITIALIZATION & CANVAS RENDERING
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent multiple initializations

    const initialCenter = [selectedStation.lat, selectedStation.lon];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 10,
      minZoom: 6,
      maxZoom: 15,
      zoomControl: false,
    });

    // Add custom styled zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Public OpenStreetMap tiles do not require an application API key.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Initialize Leaflet FeatureGroups for all 5 layers + drawing layer
    layersGroupRef.current.radarLayer = L.featureGroup().addTo(map);
    layersGroupRef.current.cloudTopLayer = L.featureGroup().addTo(map);
    layersGroupRef.current.lightningLayer = L.featureGroup().addTo(map);
    layersGroupRef.current.conesLayer = L.featureGroup().addTo(map);
    layersGroupRef.current.polygonsLayer = L.featureGroup().addTo(map);
    layersGroupRef.current.drawingLayer = L.featureGroup().addTo(map);

    // Map click handler for GeoJSON polygon drawing tool
    map.on('click', (e) => {
      // In drawing mode, capture vertex coordinates
      setDrawnPoints((prev) => {
        if (!window.__VAYUGATI_DRAWING_MODE__) return prev;
        const newPt = [Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5))];
        return [...prev, newPt];
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map center when station changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([selectedStation.lat, selectedStation.lon], 10, {
      duration: 1.2,
    });
  }, [selectedStation]);

  // Keep drawing mode sync in global ref for Leaflet event listener
  useEffect(() => {
    window.__VAYUGATI_DRAWING_MODE__ = isDrawingMode;
  }, [isDrawingMode]);

  // -------------------------------------------------------------
  // RENDER GIS LAYERS (RADAR dBZ, CLOUD TOPS, LIGHTNING, CONES, ACTIVE POLYGONS)
  // -------------------------------------------------------------
  const renderGisLayers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const {
      radarLayer,
      cloudTopLayer,
      lightningLayer,
      conesLayer,
      polygonsLayer,
    } = layersGroupRef.current;

    // Clear previous elements
    radarLayer.clearLayers();
    cloudTopLayer.clearLayers();
    lightningLayer.clearLayers();
    conesLayer.clearLayers();
    polygonsLayer.clearLayers();

    // 1. LAYER: Radar Reflectivity (dBZ)
    if (layerVisibility.radarDbz) {
      cells.forEach((cell) => {
        const tierMeta = TIER_COLORS[cell.tier] || TIER_COLORS.INFO;
        if (cell.trackGeometry) {
          const trackPolygon = L.geoJSON(cell.trackGeometry, {
            style: {
              color: tierMeta.border,
              weight: 2,
              fillColor: tierMeta.bg,
              fillOpacity: 0.22 * layerOpacity.radarDbz,
            },
          });
          trackPolygon.bindTooltip(`${cell.cellName} • ${cell.radarDbz} dBZ`);
          trackPolygon.on('click', () => {
            setSelectedCellId(cell.cellId);
          });
          radarLayer.addLayer(trackPolygon);
        }

        const marker = L.circleMarker([cell.lat, cell.lon], {
          radius: cell.initiation?.detected ? 9 : 5,
          color: cell.initiation?.detected ? '#FDE047' : '#FFFFFF',
          weight: 1.5,
          fillColor: cell.initiation?.detected ? '#F97316' : tierMeta.bg,
          fillOpacity: 1,
        }).bindTooltip(`${cell.cellName} • ${cell.radarDbz} dBZ`);
        marker.on('click', () => {
          setSelectedCellId(cell.cellId);
        });
        radarLayer.addLayer(marker);
        if (cell.initiation?.detected) {
          radarLayer.addLayer(L.marker([cell.lat, cell.lon], { icon: L.divIcon({ className: 'initiation-badge', html: '<div class="animate-pulse" style="background:#F97316;color:white;font:bold 10px monospace;padding:2px 5px;border:1px solid #FDE047;border-radius:9999px;box-shadow:0 0 0 3px rgba(249,115,22,.25);">NEW</div>', iconSize: [30, 18], iconAnchor: [15, 26] }) }));
        }
      });
    }

    // 2. LAYER: INSAT Cloud Tops (Infrared Glaciation CTT)
    if (layerVisibility.insatCloudTop) {
      cells.forEach((cell) => {
        const cttLabel = L.divIcon({
          className: 'ctt-label',
          html: `<div style="background: rgba(30, 27, 75, 0.85); color: #C7D2FE; font-size: 10px; font-family: monospace; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid #6366F1; white-space: nowrap;">
            CTT: ${cell.cttCelsius == null ? 'Unavailable' : `${cell.cttCelsius}°C`}
          </div>`,
          iconSize: [85, 20],
          iconAnchor: [42, -10],
        });
        cloudTopLayer.addLayer(L.marker([cell.lat, cell.lon], { icon: cttLabel }));
      });
    }

    if (layerVisibility.realInsatScene && realSatelliteScene?.real_scene_overlay?.image_data_base64) {
      const [south, west, north, east] = realSatelliteScene.real_scene_overlay.bounds_south_west_north_east;
      const sceneOverlay = L.imageOverlay(
        `data:image/png;base64,${realSatelliteScene.real_scene_overlay.image_data_base64}`,
        [[south, west], [north, east]],
        { opacity: 0.62, interactive: true },
      );
      sceneOverlay.bindTooltip(`INSAT-3DR TIR1 raw values; not brightness temperature · ${realSatelliteScene.scene_time_utc}`);
      cloudTopLayer.addLayer(sceneOverlay);
    }

    // 3. LAYER: Lightning Strike Heatmap (GLD360 / Ground Network)
    if (layerVisibility.lightningHeatmap) {
      cells.forEach((cell) => {
        if (cell.lightningRate != null) {
          const lightningBadge = L.divIcon({
            className: 'lightning-badge',
            html: `<div style="background: #D97706; color: #FFFFFF; font-size: 9px; font-family: monospace; font-weight: bold; padding: 1px 5px; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 3px;">
              ⚡ ${cell.lightningRate} fl/min
            </div>`,
            iconSize: [80, 18],
            iconAnchor: [40, 24],
          });
          lightningLayer.addLayer(L.marker([cell.lat, cell.lon], { icon: lightningBadge }));
        }
      });
    }

    // 4. LAYER: Optical Flow Track Cones (Generated via spatialQueries.js)
    if (layerVisibility.opticalFlowCones) {
      cells.forEach((cell) => {
        // Generate the selected kinematic track cone using spatialQueries.js.
        const coneCoordinates = generateMotionConePolygon(
          cell.lat,
          cell.lon,
          cell.speedKmh,
          cell.headingDeg,
          trackLeadMinutes,
          22  // 22° atmospheric divergence spread angle
        );

        const conePolygon = L.polygon(coneCoordinates, {
          color: cell.tier === 'SEVERE' ? '#DC2626' : '#EA580C',
          weight: 1.5,
          dashArray: '5,5',
          fillColor: cell.tier === 'SEVERE' ? '#EF4444' : '#F97316',
          fillOpacity: 0.16,
        });
        conePolygon.bindTooltip(`${trackLeadMinutes}-minute track projection · ${cell.cellName}`);

        // Direction Motion Vector Line
        const apexLat = coneCoordinates[3][0];
        const apexLon = coneCoordinates[3][1];
        const vectorLine = L.polyline(
          [
            [cell.lat, cell.lon],
            [apexLat, apexLon],
          ],
          {
            color: '#0F172A',
            weight: 2,
            dashArray: '2,4',
          }
        );

        // Waypoint at the selected lead time.
        const midLat = (cell.lat + apexLat) / 2;
        const midLon = (cell.lon + apexLon) / 2;
        const etaBadge = L.divIcon({
          className: 'eta-badge',
          html: `<div style="background: #0F172A; color: #FFFFFF; font-size: 9px; font-family: monospace; font-weight: bold; padding: 2px 5px; border-radius: 4px; border: 1px solid #475569; white-space: nowrap;">
            +${trackLeadMinutes}m projection (${cell.speedKmh} km/h)
          </div>`,
          iconSize: [95, 18],
          iconAnchor: [47, 9],
        });
        const etaMarker = L.marker([midLat, midLon], { icon: etaBadge });

        conesLayer.addLayer(conePolygon);
        conesLayer.addLayer(vectorLine);
        conesLayer.addLayer(etaMarker);
      });
    }

    // 5. LAYER: Active Warning Polygons
    if (layerVisibility.warningPolygons) {
      alerts.forEach((alert) => {
        if (alert.status === 'REJECTED') return;
        if (!alert.polygon) return;

        // Parse CAP polygon string format ("lat,lon lat,lon ...")
        const points = alert.polygon
          .trim()
          .split(/\s+/)
          .map((pair) => {
            const parts = pair.split(',');
            return [parseFloat(parts[0]), parseFloat(parts[1])];
          })
          .filter((pt) => !isNaN(pt[0]) && !isNaN(pt[1]));

        if (points.length < 3) return;

        const tierMeta = TIER_COLORS[alert.tier] || TIER_COLORS.INFO;
        const warningPoly = L.polygon(points, {
          color: tierMeta.border,
          weight: alert.status === 'APPROVED' ? 3 : 2,
          dashArray: alert.status === 'APPROVED' ? '0' : '6,6',
          fillColor: tierMeta.fill,
          fillOpacity: alert.status === 'APPROVED' ? 0.32 : 0.18,
        });

        const centroid = calculatePolygonCentroid(points);
        const polyBadge = L.divIcon({
          className: 'poly-badge',
          html: `<div style="background: ${tierMeta.bg}; color: #FFFFFF; font-size: 10px; font-weight: bold; padding: 2px 7px; border-radius: 4px; border: 1px solid #FFFFFF; box-shadow: 0 2px 5px rgba(0,0,0,0.35); text-align: center; white-space: nowrap;">
            ${alert.tier} ZONE (${alert.status})
          </div>`,
          iconSize: [110, 22],
          iconAnchor: [55, 11],
        });
        const badgeMarker = L.marker([centroid.lat, centroid.lon], { icon: polyBadge });

        warningPoly.on('click', () => {
          setSelectedCellId(alert.cellId);
        });

        polygonsLayer.addLayer(warningPoly);
        polygonsLayer.addLayer(badgeMarker);
      });
    }
  }, [cells, alerts, layerVisibility, layerOpacity, realSatelliteScene, trackLeadMinutes]);

  // Trigger layer redraw whenever cell, alert, or visibility changes
  useEffect(() => {
    renderGisLayers();
  }, [renderGisLayers]);

  // -------------------------------------------------------------
  // RENDER DRAWING LAYER (GEOJSON POLYGON DRAWER TOOL)
  // -------------------------------------------------------------
  useEffect(() => {
    const drawingLayer = layersGroupRef.current.drawingLayer;
    if (!drawingLayer) return;

    drawingLayer.clearLayers();

    // Render active drawn points and connecting line
    if (drawnPoints.length > 0) {
      drawnPoints.forEach((pt, idx) => {
        const marker = L.circleMarker(pt, {
          radius: 5,
          color: '#FFFFFF',
          weight: 2,
          fillColor: '#D9532F',
          fillOpacity: 1,
        });
        const label = L.divIcon({
          className: 'vertex-idx',
          html: `<div style="background: #1A1D20; color: #FFF; font-size: 9px; font-weight: bold; width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid #FFF;">${
            idx + 1
          }</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        drawingLayer.addLayer(marker);
        drawingLayer.addLayer(L.marker(pt, { icon: label }));
      });

      if (drawnPoints.length >= 2) {
        const line = L.polyline(drawnPoints, {
          color: '#D9532F',
          weight: 2.5,
          dashArray: '4,4',
        });
        drawingLayer.addLayer(line);
      }

      if (drawnPoints.length >= 3) {
        // Preview closed polygon
        const previewPoly = L.polygon(drawnPoints, {
          color: '#D9532F',
          weight: 1.5,
          fillColor: '#D9532F',
          fillOpacity: 0.2,
        });
        drawingLayer.addLayer(previewPoly);
      }
    }

    // Render completed drawn polygon if saved
    if (completedDrawnPolygon && completedDrawnPolygon.length >= 3) {
      const closedPoly = L.polygon(completedDrawnPolygon, {
        color: '#DC2626',
        weight: 3,
        fillColor: '#EF4444',
        fillOpacity: 0.35,
      });
      const centroid = calculatePolygonCentroid(completedDrawnPolygon);
      const label = L.divIcon({
        className: 'user-poly-label',
        html: `<div style="background: #DC2626; color: #FFF; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; border: 1px solid #FFF;">
          MANUAL HAZARD ZONE (${completedDrawnPolygon.length} pts)
        </div>`,
        iconSize: [150, 22],
        iconAnchor: [75, 11],
      });

      drawingLayer.addLayer(closedPoly);
      drawingLayer.addLayer(L.marker([centroid.lat, centroid.lon], { icon: label }));
    }
  }, [drawnPoints, completedDrawnPolygon]);

  // -------------------------------------------------------------
  // POLYGON DRAWER CONTROLS
  // -------------------------------------------------------------
  const handleToggleDrawMode = () => {
    if (!isDrawingMode) {
      setIsDrawingMode(true);
      setDrawnPoints([]);
    } else {
      setIsDrawingMode(false);
      setDrawnPoints([]);
    }
  };

  const handleFinishPolygon = () => {
    if (drawnPoints.length < 3) {
      alert('A minimum of 3 vertices is required to close a hazard polygon.');
      return;
    }
    const closed = [...drawnPoints, drawnPoints[0]]; // Close polygon ring
    setCompletedDrawnPolygon(closed);
    setIsDrawingMode(false);
    setPolygonAlertHeadline(`Duty Forecaster Hazard Zone: ${selectedStation.name}`);
    setShowPolygonAlertModal(true);
  };

  const handleClearDrawing = () => {
    setDrawnPoints([]);
    setCompletedDrawnPolygon(null);
    setIsDrawingMode(false);
  };

  const handleCommitPolygonAsDraft = async () => {
    if (!completedDrawnPolygon) return;
    setDraftSubmitting(true);
    setDraftError('');
    setDraftNotice('');
    const capPolyString = convertGeoJsonToCapPolygon(completedDrawnPolygon);
    const newDraftId = `DRAFT-MANUAL-${Date.now().toString().slice(-4)}`;
    const centroid = calculatePolygonCentroid(completedDrawnPolygon);

    const newAlert = {
      id: newDraftId,
      cellId: `MANUAL-${Date.now().toString().slice(-3)}`,
      cellName: polygonAlertHeadline || 'Manual Forecaster Hazard Zone',
      hazardType: 'CONVECTIVE HAZARD',
      tier: polygonAlertTier,
      location: `Zone Centroid [${centroid.lat.toFixed(3)}°N, ${centroid.lon.toFixed(3)}°E]`,
      targetGrid: `1.5 km Custom Boundary (${completedDrawnPolygon.length - 1} vertices)`,
      affectedDistricts: ['Immediate Convective Infiltration Zone'],
      riskScore: polygonAlertTier === 'SEVERE' ? 0.92 : 0.81,
      etaClock: 'Immediate (15m)',
      etaMinutes: 15,
      maxDbz: 58.0,
      rainRateMmHr: 85,
      windGustKmh: 75,
      status: 'DRAFT',
      createdTimestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST',
      polygon: capPolyString,
      headline_en: polygonAlertHeadline || 'MANUAL HAZARD NOWCAST: Convective Inundation Threat',
      headline_hi: 'मैनुअल आपदा चेतावनी: तत्काल सावधानी बरतें',
      description: `Duty forecaster delineated spatial boundary over active convective cluster near ${selectedStation.name}. Rapid runoff expected.`,
      instruction: 'Move immediately to higher ground and secure exposed assets.',
    };

    try {
      const isDemoSession = !isConfigured || session?.access_token?.startsWith('mock-');
      if (isDemoSession) {
        setAlerts((previous) => [{ ...newAlert, localOnly: true }, ...previous]);
        setDraftNotice('Demo draft added to this session only. Connect an authenticated Supabase session to save or broadcast drafts.');
      } else {
        const { data, error } = await submitDraftAlert(newAlert);
        if (error || !data) {
          setDraftError(error?.message || 'Supabase did not confirm that the draft was saved.');
          return;
        }
        setAlerts((previous) => [{
          ...newAlert,
          ...data,
          cellId: data.cell_uid,
          status: data.status,
          createdTimestamp: data.created_at,
          polygon: capPolyString,
        }, ...previous]);
        setDatabaseError('');
      }
      setShowPolygonAlertModal(false);
      setCompletedDrawnPolygon(null);
      setDrawnPoints([]);
    } catch (error) {
      setDraftError(error?.message || 'The draft could not be saved.');
    } finally {
      setDraftSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // QUICK ACTIONS: INSPECT XAI, APPROVE, REJECT
  // -------------------------------------------------------------
  const handleOpenXaiInspection = (alert) => {
    const targetCell = cells.find((cell) => cell.cellId === alert.cellId);
    if (!targetCell) {
      setLiveCellsError('This alert has no matching live convective cell to inspect.');
      return;
    }
    setSelectedCellId(targetCell.cellId);
    setXaiTargetCell(targetCell);
    setIsXaiModalOpen(true);
  };

  const handleApproveAlert = async (alert) => {
    if (alert.trainingOnly || !['DRAFT', 'UNDER_REVIEW'].includes(alert.status) || pendingAlertActionId) return;
    setPendingAlertActionId(alert.id);
    try {
      let reviewRecord = alert;
      if (alert.status === 'DRAFT') {
        const review = await beginAlertReview(alert.id);
        if (review.error) throw review.error;
        reviewRecord = Array.isArray(review.data) ? review.data[0] : review.data;
        setAlerts((prev) => prev.map((item) => item.id === alert.id
          ? { ...item, ...(reviewRecord || {}), status: 'UNDER_REVIEW' }
          : item));
      }

      const result = await approveAlert(alert.id);
      if (result.error) throw result.error;
      const approvedRecord = Array.isArray(result.data) ? result.data[0] : result.data;
      const approvedAlert = { ...alert, ...(reviewRecord || {}), ...(approvedRecord || {}), status: 'APPROVED' };
      setDatabaseError('');
      setAlerts((prev) => prev.map((item) => item.id === alert.id
        ? { ...item, ...approvedAlert, reviewedBy: dutyOfficer, reviewedAt: approvedRecord?.approved_at || new Date().toISOString() }
        : item));
      setBroadcastBanner({
        alertId: alert.id,
        headline: approvedAlert.headline_en || `${alert.tier} ${alert.hazardType}`,
        location: alert.location,
        recipients: 'Approved alert is available to subscribed citizen clients.',
        timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST',
      });
    } catch (error) {
      setDatabaseError(`Alert approval failed: ${error.message}`);
    } finally {
      setPendingAlertActionId(null);
    }
  };

  const handleStartRejectAlert = (alert) => {
    setRejectingAlert(alert);
    setRejectionRationale('');
    setRejectionError('');
  };

  const handleConfirmRejectAlert = async () => {
    if (!rejectionRationale.trim() || rejectionRationale.trim().length < 15) {
      setRejectionError('Mandatory SOP Rule: Duty Forecaster must state meteorological grounds (minimum 15 characters).');
      return;
    }

    if (pendingAlertActionId) return;
    setPendingAlertActionId(rejectingAlert.id);
    try {
      if (rejectingAlert.status === 'DRAFT') {
        const review = await beginAlertReview(rejectingAlert.id);
        if (review.error) throw review.error;
        const reviewRecord = Array.isArray(review.data) ? review.data[0] : review.data;
        setAlerts((prev) => prev.map((item) => item.id === rejectingAlert.id
          ? { ...item, ...(reviewRecord || {}), status: 'UNDER_REVIEW' }
          : item));
        setRejectingAlert((item) => ({ ...item, ...(reviewRecord || {}), status: 'UNDER_REVIEW' }));
      }
      const result = await rejectAlert(rejectingAlert.id, rejectionRationale.trim());
      if (result.error) throw result.error;
      const rejectedRecord = Array.isArray(result.data) ? result.data[0] : result.data;
      setAlerts((prev) => prev.map((item) => item.id === rejectingAlert.id
        ? { ...item, ...(rejectedRecord || {}), status: 'REJECTED', rejectionReason: rejectionRationale.trim(), reviewedBy: dutyOfficer, reviewedAt: rejectedRecord?.updated_at || new Date().toISOString() }
        : item));
      setRejectingAlert(null);
      setRejectionRationale('');
      setRejectionError('');
    } catch (error) {
      setRejectionError(`Alert rejection failed: ${error.message}`);
    } finally {
      setPendingAlertActionId(null);
    }
  };

  // Forecaster Override committed inside XAI card
  const handleXaiOverrideCommitted = async (overrideData) => {
    const cell = cells.find((item) => item.cellId === overrideData.cellId);
    if (!cell?.databaseId) {
      setCells((previous) => previous.map((item) => item.cellId === overrideData.cellId
        ? { ...item, tier: overrideData.newTier }
        : item));
      setDatabaseError('');
      setDraftNotice('Scenario preview only: this risk adjustment is local to this browser and was not saved to Supabase.');
      return;
    }
    if (!profile?.id) {
      setDatabaseError('Sign in with an authorized officer account before saving a risk override.');
      return;
    }
    try {
      await recordForecasterAction({
        actorId: profile.id,
        action: 'RISK_OVERRIDE',
        entityType: 'convective_cells',
        entityId: cell.databaseId,
        rationale: overrideData.rationale || 'Reset to model assessment',
        oldValues: { risk_level: overrideData.previousTier },
        newValues: { risk_level: overrideData.newTier, is_overridden: overrideData.isOverridden },
      });
      setDatabaseError('');
    } catch (error) {
      setDatabaseError(`Risk override was not saved: ${error.message}`);
      return;
    }

    // Update active cell tier in state
    setCells((prev) =>
      prev.map((c) => (c.cellId === overrideData.cellId ? { ...c, tier: overrideData.newTier } : c))
    );
    // Update matching alerts
    setAlerts((prev) =>
      prev.map((a) =>
        a.cellId === overrideData.cellId
          ? {
              ...a,
              tier: overrideData.newTier,
              modifiedNotes: `Risk overridden from ${overrideData.previousTier} to ${overrideData.newTier} by ${overrideData.dutyOfficer}: "${overrideData.rationale}"`,
            }
          : a
      )
    );
  };

  // Center map on selected cell
  const handleFocusCell = (cell) => {
    setSelectedCellId(cell.cellId);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([cell.lat, cell.lon], 11, { duration: 1.0 });
    }
  };

  // Filtered Queue Alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (queueFilter === 'ALL') return true;
    if (queueFilter === 'DRAFT') return alert.status === 'DRAFT';
    if (queueFilter === 'UNDER_REVIEW') return alert.status === 'UNDER_REVIEW';
    if (queueFilter === 'SEVERE') return alert.tier === 'SEVERE' && alert.status !== 'REJECTED';
    if (queueFilter === 'WARNING') return alert.tier === 'WARNING' && alert.status !== 'REJECTED';
    if (queueFilter === 'APPROVED') return alert.status === 'APPROVED';
    return true;
  });
  const missingRpcSchema = liveCellsError === RPC_SCHEMA_ERROR || databaseError === RPC_SCHEMA_ERROR;

  return (
    <div className="w-full bg-[#FAF7F2] min-h-[calc(100vh-70px)] text-[#1A1D20] flex flex-col antialiased">
      {/* ------------------------------------------------------------- */}
      {/* 1. REAL-TIME STATUS BAR & COMMAND STRIP */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-[#0F172A] border-b border-[#1E293B] text-white px-4 py-2.5 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <DataStatusBadge
              status={currentCell ? nwpStatus.mode : liveCellsLoading ? 'LOADING' : liveCellsError ? 'OFFLINE' : 'EMPTY'}
              metadata={nwpStatus.metadata}
              hasCachedData={Boolean(selectedNwp)}
            />
            <label className="flex items-center gap-1.5 rounded border border-slate-600 bg-[#1E293B] px-2 py-1 text-[10px] font-semibold text-slate-200">
              {translate('NWP Model')}
              <select
                value={nwpModel}
                onChange={(event) => setNwpModel(event.target.value)}
                className="bg-transparent text-white outline-none"
                aria-label="Open-Meteo NWP model"
              >
                <option value="dwd_icon_seamless" className="bg-[#0F172A]">ICON</option>
                <option value="ncep_gfs_seamless" className="bg-[#0F172A]">GFS</option>
              </select>
            </label>
          </div>

          {/* Left: Station Identity & Live WebSocket Status */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold tracking-wider uppercase font-mono text-[11px] text-emerald-400">
                WS: {socketStatus}
              </span>
            </div>

            <span className="text-slate-600 hidden sm:inline">•</span>

            {/* Radar Station Selector */}
            <div className="flex items-center space-x-1.5 bg-[#1E293B] px-2.5 py-1 rounded border border-slate-700">
              <Radio className="w-3.5 h-3.5 text-[#D9532F]" />
              <select
                value={selectedStation.id}
                onChange={(e) => {
                  const st = RADAR_STATIONS.find((s) => s.id === e.target.value);
                  if (st) setSelectedStation(st);
                }}
                className="bg-transparent text-white font-semibold text-xs border-none outline-hidden cursor-pointer"
              >
                {RADAR_STATIONS.map((st) => (
                  <option key={st.id} value={st.id} className="bg-[#0F172A] text-white">
                    {st.name} ({st.station})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-600 hidden sm:inline">•</span>

            {/* Latest database observation */}
            <div className="flex items-center space-x-1 text-slate-300 font-mono text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{translate('DB update #')}{sweepSweepCount}: <strong className="text-white">{lastSweepTime}</strong></span>
            </div>
          </div>

          {/* Right: Latency, Officer Credentials & Emergency Siren Broadcast */}
          <div className="flex items-center flex-wrap gap-3">
            {/* Server Latency Indicator */}
            <div className="flex items-center space-x-1.5 bg-[#1E293B] px-2 py-1 rounded text-slate-300 font-mono text-[11px]">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>{translate('Latency:')} <strong className="text-white">{serverLatencyMs == null ? translate('Not measured') : `${serverLatencyMs} ms`}</strong></span>
            </div>

            {/* Officer Badge */}
            <div className="hidden lg:flex items-center space-x-1.5 text-slate-300 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>{dutyOfficer} [{officerBadge}]</span>
            </div>

            {/* Active Alert Counter Pill */}
            <div className="flex items-center space-x-1.5">
              <span className="px-2 py-0.5 rounded bg-red-950 border border-red-700 text-red-300 font-bold font-mono text-[11px]">
                {severeCount} SEVERE
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-300 font-bold font-mono text-[11px]">
                {draftCount} {translate('DRAFTS PENDING')}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. BROADCAST & EXPORT NOTIFICATION BANNERS */}
      {/* ------------------------------------------------------------- */}
      {broadcastBanner && (
        <div className="bg-emerald-900 border-b border-emerald-700 text-white px-4 py-2.5 text-xs flex items-center justify-between" role="status" aria-live="polite" aria-label="Alert approval confirmation">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>
              <strong>APPROVAL RECORDED:</strong> {broadcastBanner.headline} for {broadcastBanner.location} at {broadcastBanner.timestamp}. {broadcastBanner.recipients}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setBroadcastBanner(null)}
            aria-label="Dismiss approval confirmation"
            className="text-emerald-300 hover:text-white ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {missingRpcSchema && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900" role="status" aria-label="Supabase database setup required">
          {RPC_SCHEMA_ERROR} Live cell and alert data remain unavailable until Supabase confirms the functions are installed.
        </div>
      )}

      {isScenarioMode && (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-900" role="status">
          Scenario preview only: cells and radar values are illustrative, not live observations or approved warnings. Track cones through 6 hours are constant-velocity extrapolations, not validated forecasts. Selected-cell NWP guidance is fetched separately.
        </div>
      )}

      {currentCell?.initiation?.status === 'SIMULATED_DEMO_FIXTURE' && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900" role="status">
          Detector input: simulated frames. Initiation status is a demo fixture, not an observation.
        </div>
      )}

      {liveCellsError && !missingRpcSchema && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700" role="alert" aria-label="Live cell data unavailable">
          Offline Database: {liveCellsError} No live cell data is available.
        </div>
      )}

      {databaseError && !missingRpcSchema && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700" role="alert" aria-label="Database operation error">
          Offline Database: {databaseError} Alert changes are not shown as saved unless Supabase confirms them.
        </div>
      )}

      {nwpError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900" role="alert" aria-label="NWP feed status">
          {nwpError} {selectedNwp ? 'Showing the last successful sounding for this cell.' : 'Live instability values are unavailable.'}
        </div>
      )}

      {draftNotice && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900" role="status">
          <span>{draftNotice}</span>
          <button type="button" onClick={() => setDraftNotice('')} aria-label="Dismiss draft notice" className="shrink-0 text-amber-800 hover:text-amber-950">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN SPLIT COMMAND CENTER: GIS CANVAS + REVIEW QUEUE */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 relative">
        {/* ========================================================= */}
        {/* LEFT / CENTER: INTERACTIVE LEAFLET GIS CANVAS (7 or 8 COLS) */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 min-w-0 flex flex-col relative isolate z-0 overflow-hidden h-[min(70vh,560px)] min-h-[420px] lg:h-auto lg:min-h-[500px]">
          {/* Map Leaflet Container DOM */}
          <div ref={mapContainerRef} className="relative z-0 w-full h-full overflow-hidden bg-[#E2DDD5]" />

          {/* FLOATING TOP TOOLBAR: LAYER SWITCHER & DRAWING TOOLS */}
          <div className="absolute top-4 left-4 z-10 flex flex-col sm:flex-row items-start sm:items-center gap-2 max-w-full">
            {/* Draw Hazard Zone Button */}
            <div className="bg-white/95 backdrop-blur-md border border-[#E5E0D8] rounded-xl p-1.5 shadow-md flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleToggleDrawMode}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer ${
                  isDrawingMode
                    ? 'bg-[#DC2626] text-white animate-pulse'
                    : 'bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[#0F172A] border border-[#E5E0D8]'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{translate(isDrawingMode ? 'Drawing Active (Click Map)' : 'Draw Hazard Zone')}</span>
              </button>

              {isDrawingMode && (
                <>
                  <button
                    type="button"
                    onClick={handleFinishPolygon}
                    disabled={drawnPoints.length < 3}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center space-x-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{translate('Close Ring')} ({drawnPoints.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDrawing}
                    className="p-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
                    title="Clear vertices"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Station Quick Center Button */}
            <button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([selectedStation.lat, selectedStation.lon], 10);
                }
              }}
              className="bg-white/95 backdrop-blur-md border border-[#E5E0D8] px-3 py-2 rounded-xl text-xs font-bold text-[#0F172A] hover:bg-[#FAF7F2] shadow-md flex items-center space-x-1.5 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-[#D9532F]" />
              <span>{translate('Center')} {selectedStation.id}</span>
            </button>
          </div>

          {/* FLOATING LAYER CONTROL SWITCHER (BOTTOM-LEFT) */}
          <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-md border border-[#E5E0D8] rounded-xl p-3 shadow-lg max-w-xs text-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-1.5">
              <span className="font-bold text-[11px] uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#D9532F]" />
                {translate('GIS Raster & Vector Layers')}
              </span>
              <span className="text-[10px] font-mono text-[#6C7278]">{translate('5-Layer Fusion')}</span>
            </div>

            <div className="space-y-1.5">
              {/* 1. Radar dBZ */}
              <label className="flex items-center justify-between cursor-pointer hover:bg-[#FAF7F2] p-1 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]"></span>
                  <span className="font-medium text-[#1A1D20]">{translate('Radar Reflectivity (dBZ)')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.radarDbz}
                  onChange={(e) =>
                    setLayerVisibility((prev) => ({ ...prev, radarDbz: e.target.checked }))
                  }
                  className="rounded text-[#D9532F] focus:ring-[#D9532F]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer hover:bg-[#FAF7F2] p-1 rounded">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-2.5 h-2.5 shrink-0 border border-sky-700 bg-sky-200"></span>
                  <span className="truncate font-medium text-[#1A1D20]">Real INSAT-3DR scene</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.realInsatScene}
                  onChange={(event) => setLayerVisibility((previous) => ({ ...previous, realInsatScene: event.target.checked }))}
                  className="rounded text-[#D9532F] focus:ring-[#D9532F]"
                />
              </label>
              {realSatelliteScene?.analysis_status === 'AWAITING_CALIBRATION' && (
                <p className="px-1 text-[10px] leading-4 text-amber-800">Raw channel preview only; no temperature units or matching calibration were found.</p>
              )}

              {/* 2. INSAT Cloud Tops */}
              <label className="flex items-center justify-between cursor-pointer hover:bg-[#FAF7F2] p-1 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6366F1]"></span>
                  <span className="font-medium text-[#1A1D20]">{translate('INSAT Cloud Tops (IR CTT)')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.insatCloudTop}
                  onChange={(e) =>
                    setLayerVisibility((prev) => ({ ...prev, insatCloudTop: e.target.checked }))
                  }
                  className="rounded text-[#D9532F] focus:ring-[#D9532F]"
                />
              </label>

              {/* 3. Lightning Strike Heatmap */}
              <label className="flex items-center justify-between cursor-pointer hover:bg-[#FAF7F2] p-1 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                  <span className="font-medium text-[#1A1D20]">{translate('Lightning Strike Heatmap')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.lightningHeatmap}
                  onChange={(e) =>
                    setLayerVisibility((prev) => ({ ...prev, lightningHeatmap: e.target.checked }))
                  }
                  className="rounded text-[#D9532F] focus:ring-[#D9532F]"
                />
              </label>

              {/* 4. Optical Flow Track Cones */}
              <label className="flex items-center justify-between cursor-pointer hover:bg-[#FAF7F2] p-1 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0F172A]"></span>
                  <span className="font-medium text-[#1A1D20]">{translate('Optical Flow Track Cones')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.opticalFlowCones}
                  onChange={(e) =>
                    setLayerVisibility((prev) => ({ ...prev, opticalFlowCones: e.target.checked }))
                  }
                  className="rounded text-[#D9532F] focus:ring-[#D9532F]"
                />
              </label>
              {layerVisibility.opticalFlowCones && (
                <label htmlFor="track-lead-minutes" className="flex items-center justify-between gap-3 px-1 py-1 text-[11px]">
                  <span className="font-medium text-[#1A1D20]">Track horizon</span>
                  <select
                    id="track-lead-minutes"
                    value={trackLeadMinutes}
                    onChange={(event) => setTrackLeadMinutes(Number(event.target.value))}
                    className="min-w-24 border border-[#D8DDE0] bg-white px-2 py-1 text-xs text-[#1A1D20]"
                  >
                    {TRACK_LEAD_OPTIONS_MIN.map((leadMinutes) => (
                      <option key={leadMinutes} value={leadMinutes}>
                        {leadMinutes < 60 ? `${leadMinutes} min` : `${leadMinutes / 60} h`}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* 5. Active Warning Polygons */}
              <label className="flex items-center justify-between cursor-pointer hover:bg-[#FAF7F2] p-1 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]"></span>
                  <span className="font-medium text-[#1A1D20]">{translate('Active Warning Polygons')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.warningPolygons}
                  onChange={(e) =>
                    setLayerVisibility((prev) => ({ ...prev, warningPolygons: e.target.checked }))
                  }
                  className="rounded text-[#D9532F] focus:ring-[#D9532F]"
                />
              </label>
            </div>

            {/* Radar dBZ Color Scale Bar */}
            <div className="pt-2 border-t border-[#E5E0D8] space-y-1">
              <div className="flex items-center justify-between text-[10px] text-[#6C7278] font-mono">
                <span>20 dBZ (Light)</span>
                <span>45 dBZ</span>
                <span>65+ dBZ (Hail)</span>
              </div>
              <div className="h-2 rounded-full w-full bg-linear-to-r from-blue-400 via-green-500 via-yellow-400 via-orange-500 to-red-600"></div>
            </div>
          </div>

          {/* ACTIVE CELL STATS OVERLAY (BOTTOM-RIGHT) */}
          {currentCell && (
            <div className="absolute bottom-4 right-4 z-10 bg-[#0F172A]/90 backdrop-blur-md border border-[#1E293B] rounded-xl p-3 text-white shadow-xl max-w-xs text-xs space-y-1.5 hidden sm:block">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">{currentCell.cellName}</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white"
                  style={{ backgroundColor: TIER_COLORS[currentCell.tier]?.bg || '#DC2626' }}
                >
                  {currentCell.tier}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-700">
                <div>Reflectivity: <strong className="text-red-400">{currentCell.radarDbz} dBZ</strong></div>
                <div>Rain Rate: <strong className="text-amber-400">{currentCell.rainRateMmHr} mm/h</strong></div>
                <div>Echo Top: <strong className="text-white">{currentCell.echoTopKm} km</strong></div>
                <div>VIL: <strong className="text-white">{currentCell.vilKgM2} kg/m²</strong></div>
              </div>
              <div className="border-t border-slate-700 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-1">Hazard heads</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono text-slate-300">
                  <div>Hail: <strong className="text-amber-200">{currentCell.hailProbability != null ? `${(Number(currentCell.hailProbability) * 100).toFixed(0)}%` : '—'}</strong></div>
                  <div>Downburst: <strong className="text-orange-200">{currentCell.downburstGustKmh != null ? `${Number(currentCell.downburstGustKmh).toFixed(0)} km/h` : '—'}</strong></div>
                  <div>Cloudburst: <strong className="text-sky-200">{currentCell.cloudburstMmHr != null ? `${Number(currentCell.cloudburstMmHr).toFixed(0)} mm/h` : '—'}</strong></div>
                  <div>Lightning: <strong className="text-yellow-200">{currentCell.lightningDensity != null ? `${Number(currentCell.lightningDensity).toFixed(2)} /km²` : '—'}</strong></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-700 pt-2 text-[10px] font-mono text-slate-300">
                <div>CAPE: <strong className="text-sky-200">{selectedNwp?.current_cape ?? '—'}{selectedNwp?.current_cape != null ? ' J/kg' : ''}</strong></div>
                <div>CIN: <strong className="text-sky-200">{selectedNwp?.cin_estimate ?? '—'}{selectedNwp?.cin_estimate != null ? ' J/kg' : ''}</strong></div>
                <div>Lifted Index: <strong className="text-sky-200">{selectedNwp?.lifted_index ?? '—'}{selectedNwp?.lifted_index != null ? ' °C' : ''}</strong></div>
                <div>Wind Shear: <strong className="text-sky-200">{selectedNwp?.wind_shear_ms ?? '—'}{selectedNwp?.wind_shear_ms != null ? ' m/s' : ''}</strong></div>
                <div>PWAT: <strong className="text-sky-200">{selectedNwp?.pwat_mm ?? '—'}{selectedNwp?.pwat_mm != null ? ' mm' : ''}</strong></div>
                <div>Max Gust: <strong className="text-sky-200">{selectedNwp?.max_gust_kmh ?? '—'}{selectedNwp?.max_gust_kmh != null ? ' km/h' : ''}</strong></div>
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                {selectedNwp?.timestamp ? `NWP valid ${selectedNwp.timestamp}` : 'NWP values unavailable'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setXaiTargetCell(currentCell);
                  setIsXaiModalOpen(true);
                }}
                className="w-full mt-1 bg-[#D9532F] hover:bg-[#BF4422] text-white py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Inspect XAI Attribution</span>
              </button>
            </div>
          )}
        </div>

        <section className="lg:col-span-8 rounded-xl border border-[#E5E0D8] bg-white p-4 shadow-xs" aria-labelledby="model-skill-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 id="model-skill-heading" className="text-sm font-bold text-[#0F172A]">Model Skill vs Persistence</h3>
              <p className="text-[11px] text-[#6C7278]">Synthetic reconstruction - relative skill only, not real-world operational CSI</p>
            </div>
            {verificationData?.status === 'SYNTHETIC_RECONSTRUCTIONS_ONLY' && <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">SYNTHETIC</span>}
          </div>
          <div className="mt-3 inline-flex border-b border-slate-200" role="tablist" aria-label="Model skill data source">
            {[
              ['synthetic', 'Synthetic skill'],
              ['real', 'IMERG archived'],
            ].map(([view, label]) => (
              <button key={view} type="button" role="tab" aria-selected={verificationView === view} onClick={() => setVerificationView(view)} className={`border-b-2 px-3 py-2 text-[11px] font-semibold ${verificationView === view ? 'border-[#D9532F] text-slate-900' : 'border-transparent text-slate-500'}`}>
                {label}
              </button>
            ))}
          </div>
          {verificationView === 'synthetic' && <>
          {verificationError && <p className="mt-2 text-xs text-red-700">{verificationError}</p>}
          {verificationData?.status === 'NOT_GENERATED' && <p className="mt-2 text-xs text-slate-600">Run verification harness to populate.</p>}
          {verificationData?.cases?.length > 0 && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
                {[60, 120].map((lead) => {
                  const row = skillLeadRows.find((item) => item.lead_minutes === lead);
                  return (
                    <div key={lead} className="rounded border border-slate-200 bg-slate-50 p-2">
                      <strong className="block text-slate-900">{lead}-min CSI across cases</strong>
                      <span>Nowcast {formatSkillEstimate(row?.nowcast_CSI)}</span>
                      <span className="block">Persistence {formatSkillEstimate(row?.persistence_CSI)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 rounded border border-slate-200 bg-white p-2">
                <div className="mb-1 flex gap-4 text-[10px] font-semibold text-slate-700">
                  <span className="text-red-700">Nowcast CSI</span>
                  <span className="text-blue-700">Persistence CSI</span>
                </div>
                <svg viewBox="0 0 600 130" className="h-32 w-full" role="img" aria-label="Synthetic CSI versus lead time for nowcast and persistence">
                  <line x1="40" y1="105" x2="560" y2="105" stroke="#94a3b8" />
                  <line x1="40" y1="25" x2="40" y2="105" stroke="#94a3b8" />
                  <polyline points={skillChartPoints('nowcast_CSI')} fill="none" stroke="#b91c1c" strokeWidth="2.5" />
                  <polyline points={skillChartPoints('persistence_CSI')} fill="none" stroke="#1d4ed8" strokeWidth="2.5" />
                  {skillLeadRows.map((row, index) => (
                    <text key={row.lead_minutes} x={40 + index * 104} y="122" textAnchor="middle" fontSize="9" fill="#475569">{row.lead_minutes}m</text>
                  ))}
                </svg>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
              {verificationData.cases.filter((item) => item.lead_minutes === 60).map((item) => (
                <div key={item.case} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] font-mono text-slate-700">
                  <div className="mb-1 font-sans text-[11px] font-bold text-slate-900">{item.case}</div>
                  <div>60-min CSI {formatSkillEstimate(item.nowcast.CSI)} / {formatSkillEstimate(item.persistence.CSI)}</div>
                  <div>120-min CSI {formatSkillEstimate(verificationData.cases.find((leadRow) => leadRow.case === item.case && leadRow.lead_minutes === 120)?.nowcast.CSI)} / {formatSkillEstimate(verificationData.cases.find((leadRow) => leadRow.case === item.case && leadRow.lead_minutes === 120)?.persistence.CSI)}</div>
                  <div>60-min POD {formatSkillEstimate(item.nowcast.POD)} / {formatSkillEstimate(item.persistence.POD)}</div>
                  <div>60-min FAR {formatSkillEstimate(item.nowcast.FAR)} / {formatSkillEstimate(item.persistence.FAR)}</div>
                </div>
              ))}
              </div>
            </>
          )}
          </>}
          {verificationView === 'real' && (
            <div className="mt-3">
              {realVerificationError && <p className="text-xs text-red-700">{realVerificationError}</p>}
              {realVerificationData?.status === 'AWAITING REAL DATA' && (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                  <strong>AWAITING REAL DATA</strong>
                  <p className="mt-1">{realVerificationData.instructions}</p>
                </div>
              )}
              {realVerificationData?.status === 'REAL DATA PRESENT - VERIFICATION NOT RUN' && (
                <p className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">{realVerificationData.instructions}</p>
              )}
              {realVerificationData?.status === 'REAL_ARCHIVED' && (
                <>
                  <p className="text-[10px] text-slate-600">GPM IMERG Final Run V07 archived precipitation rate. This satellite-derived product includes morphing/advection processing; it is not an independent operational-radar test and is approximately 10 km, coarser than the 1-3 km target.</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {realVerificationData.cases.map((caseResult) => (
                      <div key={caseResult.case_id} className="rounded border border-slate-200 bg-slate-50 p-2 text-[10px] font-mono text-slate-700">
                        <strong className="block font-sans text-[11px] text-slate-900">{caseResult.case_id.replaceAll('_', ' ')}</strong>
                        <span>{caseResult.frames_loaded}/{caseResult.files_found} frames · {caseResult.first_timestamp_utc} to {caseResult.last_timestamp_utc}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 max-h-72 overflow-auto rounded border border-slate-200">
                    <table className="w-full min-w-[760px] text-left text-[10px]">
                      <thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Case</th><th className="p-2">Lead</th><th className="p-2">Threshold</th><th className="p-2">Nowcast CSI</th><th className="p-2">Persistence CSI</th><th className="p-2">POD / FAR</th><th className="p-2">FSS / Bias</th><th className="p-2">Valid area</th></tr></thead>
                      <tbody>
                        {realVerificationData.cases.flatMap((caseResult) => caseResult.results.map((row) => (
                          <tr key={`${caseResult.case_id}-${row.lead_minutes}-${row.threshold_mm_hr}`} className="border-t border-slate-200">
                            <td className="p-2">{caseResult.case_id}</td><td className="p-2">{row.lead_minutes} min</td><td className="p-2">{row.threshold_mm_hr} mm/h</td>
                            <td className="p-2">{formatSkillEstimate(row.nowcast.CSI)}</td><td className="p-2">{formatSkillEstimate(row.persistence.CSI)}</td>
                            <td className="p-2">{formatSkillEstimate(row.nowcast.POD)} / {formatSkillEstimate(row.nowcast.FAR)}</td>
                            <td className="p-2">{formatSkillEstimate(row.nowcast.FSS)} / {formatSkillEstimate(row.nowcast.bias)}</td>
                            <td className="p-2">{(row.valid_area_fraction * 100).toFixed(1)}%</td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-[10px] text-slate-600">{realVerificationData.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul>
                </>
              )}
            </div>
          )}

          <div className="mt-4 border-t border-slate-200 pt-4" aria-label="Real-world documented Leh anchor case">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900">Real-World Anchor Case - Leh 2010</h4>
              {leh2010Case && <span className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-900">DOCUMENTED_CASE - from published paper, not imagery</span>}
            </div>
            {realCaseError && <p className="mt-2 text-xs text-red-700">{realCaseError}</p>}
            {realCaseData?.status === 'AWAITING REAL DATA' && <p className="mt-2 text-xs text-slate-600">AWAITING REAL DATA: documented case records are missing from this deployment.</p>}
            {leh2010Case && (
              <>
                <p className="mt-1 text-[10px] text-slate-600">Schematic timeline from documented UTC chronology; not satellite imagery.</p>
                <ol className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
                  {anchorTimeline.map(({ label, entry }) => {
                    const eventMillis = documentedUtcMillis(entry.time_utc);
                    const leadHours = impactMillis != null && eventMillis != null
                      ? Math.round((impactMillis - eventMillis) / 360000) / 10
                      : null;
                    return (
                      <li key={label} className="rounded border border-slate-200 bg-slate-50 p-2">
                        <strong className="block text-[11px] text-slate-900">{label}</strong>
                        <span className="block text-[10px] text-slate-700">{entry.time_utc} UTC</span>
                        {label !== 'Landslide' && leadHours != null && <span className="block text-[10px] font-mono text-sky-900">{leadHours} h to impact</span>}
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded border border-slate-200 p-3 text-[11px] text-slate-700">
                    <strong className="block text-slate-900">Observed facts</strong>
                    <p className="mt-1">Leh observatory measured {leh2010Case.leh_observatory.rainfall_mm} mm in 24 h; the paper says the heaviest rain fell south of the city and was not gauged. Choglamsar, about 5 km south, had the most damage. Reported impact: {leh2010Case.event.reported_deaths} deaths and {leh2010Case.event.reported_injured} injured.</p>
                    <p className="mt-2 font-semibold text-slate-900">Source: {leh2010Case.citation}</p>
                  </div>
                  <div className="rounded border border-slate-200 p-3 text-[11px] text-slate-700">
                    <strong className="block text-slate-900">What each VayuGati head reports for this case</strong>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-[10px]">
                        <thead><tr><th className="py-1 pr-2">Head</th><th className="py-1 pr-2">Result</th><th className="py-1">Basis</th></tr></thead>
                        <tbody>
                          {leh2010Case.rain_anomaly.head_reports.map((head) => (
                            <tr key={head.head} className="border-t border-slate-200 align-top">
                              <td className="py-1 pr-2 font-semibold">{head.head}</td><td className="py-1 pr-2">{head.result}</td><td className="py-1">{head.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2">TRMM estimates are satellite-derived with known uncertainty.</p>
                    <p className="mt-1 font-semibold text-slate-900">Source: {leh2010Case.citation}</p>
                  </div>
                </div>
                {leh2011Case && (
                  <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-950">
                    False-alarm risk discussion: on 25 Jul 2011 the anomaly heuristic also triggers from a documented &gt;40 mm / 6 h lower bound, while the paper reports no rain at Leh, casualties, or landslides. This is not presented as a success. Source: {leh2011Case.citation}
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* RIGHT: ALERT REVIEW QUEUE SIDE-PANEL (4 COLS) */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 min-w-0 bg-[#FFFFFF] border-t lg:border-t-0 lg:border-l border-[#E5E0D8] flex flex-col min-h-[28rem] lg:h-full lg:max-h-[calc(100vh-115px)] overflow-hidden">
          {/* Panel Header */}
          <div className="p-4 border-b border-[#E5E0D8] bg-[#FAF7F2] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#D9532F]" />
                <h3 className="font-bold text-sm text-[#0F172A] tracking-tight">
                  Alert Review Queue (Nowcast HITL)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-red-100 text-red-800 border border-red-200">
                {draftCount} PENDING
              </span>
            </div>
            <p className="text-xs text-[#6C7278] leading-tight">
              Human-in-the-Loop review under <strong>IMD SOP #2024-MET-09</strong>. AI-generated nowcast drafts require Duty Forecaster sign-off.
            </p>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 text-xs font-semibold">
              {[
                { id: 'ALL', label: 'All', count: alerts.length },
                { id: 'DRAFT', label: 'Drafts', count: draftCount },
                { id: 'UNDER_REVIEW', label: 'Under review', count: alerts.filter((a) => a.status === 'UNDER_REVIEW').length },
                { id: 'SEVERE', label: 'Severe', count: severeCount },
                { id: 'APPROVED', label: 'Approved', count: approvedCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setQueueFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    queueFilter === tab.id
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'bg-white text-[#6C7278] hover:text-[#0F172A] border border-[#E5E0D8]'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Alert Cards Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-10 space-y-2 text-[#6C7278]">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-semibold text-[#0F172A]">Queue Clear</p>
                <p className="text-[11px]">No alerts matching the selected filter criteria.</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const tierMeta = TIER_COLORS[alert.tier] || TIER_COLORS.INFO;
                const isApproved = alert.status === 'APPROVED';
                const isRejected = alert.status === 'REJECTED';
                const isDraft = alert.status === 'DRAFT';
                const isUnderReview = alert.status === 'UNDER_REVIEW';

                return (
                  <div
                    key={alert.id}
                    className={`bg-[#FAF7F2] border rounded-xl p-3.5 space-y-3 transition-all ${
                      isDraft
                        ? 'border-amber-300 hover:border-[#D9532F] shadow-xs'
                        : isApproved
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-slate-300 opacity-70'
                    }`}
                  >
                    {/* Card Header: Cell ID, Risk Tier, ETA */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-bold text-xs text-[#0F172A]">
                            [{alert.cellId}]
                          </span>
                          <span className="font-bold text-xs text-[#1A1D20] line-clamp-1">
                            {alert.cellName}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#6C7278] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#D9532F]" />
                          <span className="line-clamp-1">{alert.location}</span>
                        </span>
                      </div>

                      {/* Tier Badge */}
                      <div className="text-right shrink-0">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white inline-block shadow-2xs"
                          style={{ backgroundColor: tierMeta.bg }}
                        >
                          {alert.tier}
                        </span>
                        <div className="text-[10px] font-mono text-[#D9532F] font-bold mt-0.5">
                          ETA {alert.etaClock}
                        </div>
                      </div>
                    </div>

                    {/* Meteorological Telemetry Strip */}
                    <div className="grid grid-cols-3 gap-2 bg-white p-2 rounded-lg border border-[#E5E0D8] text-center text-[10px] font-mono">
                      <div>
                        <span className="text-[#6C7278] block">Reflectivity</span>
                        <strong className="text-red-600">{alert.maxDbz} dBZ</strong>
                      </div>
                      <div>
                        <span className="text-[#6C7278] block">Rain Rate</span>
                        <strong className="text-amber-600">{alert.rainRateMmHr} mm/h</strong>
                      </div>
                      <div>
                        <span className="text-[#6C7278] block">AI Confidence</span>
                        <strong className="text-[#0F172A]">{Math.round((alert.riskScore || 0.94) * 100)}%</strong>
                      </div>
                    </div>

                    {/* AI Draft Headline or Notes */}
                    <p className="text-[11px] text-[#475569] leading-relaxed line-clamp-2 italic bg-white/70 p-2 rounded border border-[#E5E0D8]">
                      "{alert.headline_en}"
                    </p>

                    {/* Status Pill & Audit Metadata */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#6C7278] pt-1 border-t border-[#E5E0D8]">
                      <span>Status: <strong className={isApproved ? 'text-emerald-700' : isRejected ? 'text-red-700' : isUnderReview ? 'text-blue-700' : 'text-amber-700'}>{alert.status}</strong></span>
                      <span>Created: {alert.createdTimestamp}</span>
                    </div>
                    {alert.trainingOnly && <p className="text-[10px] font-semibold text-sky-800">Training sample · saved as draft and cannot be broadcast</p>}

                    {alert.reviewedBy && (
                      <div className="text-[10px] font-mono bg-white px-2 py-1 rounded border border-[#E5E0D8] text-slate-700">
                        Officer: {alert.reviewedBy} • {alert.reviewedAt}
                        {alert.rejectionReason && (
                          <div className="text-red-600 mt-0.5">Reason: "{alert.rejectionReason}"</div>
                        )}
                      </div>
                    )}

                    {/* QUICK ACTION BUTTONS */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {/* 1. Inspect XAI Features */}
                      <button
                        type="button"
                        onClick={() => handleOpenXaiInspection(alert)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-[#0F172A] border border-[#E5E0D8] flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                        title="Open XAI Mathematical Attribution breakdown"
                      >
                        <BrainCircuit className="w-3.5 h-3.5 text-[#D9532F]" />
                        <span>Inspect XAI</span>
                      </button>

                      {/* 3. Approve & Broadcast (For DRAFT) */}
                      {(isDraft || isUnderReview) && (
                        <button
                          type="button"
                          onClick={() => handleApproveAlert(alert)}
                          disabled={pendingAlertActionId === alert.id || alert.trainingOnly}
                          title={alert.trainingOnly ? 'Training-only drafts cannot be approved or broadcast.' : undefined}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center space-x-1 transition-colors shadow-xs cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{pendingAlertActionId === alert.id ? 'Processing…' : 'Approve &amp; Broadcast'}</span>
                        </button>
                      )}

                      {/* 4. Reject / Dismiss (For DRAFT) */}
                      {(isDraft || isUnderReview) && (
                        <button
                          type="button"
                          onClick={() => handleStartRejectAlert(alert)}
                          disabled={pendingAlertActionId === alert.id || alert.localOnly}
                          title={alert.localOnly ? 'Demo-only drafts cannot be reviewed until saved to Supabase.' : undefined}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white hover:bg-red-50 text-red-600 border border-red-200 flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject / Dismiss</span>
                        </button>
                      )}

                      {/* If already approved: Quick view map button */}
                      {isApproved && (
                        <button
                          type="button"
                          onClick={() => {
                            const matchingCell = cells.find((c) => c.cellId === alert.cellId);
                            if (matchingCell) handleFocusCell(matchingCell);
                          }}
                          className="col-span-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Zoom to Active Warning Zone</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 4. MODALS */}
      {/* ============================================================= */}

      {/* MODAL 1: EXPLAINABLE AI (XAI) MATHEMATICAL ATTRIBUTION CARD MODAL */}
      {isXaiModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="max-w-4xl w-full my-auto animate-in zoom-in-95 duration-200 relative">
            <button
              type="button"
              onClick={() => setIsXaiModalOpen(false)}
              className="absolute -top-3 -right-3 z-10 p-2 bg-[#0F172A] text-white rounded-full border border-slate-600 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close XAI Card"
            >
              <X className="w-4 h-4" />
            </button>
            <SHAPExplainabilityCard
              cellData={xaiTargetCell}
              nwpData={xaiTargetCell ? nwpByCell[xaiTargetCell.cellId] : selectedNwp}
              nwpStatus={nwpStatus}
              dutyOfficer={dutyOfficer}
              badgeId={officerBadge}
              onOverride={(overridePayload) => {
                handleXaiOverrideCommitted(overridePayload);
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT ALERT WITH MANDATORY METEOROLOGICAL RATIONALE */}
      {rejectingAlert && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E0D8] max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-base text-[#0F172A]">
                  Reject Draft Alert [{rejectingAlert.id}]
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingAlert(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 space-y-1">
              <strong>Mandatory IMD SOP #2024-MET-09 Compliance:</strong>
              <p>
                Every rejection of an AI convective warning requires a written meteorological rationale by the Duty Forecaster for post-event audit.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#0F172A]">
                Duty Forecaster Meteorological Rationale:
              </label>
              <textarea
                rows={3}
                value={rejectionRationale}
                onChange={(e) => setRejectionRationale(e.target.value)}
                placeholder="e.g., Radar Three-Body Scatter Spike confirmed as AP ground clutter; surface soundings show persistent CIN inversion cap..."
                className="w-full text-xs p-2.5 rounded-lg border border-[#E5E0D8] focus:border-[#D9532F] focus:outline-hidden font-sans"
              />
              {rejectionError && (
                <p className="text-[11px] text-red-600 font-medium">{rejectionError}</p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingAlert(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[#6C7278] hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectAlert}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
              >
                Confirm Dismissal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE ALERT FROM DRAWN POLYGON */}
      {showPolygonAlertModal && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E0D8] max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div className="flex items-center space-x-2">
                <PenTool className="w-5 h-5 text-[#D9532F]" />
                <h3 className="font-bold text-base text-[#0F172A]">
                  Convert Drawn Hazard Zone to Draft Alert
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPolygonAlertModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Alert Headline (EN):</label>
                <input
                  type="text"
                  value={polygonAlertHeadline}
                  onChange={(e) => setPolygonAlertHeadline(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5E0D8] text-xs font-semibold focus:border-[#D9532F] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Target Risk Tier:</label>
                <select
                  value={polygonAlertTier}
                  onChange={(e) => setPolygonAlertTier(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5E0D8] text-xs font-semibold focus:border-[#D9532F] focus:outline-hidden"
                >
                  <option value="SEVERE">SEVERE (Immediate Cloudburst / Destructive Hail)</option>
                  <option value="WARNING">WARNING (Severe Thunderstorm &amp; Squall)</option>
                  <option value="WATCH">WATCH (Developing Foothill Inundation)</option>
                  <option value="INFO">INFO (Advisory Only)</option>
                </select>
              </div>

              <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#E5E0D8] space-y-1 font-mono text-[11px] text-[#475569]">
                <div>Vertices: {completedDrawnPolygon?.length ? completedDrawnPolygon.length - 1 : 0} points</div>
                <div>CAP Polygon Format: ITU-T X.1303 whitespace lat,lon pairs string</div>
              </div>
              {draftError && <p className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-800" role="alert">Draft was not saved: {draftError}</p>}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPolygonAlertModal(false);
                  setCompletedDrawnPolygon(null);
                  setDraftError('');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[#6C7278] hover:bg-slate-100 cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleCommitPolygonAsDraft}
                disabled={draftSubmitting}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#D9532F] hover:bg-[#BF4422] disabled:cursor-wait disabled:opacity-60 text-white transition-colors cursor-pointer"
              >
                {draftSubmitting ? 'Saving Draft...' : 'Create Nowcast Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
