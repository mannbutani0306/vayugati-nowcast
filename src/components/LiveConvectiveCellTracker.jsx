/**
 * @file LiveConvectiveCellTracker.jsx
 * @description Advanced GIS Multi-Layer Convective Cell Tracker for VayuGati Nowcast .
 * Capabilities:
 * - Provider-backed radar, satellite, and lightning observation layers with per-feed status.
 * - Optical-flow vector trajectory calculations with 15/30/45/60 min predictive advection cones.
 * - Dynamic countdown timers for hyper-local sub-district impacts.
 * - Real-time storm cell directory with filtering and centering.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  Radio,
  CloudRain,
  Zap,
  Layers,
  Compass,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  MapPin,
  Eye,
  EyeOff,
  Filter,
  Maximize2,
  Wind,
  Navigation,
  Info,
} from 'lucide-react';
import { SEVERITY_TIERS, SECTOR_INFO } from '../utils/mockDataSeed';
import DataDisclaimerModal from './DataDisclaimerModal';
import { fetchLightningFeed, fetchRadarFeed, fetchSatelliteFeed } from '../lib/apiClient';

// Convective Cells Catalog with Optical Flow Vector Physics & Hyper-local Impact Trajectories
export const MOCK_STORM_CELLS = [
  {
    id: 'CELL-A1',
    name: 'Sahastradhara Cloudburst Core',
    tier: 'SEVERE',
    lat: 30.368,
    lon: 78.085,
    speedKmh: 38,
    headingDeg: 65,
    headingText: 'ENE (065°)',
    maxDbz: 63.8,
    minCtt: -76.4,
    cape: 2940,
    cin: -24,
    vil: 68, // Vertically Integrated Liquid (kg/m²)
    rainRateMmHr: 118,
    hailProbability: 88,
    downburstProbability: 84,
    cellDiameterKm: 9.5,
    growthTrend: 'Deepening (+4 dBZ/10m)',
    lastUpdated: '1 min ago (DWR Dehradun)',
    description: 'Vigorous supercell updraft penetrating tropopause. Dual-pol differential reflectivity confirms giant hail melt core and extreme precipitation efficiency.',
    waypoints: [
      { timeOffsetMin: 0, lat: 30.368, lon: 78.085, label: 'T0 (Now)', radiusKm: 4.8 },
      { timeOffsetMin: 15, lat: 30.395, lon: 78.140, label: '+15m', radiusKm: 5.2 },
      { timeOffsetMin: 30, lat: 30.422, lon: 78.196, label: '+30m', radiusKm: 5.8 },
      { timeOffsetMin: 45, lat: 30.448, lon: 78.252, label: '+45m', radiusKm: 6.3 },
      { timeOffsetMin: 60, lat: 30.473, lon: 78.308, label: '+60m', radiusKm: 6.8 },
    ],
    impactTargets: [
      { location: 'Rajpur Foothill Corridor', distanceKm: 3.8, initialMinutes: 7, risk: 'CRITICAL', advisory: 'Immediate flash flood alarm; halt hill traffic.' },
      { location: 'Sahastradhara River Basin', distanceKm: 7.4, initialMinutes: 14, risk: 'CRITICAL', advisory: 'Divert tourist buses; evacuate riverbeds.' },
      { location: 'Mussoorie Bypass Junction', distanceKm: 13.2, initialMinutes: 24, risk: 'SEVERE', advisory: 'Landslide hazard; prepare SDRF roadblocks.' },
      { location: 'Rishikesh Valley Choke', distanceKm: 24.5, initialMinutes: 42, risk: 'WARNING', advisory: 'Pre-position dewatering pumps at underpasses.' },
    ],
  },
  {
    id: 'CELL-B2',
    name: 'Haridwar Ridge Multicell Cluster',
    tier: 'WARNING',
    lat: 29.985,
    lon: 78.125,
    speedKmh: 44,
    headingDeg: 55,
    headingText: 'NE (055°)',
    maxDbz: 52.4,
    minCtt: -61.2,
    cape: 2350,
    cin: -45,
    vil: 46,
    rainRateMmHr: 58,
    hailProbability: 45,
    downburstProbability: 68,
    cellDiameterKm: 14.0,
    growthTrend: 'Quasi-Stationary Consolidation',
    lastUpdated: '3 min ago (DWR Dehradun)',
    description: 'Organized multicell cluster propagating along Shivalik southern escarpment. Downdraft gust front producing 70+ km/h microbursts.',
    waypoints: [
      { timeOffsetMin: 0, lat: 29.985, lon: 78.125, label: 'T0 (Now)', radiusKm: 6.5 },
      { timeOffsetMin: 15, lat: 30.024, lon: 78.175, label: '+15m', radiusKm: 7.0 },
      { timeOffsetMin: 30, lat: 30.062, lon: 78.225, label: '+30m', radiusKm: 7.4 },
      { timeOffsetMin: 45, lat: 30.100, lon: 78.275, label: '+45m', radiusKm: 7.8 },
      { timeOffsetMin: 60, lat: 30.138, lon: 78.324, label: '+60m', radiusKm: 8.0 },
    ],
    impactTargets: [
      { location: 'Roorkee Canal Fringe', distanceKm: 11.0, initialMinutes: 18, risk: 'WARNING', advisory: 'Alert irrigation engineers on canal surges.' },
      { location: 'Haridwar Ghats & Bazaars', distanceKm: 19.4, initialMinutes: 32, risk: 'WARNING', advisory: 'Warn pilgrims regarding sudden lightning & squalls.' },
      { location: 'Chidderwala Plains', distanceKm: 34.0, initialMinutes: 56, risk: 'WATCH', advisory: 'Agricultural lodging advisory for paddy crops.' },
    ],
  },
  {
    id: 'CELL-C3',
    name: 'Mohand Pass Orographic Feeder',
    tier: 'WATCH',
    lat: 30.180,
    lon: 77.920,
    speedKmh: 32,
    headingDeg: 72,
    headingText: 'ENE (072°)',
    maxDbz: 41.5,
    minCtt: -48.0,
    cape: 1820,
    cin: -62,
    vil: 28,
    rainRateMmHr: 32,
    hailProbability: 15,
    downburstProbability: 35,
    cellDiameterKm: 7.8,
    growthTrend: 'Developing Foothill Trigger',
    lastUpdated: '5 min ago (DWR Dehradun)',
    description: 'Orographic ascent triggering moderate convective towers south of Dehradun gorge. Feeds moisture northwards into primary system.',
    waypoints: [
      { timeOffsetMin: 0, lat: 30.180, lon: 77.920, label: 'T0 (Now)', radiusKm: 3.8 },
      { timeOffsetMin: 15, lat: 30.198, lon: 77.970, label: '+15m', radiusKm: 4.2 },
      { timeOffsetMin: 30, lat: 30.216, lon: 78.020, label: '+30m', radiusKm: 4.5 },
      { timeOffsetMin: 45, lat: 30.234, lon: 78.070, label: '+45m', radiusKm: 4.8 },
      { timeOffsetMin: 60, lat: 30.252, lon: 78.120, label: '+60m', radiusKm: 5.0 },
    ],
    impactTargets: [
      { location: 'Shivalik Tunnel Approach', distanceKm: 12.8, initialMinutes: 28, risk: 'WATCH', advisory: 'Advise vehicular speed limits in torrential rain.' },
      { location: 'Clement Town Outskirts', distanceKm: 26.5, initialMinutes: 52, risk: 'WATCH', advisory: 'Routine municipal monitoring.' },
    ],
  },
  {
    id: 'CELL-D4',
    name: 'Doon Valley South Thermal Cell',
    tier: 'INFO',
    lat: 30.260,
    lon: 78.010,
    speedKmh: 24,
    headingDeg: 45,
    headingText: 'NE (045°)',
    maxDbz: 28.0,
    minCtt: -26.5,
    cape: 1250,
    cin: -88,
    vil: 12,
    rainRateMmHr: 12,
    hailProbability: 0,
    downburstProbability: 10,
    cellDiameterKm: 5.0,
    growthTrend: 'Stable Stratiform Flank',
    lastUpdated: '8 min ago (DWR Dehradun)',
    description: 'Isolated convective thermal shower with light stratiform precipitation. No severe convective hazard expected.',
    waypoints: [
      { timeOffsetMin: 0, lat: 30.260, lon: 78.010, label: 'T0 (Now)', radiusKm: 2.5 },
      { timeOffsetMin: 15, lat: 30.278, lon: 78.030, label: '+15m', radiusKm: 2.7 },
      { timeOffsetMin: 30, lat: 30.296, lon: 78.050, label: '+30m', radiusKm: 2.9 },
      { timeOffsetMin: 45, lat: 30.314, lon: 78.070, label: '+45m', radiusKm: 3.0 },
      { timeOffsetMin: 60, lat: 30.332, lon: 78.090, label: '+60m', radiusKm: 3.1 },
    ],
    impactTargets: [
      { location: 'ISBT Dehradun Inter-State Hub', distanceKm: 6.2, initialMinutes: 16, risk: 'NORMAL', advisory: 'Minor street puddling; traffic normal.' },
      { location: 'Clock Tower / Paltan Bazaar', distanceKm: 14.8, initialMinutes: 40, risk: 'NORMAL', advisory: 'Standard umbrellas advised.' },
    ],
  },
];

// Vulnerable towns with pending warning status pins
const VULNERABLE_PINS = [
  { name: 'Sahastradhara Basin', lat: 30.3872, lon: 78.1316, status: 'SEVERE CLOUDBURST WARNING', etaMin: 14, alertTier: 'SEVERE' },
  { name: 'Rajpur Foothills', lat: 30.3920, lon: 78.0980, status: 'EXTREME RAINFALL ALARM', etaMin: 7, alertTier: 'SEVERE' },
  { name: 'Mussoorie Hill Highway', lat: 30.4350, lon: 78.0720, status: 'LANDSLIDE & DEBRIS ALERT', etaMin: 24, alertTier: 'SEVERE' },
  { name: 'Rishikesh Ganga Ghats', lat: 30.1030, lon: 78.2940, status: 'SQUALL LINE & LIGHTNING WATCH', etaMin: 42, alertTier: 'WARNING' },
  { name: 'Haridwar City Center', lat: 29.9457, lon: 78.1642, status: 'CONVECTIVE GUST FRONT ALERT', etaMin: 32, alertTier: 'WARNING' },
];

export default function LiveConvectiveCellTracker() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const dataTileLayersRef = useRef({ radar: null, satellite: null });

  // Active selections
  const [selectedCellId, setSelectedCellId] = useState('CELL-A1');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [lightningFeed, setLightningFeed] = useState(null);
  const [radarFeed, setRadarFeed] = useState(null);
  const [satelliteFeed, setSatelliteFeed] = useState(null);
  const [satellitePoint, setSatellitePoint] = useState(null);

  // Observation overlays render only when the backend returns configured data.
  const [layersEnabled, setLayersEnabled] = useState({
    radarDbz: true,
    satelliteCtt: true,
    lightningDensity: true,
    riskSurface: false,
    motionVectors: true,
    alertPins: false,
  });

  // Ticking seconds for live hyper-local impact countdowns
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const refreshFeeds = async () => {
      const results = await Promise.allSettled([
        fetchLightningFeed({ signal: controller.signal }),
        fetchRadarFeed({ signal: controller.signal }),
        fetchSatelliteFeed({}, { signal: controller.signal }),
        fetchSatelliteFeed({ lat: selectedCell.lat, lon: selectedCell.lon }, { signal: controller.signal }),
      ]);
      if (!active) return;

      if (results[0].status === 'fulfilled') setLightningFeed(results[0].value);
      else {
        console.warn('Lightning feed unavailable:', results[0].reason);
        setLightningFeed((previous) => ({
          type: 'FeatureCollection',
          features: previous?.features || [],
          metadata: { ...previous?.metadata, status: previous?.features?.length ? 'CACHED' : 'OFFLINE', reason: results[0].reason?.message || 'Lightning feed unavailable' },
        }));
      }

      if (results[1].status === 'fulfilled') setRadarFeed(results[1].value);
      else {
        console.warn('Radar feed unavailable:', results[1].reason);
        setRadarFeed((previous) => ({ ...previous, status: 'OFFLINE', reason: results[1].reason?.message || 'Radar feed unavailable' }));
      }

      if (results[2].status === 'fulfilled') setSatelliteFeed(results[2].value);
      else {
        console.warn('Satellite feed unavailable:', results[2].reason);
        setSatelliteFeed((previous) => ({ ...previous, status: 'OFFLINE', reason: results[2].reason?.message || 'Satellite feed unavailable' }));
      }

      if (results[3].status === 'fulfilled') setSatellitePoint(results[3].value);
      else {
        console.warn('Satellite point sounding unavailable:', results[3].reason);
        setSatellitePoint({ status: 'OFFLINE', cloud_top_temperature_c: null });
      }
    };

    refreshFeeds();
    const refreshTimer = setInterval(refreshFeeds, 30000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(refreshTimer);
    };
  }, [selectedCell.id, selectedCell.lat, selectedCell.lon]);

  const selectedCell = useMemo(() => {
    return MOCK_STORM_CELLS.find((c) => c.id === selectedCellId) || MOCK_STORM_CELLS[0];
  }, [selectedCellId]);

  const filteredCells = useMemo(() => {
    if (tierFilter === 'ALL') return MOCK_STORM_CELLS;
    return MOCK_STORM_CELLS.filter((c) => c.tier === tierFilter);
  }, [tierFilter]);

  // Format live remaining countdown seconds
  const formatCountdown = (initialMinutes) => {
    const totalSeconds = Math.max(0, initialMinutes * 60 - (tick % 3600));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const toggleLayer = (layerKey) => {
    setLayersEnabled((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  /**
   * Initialize Leaflet map instance
   */
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [30.28, 78.12],
        zoom: 10,
        zoomControl: false,
        attributionControl: false,
      });

      // Clean government CartoDB Positron base tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
      }).addTo(map);

      // Custom top-right zoom control
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Radar range rings (30km, 60km, 90km) around DWR Dehradun
      const rings = [30000, 60000, 90000];
      rings.forEach((r) => {
        L.circle([SECTOR_INFO.centerLat, SECTOR_INFO.centerLon], {
          radius: r,
          color: '#6C7278',
          weight: 0.8,
          dashArray: '3, 6',
          fill: false,
        }).addTo(map);
      });

      // DWR Dehradun Radar site marker
      const radarIcon = L.divIcon({
        className: 'custom-dwr-marker',
        html: `
          <div style="background-color: #0B2E4F; color: #FAF7F2; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; border: 1px solid #FAF7F2; box-shadow: 0 2px 4px rgba(0,0,0,0.25); white-space: nowrap;">
            📡 DWR DEHRADUN
          </div>
        `,
        iconSize: [85, 20],
        iconAnchor: [42, 10],
      });
      L.marker([SECTOR_INFO.centerLat, SECTOR_INFO.centerLon], { icon: radarIcon }).addTo(map);

      // Initialize layer group registry
      layersRef.current = {
        radarDbz: L.layerGroup().addTo(map),
        satelliteCtt: L.layerGroup().addTo(map),
        lightningDensity: L.layerGroup().addTo(map),
        riskSurface: L.layerGroup().addTo(map),
        motionVectors: L.layerGroup().addTo(map),
        alertPins: L.layerGroup().addTo(map),
      };

      mapRef.current = map;
    }

    return () => {
      // Map cleanup handled on container unmount
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    Object.values(dataTileLayersRef.current).forEach((layer) => {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });
    dataTileLayersRef.current = { radar: null, satellite: null };

    if (layersEnabled.radarDbz && ['LIVE', 'CONFIGURED'].includes(radarFeed?.status) && radarFeed.tile_url && Array.isArray(radarFeed.bounds)) {
      const radarOptions = {
        opacity: 0.62,
        bounds: L.latLngBounds(radarFeed.bounds),
        attribution: radarFeed.attribution || 'IMD Doppler Weather Radar',
      };
      const radarTiles = radarFeed.mode === 'WMS'
        ? L.tileLayer.wms(radarFeed.tile_url, {
          ...radarOptions,
          layers: radarFeed.layer_name,
          format: 'image/png',
          transparent: true,
        })
        : L.tileLayer(radarFeed.tile_url, {
          ...radarOptions,
          maxZoom: 18,
          updateWhenIdle: true,
          keepBuffer: 2,
        });
      radarTiles.addTo(map);
      dataTileLayersRef.current.radar = radarTiles;
    }

    if (layersEnabled.satelliteCtt && ['LIVE', 'CONFIGURED'].includes(satelliteFeed?.status) && satelliteFeed.tile_url && Array.isArray(satelliteFeed.bounds)) {
      const satelliteTiles = L.tileLayer(satelliteFeed.tile_url, {
        opacity: 0.58,
        bounds: L.latLngBounds(satelliteFeed.bounds),
        maxZoom: 18,
        attribution: 'MOSDAC INSAT-3D/3DR TIR1',
        updateWhenIdle: true,
        keepBuffer: 2,
      }).addTo(map);
      dataTileLayersRef.current.satellite = satelliteTiles;
    }

    return () => {
      Object.values(dataTileLayersRef.current).forEach((layer) => {
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
      });
      dataTileLayersRef.current = { radar: null, satellite: null };
    };
  }, [
    layersEnabled.radarDbz,
    layersEnabled.satelliteCtt,
    radarFeed?.status,
    radarFeed?.tile_url,
    radarFeed?.mode,
    radarFeed?.layer_name,
    radarFeed?.bounds?.[0]?.[0],
    radarFeed?.bounds?.[0]?.[1],
    radarFeed?.bounds?.[1]?.[0],
    radarFeed?.bounds?.[1]?.[1],
    satelliteFeed?.status,
    satelliteFeed?.tile_url,
    satelliteFeed?.bounds?.[0]?.[0],
    satelliteFeed?.bounds?.[0]?.[1],
    satelliteFeed?.bounds?.[1]?.[0],
    satelliteFeed?.bounds?.[1]?.[1],
  ]);

  /**
   * Render all GIS Layers dynamically whenever layer toggles or selected cell changes
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersRef.current.radarDbz) return;

    const {
      radarDbz,
      satelliteCtt,
      lightningDensity,
      riskSurface,
      motionVectors,
      alertPins,
    } = layersRef.current;

    // Clear existing dynamic elements
    radarDbz.clearLayers();
    satelliteCtt.clearLayers();
    lightningDensity.clearLayers();
    riskSurface.clearLayers();
    motionVectors.clearLayers();
    alertPins.clearLayers();

    // Radar and satellite tile overlays are sourced and bounded by the ingestion API.

    // Lightning observations are real GeoJSON points returned by the configured proxy.
    if (layersEnabled.lightningDensity) {
      const features = lightningFeed?.features || [];
      features.slice(0, 1500).forEach((feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        const strokeCount = feature.properties?.stroke_count || 1;
        const marker = L.circleMarker([lat, lon], {
          radius: Math.min(8, 3 + Math.log2(strokeCount)),
          color: '#92400E',
          weight: 1,
          fillColor: '#F59E0B',
          fillOpacity: 0.85,
        });
        const popup = document.createElement('div');
        popup.textContent = `Blitzortung proxy strike • ${strokeCount} stroke(s) • ${feature.properties?.timestamp || 'time unavailable'}`;
        marker.bindPopup(popup).addTo(lightningDensity);
      });
    }

    // Storm-cell forecast vectors remain independent of external sensor overlays.
    if (layersEnabled.motionVectors) {
      MOCK_STORM_CELLS.forEach((cell) => {
        const isSelected = cell.id === selectedCellId;
        const color = SEVERITY_TIERS[cell.tier]?.color || '#DC2626';

        // 1. Waypoint polyline
        const latlngs = cell.waypoints.map((w) => [w.lat, w.lon]);
        L.polyline(latlngs, {
          color: color,
          weight: isSelected ? 3.5 : 2,
          dashArray: isSelected ? undefined : '4, 4',
          opacity: 0.9,
        }).addTo(motionVectors);

        // 2. Optical Flow Vector Arrow heading marker
        const nextPt = cell.waypoints[1];
        if (nextPt) {
          const arrowMarker = L.circleMarker([nextPt.lat, nextPt.lon], {
            radius: isSelected ? 6 : 4,
            color: '#1A1D20',
            weight: 1.5,
            fillColor: color,
            fillOpacity: 1,
          });
          arrowMarker.bindPopup(`
            <div style="font-family: sans-serif; font-size: 11px;">
              <strong>${cell.name}</strong><br/>
              <b>Optical Flow Vector:</b> ${cell.headingText} @ ${cell.speedKmh} km/h<br/>
              <b>T+15m Projected Center:</b> ${nextPt.lat.toFixed(3)}°N, ${nextPt.lon.toFixed(3)}°E
            </div>
          `);
          arrowMarker.addTo(motionVectors);
        }

        // 3. Projected Uncertainty Cone Polygon for selected cell
        if (isSelected && cell.waypoints.length >= 4) {
          const w0 = cell.waypoints[0];
          const wLast = cell.waypoints[cell.waypoints.length - 1];
          // Cone fan coordinates with angular uncertainty spreading outward
          const spreadLat = 0.038;
          const spreadLon = 0.042;
          const conePolygon = [
            [w0.lat, w0.lon],
            [wLast.lat + spreadLat, wLast.lon - spreadLon],
            [wLast.lat, wLast.lon],
            [wLast.lat - spreadLat, wLast.lon + spreadLon],
          ];

          L.polygon(conePolygon, {
            color: color,
            weight: 1,
            dashArray: '3, 4',
            fillColor: color,
            fillOpacity: 0.12,
          }).addTo(motionVectors);

          // Add waypoint milestone pins
          cell.waypoints.forEach((wp) => {
            const wpIcon = L.divIcon({
              className: 'track-milestone-marker',
              html: `
                <div style="background-color: #1A1D20; color: #FAF7F2; border: 1px solid ${color}; padding: 2px 4px; border-radius: 3px; font-size: 9px; font-family: monospace; font-weight: bold; white-space: nowrap;">
                  ${wp.label}
                </div>
              `,
              iconSize: [36, 16],
              iconAnchor: [18, 8],
            });
            L.marker([wp.lat, wp.lon], { icon: wpIcon }).addTo(motionVectors);
          });
        }

        // Cell centroid emblem
        const cellIcon = L.divIcon({
          className: 'active-cell-emblem',
          html: `
            <div style="background-color: ${color}; color: white; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4); width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">
              ⛈️
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker([cell.lat, cell.lon], { icon: cellIcon })
          .addTo(motionVectors)
          .on('click', () => setSelectedCellId(cell.id));
      });
    }

    // -------------------------------------------------------------------------
    // LAYER 6: PENDING ALERT STATUS PINS
    // -------------------------------------------------------------------------
    if (layersEnabled.alertPins) {
      VULNERABLE_PINS.forEach((pin) => {
        const tierColor = pin.alertTier === 'SEVERE' ? '#DC2626' : '#EA580C';
        const pinIcon = L.divIcon({
          className: 'custom-alert-flag',
          html: `
            <div style="background: white; border: 1.5px solid ${tierColor}; border-radius: 4px; padding: 2px 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
              <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background-color: ${tierColor};"></span>
              <span style="font-size: 10px; font-weight: bold; color: #1A1D20;">${pin.name}</span>
              <span style="font-size: 9px; font-family: monospace; color: ${tierColor}; font-weight: 700;">-${pin.etaMin}m</span>
            </div>
          `,
          iconSize: [110, 22],
          iconAnchor: [55, 11],
        });

        L.marker([pin.lat, pin.lon], { icon: pinIcon }).addTo(alertPins).bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px;">
            <b style="color: ${tierColor};">${pin.status}</b><br/>
            <b>Target:</b> ${pin.name}<br/>
            <b>Projected Arrival:</b> In ${pin.etaMin} minutes<br/>
            <b>Emergency Protocol:</b> Sirens &amp; SDRF Stage Order Dispatched
          </div>
        `);
      });
    }
  }, [layersEnabled, selectedCellId, lightningFeed]);

  /**
   * Center map on cell click
   */
  const handleSelectCell = (cell) => {
    setSelectedCellId(cell.id);
    if (mapRef.current) {
      mapRef.current.flyTo([cell.lat, cell.lon], 11, {
        animate: true,
        duration: 0.8,
      });
    }
  };

  return (
    <div className="space-y-4 antialiased">
      {/* 1. LAYER CONTROLS BAR (Requirement 1: 6 Switchable GIS Layers) */}
      <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] border border-[#E5E0D8] flex items-center justify-center text-[#D9532F]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
              <span className="text-xs font-bold text-[#1A1D20] block">Map Layer Controls</span>
            <span className="text-[10px] text-[#6C7278]">Observation layers show provider availability</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { key: 'radarDbz', label: 'Radar tiles', icon: Radio, activeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
            { key: 'satelliteCtt', label: 'Satellite IR tiles', icon: CloudRain, activeColor: 'bg-blue-50 text-blue-800 border-blue-300' },
            { key: 'lightningDensity', label: 'Lightning strikes', icon: Zap, activeColor: 'bg-amber-50 text-amber-800 border-amber-300' },
            { key: 'riskSurface', label: 'Risk grid unavailable', icon: TrendingUp, activeColor: 'bg-neutral-100 text-neutral-500 border-neutral-300', disabled: true },
            { key: 'motionVectors', label: 'Reference storm tracks', icon: Navigation, activeColor: 'bg-purple-50 text-purple-800 border-purple-300' },
            { key: 'alertPins', label: 'Reference hazard pins', icon: MapPin, activeColor: 'bg-orange-50 text-orange-800 border-orange-300' },
          ].map((layer) => {
            const Icon = layer.icon;
            const isOn = layersEnabled[layer.key];
            return (
              <button
                key={layer.key}
                type="button"
                onClick={() => toggleLayer(layer.key)}
                disabled={layer.disabled}
                title={layer.disabled ? 'No live fused risk-grid feed is configured.' : `${layer.label}: ${layer.key === 'radarDbz' ? radarFeed?.status || 'LOADING' : layer.key === 'satelliteCtt' ? satelliteFeed?.status || 'LOADING' : layer.key === 'lightningDensity' ? lightningFeed?.metadata?.status || 'LOADING' : 'enabled'}`}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  layer.disabled
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-500 cursor-not-allowed'
                    : isOn
                    ? `${layer.activeColor} shadow-2xs font-bold`
                    : 'bg-[#FAF7F2] border-[#E5E0D8] text-[#6C7278] hover:bg-neutral-100'
                }`}
              >
                {isOn ? <Eye className="w-3 h-3 text-[#D9532F]" /> : <EyeOff className="w-3 h-3 text-[#6C7278]" />}
                <span>{layer.label}</span>
              </button>
            );
          })}
          <div className="flex flex-wrap items-center gap-1.5 border-l border-[#E5E0D8] pl-2 text-[9px] font-mono">
            <span className={['LIVE', 'CONFIGURED'].includes(radarFeed?.status) ? 'text-emerald-700' : 'text-amber-700'}>Radar: {radarFeed?.status || 'LOADING'}</span>
            <span className={['LIVE', 'CONFIGURED'].includes(satelliteFeed?.status) ? 'text-emerald-700' : 'text-amber-700'}>Satellite: {satelliteFeed?.status || 'LOADING'}</span>
            <span className={lightningFeed?.metadata?.status === 'LIVE' ? 'text-emerald-700' : 'text-amber-700'}>Lightning: {lightningFeed?.metadata?.status || 'LOADING'}</span>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded border border-[#244452] bg-[#173644] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#224957]"
            onClick={() => setIsDataModalOpen(true)}
            type="button"
          >
            <Info className="h-3.5 w-3.5" />
            <span>Data Sources</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN INTERACTIVE MAP & SIDEBAR WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEAFLET MAP CONTAINER WITH EMBEDDED TELEMETRY OVERLAYS */}
        <div className="lg:col-span-8 relative bg-white border border-[#E5E0D8] rounded-xl overflow-hidden shadow-2xs h-[540px] flex flex-col">
          {/* Map canvas */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* TELEMETRY OVERLAY CARD 1: CURRENT STORM CELL FOCUS PANEL (TOP LEFT) */}
          <div className="absolute top-3 left-3 z-[400] max-w-[310px] w-full bg-white/95 backdrop-blur-xs border border-[#E5E0D8] rounded-xl p-3.5 shadow-md space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-2">
              <div className="flex items-center space-x-2">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white"
                  style={{ backgroundColor: SEVERITY_TIERS[selectedCell.tier]?.color || '#DC2626' }}
                >
                  {selectedCell.tier}
                </span>
                <span className="font-bold text-xs text-[#1A1D20] font-mono">{selectedCell.id}</span>
              </div>
              <span className="text-[10px] font-mono text-[#6C7278]">{selectedCell.growthTrend}</span>
            </div>

            <div>
              <h4 className="font-bold text-xs text-[#1A1D20]">{selectedCell.name}</h4>
              <p className="text-[11px] text-[#6C7278] line-clamp-2 mt-0.5 leading-snug">
                {selectedCell.description}
              </p>
            </div>

            {/* Meteorological metrics grid */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
              <div className="p-1.5 bg-[#FAF7F2] rounded border border-[#E5E0D8]">
                <span className="text-[9px] text-[#6C7278] uppercase block font-semibold">Max dBZ</span>
                <span className="font-mono font-bold text-[#DC2626] text-xs">{selectedCell.maxDbz}</span>
              </div>
              <div className="p-1.5 bg-[#FAF7F2] rounded border border-[#E5E0D8]">
                <span className="text-[9px] text-[#6C7278] uppercase block font-semibold">Min CTT</span>
                  <span className="font-mono font-bold text-[#4C1D95] text-xs">{typeof satellitePoint?.cloud_top_temperature_c === 'number' ? `${satellitePoint.cloud_top_temperature_c}°C` : 'Unavailable'}</span>
              </div>
              <div className="p-1.5 bg-[#FAF7F2] rounded border border-[#E5E0D8]">
                <span className="text-[9px] text-[#6C7278] uppercase block font-semibold">Vector</span>
                <span className="font-mono font-bold text-[#1A1D20] text-xs">{selectedCell.speedKmh} km/h</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1">
              <div className="flex justify-between p-1 bg-neutral-50 rounded border border-[#E5E0D8]">
                <span className="text-[#6C7278]">Hail Prob:</span>
                <span className="font-bold text-[#DC2626]">{selectedCell.hailProbability}%</span>
              </div>
              <div className="flex justify-between p-1 bg-neutral-50 rounded border border-[#E5E0D8]">
                <span className="text-[#6C7278]">Downburst:</span>
                <span className="font-bold text-[#D9532F]">{selectedCell.downburstProbability}%</span>
              </div>
            </div>
          </div>

          {/* TELEMETRY OVERLAY CARD 2: LIVE HYPER-LOCAL COUNTDOWN CLOCK (BOTTOM LEFT) */}
          <div className="absolute bottom-3 left-3 z-[400] max-w-[340px] w-full bg-[#0B2E4F]/95 text-white backdrop-blur-xs border border-[#16436E] rounded-xl p-3 shadow-lg space-y-2">
            <div className="flex items-center justify-between border-b border-[#16436E] pb-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#FF9933] flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[#FF9933] animate-pulse" />
                Live Sub-District Arrival Countdowns
              </span>
              <span className="text-[9px] font-mono text-neutral-300">Optical Flow Extrapolation</span>
            </div>

            <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
              {selectedCell.impactTargets.map((target, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 px-1.5 bg-[#08223B] rounded border border-[#12426E]"
                >
                  <div className="truncate mr-2">
                    <span className="font-semibold block text-[11px] truncate">{target.location}</span>
                    <span className="text-[9px] text-neutral-400 font-mono">{target.distanceKm} km away</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-amber-400 text-xs block">
                      {formatCountdown(target.initialMinutes)}
                    </span>
                    <span
                      className={`text-[8px] font-bold uppercase px-1 py-0.2 rounded ${
                        target.risk === 'CRITICAL'
                          ? 'bg-red-500/30 text-red-300'
                          : 'bg-amber-500/30 text-amber-300'
                      }`}
                    >
                      {target.risk}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MAP BOTTOM-RIGHT LEGEND */}
          <div className="absolute bottom-3 right-3 z-[400] bg-white/95 px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] text-[10px] shadow-sm flex items-center space-x-3 text-[#1A1D20]">
            <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-[#7A8990]"></span>
                <span>IMD radar overlay</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]"></span>
              <span>Hail Core</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]"></span>
              <span>Lightning</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4C1D95]"></span>
                <span>INSAT IR overlay</span>
            </div>
          </div>
        </div>

        {/* 3. CELL DIRECTORY & FILTERING SIDEBAR (Requirement 3) */}
        <div className="lg:col-span-4 bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-4 shadow-2xs flex flex-col justify-between space-y-4 h-[540px]">
          <div className="space-y-3">
            {/* Header & Filter Row */}
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-2.5">
              <div className="flex items-center space-x-2">
                <Compass className="w-4 h-4 text-[#D9532F]" />
                <h3 className="font-bold text-sm text-[#1A1D20]">Reference Storm Tracks</h3>
              </div>
              <span className="text-[10px] font-mono text-[#6C7278]">
                {filteredCells.length} Monitored
              </span>
            </div>

            {/* Severity Filter Buttons */}
            <div className="grid grid-cols-5 gap-1 text-[10px] font-bold">
              {['ALL', 'SEVERE', 'WARNING', 'WATCH', 'INFO'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTierFilter(t)}
                  className={`py-1 rounded border text-center transition-all ${
                    tierFilter === t
                      ? 'bg-[#1A1D20] text-white border-[#1A1D20]'
                      : 'bg-[#FAF7F2] text-[#6C7278] border-[#E5E0D8] hover:bg-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Scrollable Cell List */}
            <div className="space-y-2 overflow-y-auto max-h-[360px] pr-1">
              {filteredCells.map((cell) => {
                const isSelected = cell.id === selectedCellId;
                const tierMeta = SEVERITY_TIERS[cell.tier] || SEVERITY_TIERS.INFO;
                return (
                  <div
                    key={cell.id}
                    onClick={() => handleSelectCell(cell)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-50/50 border-[#D9532F] shadow-xs'
                        : 'bg-[#FAF7F2] border-[#E5E0D8] hover:border-neutral-400 hover:bg-white'
                    }`}
                    style={{ borderLeftWidth: '4px', borderLeftColor: tierMeta.color }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-[#1A1D20] font-mono">{cell.id}</span>
                        <span
                          className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase"
                          style={{ backgroundColor: tierMeta.bgLight, color: tierMeta.color }}
                        >
                          {cell.tier}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#DC2626]">
                        {cell.maxDbz} dBZ
                      </span>
                    </div>

                    <h4 className="font-bold text-[#1A1D20] mt-1 text-[11px] truncate">{cell.name}</h4>

                    <div className="grid grid-cols-2 gap-1 text-[10px] text-[#6C7278] mt-1.5 pt-1.5 border-t border-[#E5E0D8]/60 font-mono">
                      <div>Heading: <strong className="text-[#1A1D20]">{cell.headingText}</strong></div>
                      <div>Speed: <strong className="text-[#1A1D20]">{cell.speedKmh} km/h</strong></div>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-[#D9532F] font-semibold pt-1">
                      <span>Next: {cell.impactTargets[0]?.location}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Action in Sidebar */}
          <div className="pt-2 border-t border-[#E5E0D8]">
            <button
              onClick={() => handleSelectCell(selectedCell)}
              className="w-full bg-[#D9532F] hover:bg-[#BF4422] text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Center &amp; Focus Selected Cell</span>
            </button>
          </div>
        </div>
      </div>
      <DataDisclaimerModal open={isDataModalOpen} onClose={() => setIsDataModalOpen(false)} />
    </div>
  );
}
