/**
 * @file SectorMap.jsx
 * @description Leaflet map visualizing Doppler radar sector coverage, storm core tracking,
 * and real-time lightning strike coordinates for VayuGati Nowcast.
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { SECTOR_INFO } from '../utils/mockDataSeed';

export default function SectorMap({
  lightningStrikes = [],
  activeTier = 'SEVERE',
}: {
  lightningStrikes?: any[];
  activeTier?: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Prevent duplicate map initialization
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [SECTOR_INFO.centerLat, SECTOR_INFO.centerLon],
        zoom: 10,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      // CartoDB Positron / OpenStreetMap base tiles for clean government styling
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // 120 km radar coverage circle
      L.circle([SECTOR_INFO.centerLat, SECTOR_INFO.centerLon], {
        radius: 45000, // 45 km inner convective zone
        color: '#D9532F',
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: '#D9532F',
        fillOpacity: 0.05,
      }).addTo(map).bindPopup('<b>DWR Dehradun Primary Convective Zone (45 km)</b>');

      // Radar site marker
      const radarIcon = L.divIcon({
        className: 'radar-site-marker',
        html: `
          <div style="background-color: #1A1D20; color: #FAF7F2; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; border: 1px solid #FAF7F2; box-shadow: 0 2px 4px rgba(0,0,0,0.2); white-space: nowrap;">
            📡 DWR Dehradun
          </div>
        `,
        iconSize: [90, 24],
        iconAnchor: [45, 12],
      });

      L.marker([SECTOR_INFO.centerLat, SECTOR_INFO.centerLon], { icon: radarIcon })
        .addTo(map)
        .bindPopup(`<b>${SECTOR_INFO.radarStation}</b><br/>Elevation: ${SECTOR_INFO.elevationMeters}m MSL`);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;
    }

    // Update dynamic strike markers & storm centroid
    const currentLayerGroup = layerGroupRef.current;
    if (currentLayerGroup) {
      currentLayerGroup.clearLayers();

      // Plot active convective core centroid
      const coreMarker = L.circle([SECTOR_INFO.centerLat + 0.045, SECTOR_INFO.centerLon + 0.06], {
        radius: 8500,
        color: '#DC2626',
        weight: 2,
        fillColor: '#DC2626',
        fillOpacity: 0.28,
      });
      coreMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px;">
          <strong style="color: #DC2626;">⛈️ Convective Core #A1 (63.8 dBZ)</strong><br/>
          <strong>Hazard:</strong> Cloudburst & Hail Core<br/>
          <strong>Motion:</strong> 065° at 38 km/h (ENE)<br/>
          <strong>Rainfall Rate:</strong> 118 mm/hr
        </div>
      `);
      currentLayerGroup.addLayer(coreMarker);

      // Plot lightning strikes
      lightningStrikes.slice(0, 18).forEach((strike) => {
        const isSevere = strike.peakCurrentKa > 50;
        const circle = L.circleMarker([strike.lat, strike.lon], {
          radius: isSevere ? 5 : 3.5,
          color: strike.type === 'IC' ? '#D97706' : '#DC2626',
          weight: 1,
          fillColor: strike.type === 'IC' ? '#FBBF24' : '#EF4444',
          fillOpacity: 0.85,
        });
        circle.bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px;">
            <strong>${strike.polarity} Lightning Flash</strong><br/>
            Type: ${strike.type === 'IC' ? 'Intra-Cloud (IC)' : 'Cloud-to-Ground (CG)'}<br/>
            Peak Current: ${strike.peakCurrentKa} kA<br/>
            Altitude: ${strike.elevationKm} km
          </div>
        `);
        currentLayerGroup.addLayer(circle);
      });
    }

    return () => {
      // Map cleanup on unmount
    };
  }, [lightningStrikes, activeTier]);

  return (
    <div className="relative w-full h-[320px] rounded-lg border border-[#E5E0D8] overflow-hidden bg-[#FFFFFF]">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 z-[400] bg-white/95 px-2.5 py-1.5 rounded border border-[#E5E0D8] text-[11px] shadow-sm flex items-center space-x-3 text-[#1A1D20]">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] inline-block"></span>
          <span className="font-medium">Cloudburst Core</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FBBF24] inline-block"></span>
          <span>Lightning IC</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-[#EF4444] inline-block"></span>
          <span>Lightning CG</span>
        </div>
      </div>
    </div>
  );
}
