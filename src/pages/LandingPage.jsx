import React, { useEffect, useState } from 'react';
import DataDisclaimerModal from '../components/DataDisclaimerModal';
import { fetchInstabilityIndex, fetchLightningFeed, fetchRadarFeed, fetchSatelliteFeed } from '../lib/apiClient';
import {
  ShieldAlert,
  Radio,
  Zap,
  CloudRain,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  Layers,
  MapPin,
  TrendingUp,
} from 'lucide-react';

export default function LandingPage({ onOpenLogin }) {
  const [radarFeed, setRadarFeed] = useState(null);
  const [satelliteFeed, setSatelliteFeed] = useState(null);
  const [lightningFeed, setLightningFeed] = useState(null);
  const [nwpData, setNwpData] = useState(null);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refreshPublicFeeds = async () => {
      const results = await Promise.allSettled([
        fetchRadarFeed({ signal: controller.signal }),
        fetchSatelliteFeed({}, { signal: controller.signal }),
        fetchLightningFeed({ signal: controller.signal }),
        fetchInstabilityIndex({ lat: 30.3165, lon: 78.0322, signal: controller.signal }),
      ]);
      if (!active) return;
      setRadarFeed(results[0].status === 'fulfilled' ? results[0].value : { status: 'OFFLINE' });
      setSatelliteFeed(results[1].status === 'fulfilled' ? results[1].value : { status: 'OFFLINE' });
      setLightningFeed(results[2].status === 'fulfilled' ? results[2].value : { type: 'FeatureCollection', features: [], metadata: { status: 'OFFLINE' } });
      setNwpData(results[3].status === 'fulfilled' ? results[3].value : null);
      results.forEach((result, index) => {
        if (result.status === 'rejected') console.warn(`Public observation feed ${index + 1} unavailable:`, result.reason);
      });
    };
    refreshPublicFeeds();
    const refreshTimer = setInterval(refreshPublicFeeds, 60000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(refreshTimer);
    };
  }, []);

  // Public INFO-tier and active advisories
  const publicAdvisories = [
    {
      id: 'ADV-01',
      tier: 'INFO',
      region: 'Dehradun & Rishikesh Foothills',
      title: 'Monsoon Orographic Updraft Advisory',
      status: 'Advisory Active',
      timeWindow: 'Valid for next 6 Hours',
      description:
        'Atmospheric moisture loading remains high (PWAT > 60 mm). Intermittent moderate-to-heavy convective showers expected along southern Himalayan slopes. River discharge levels normal.',
      safetyTip: 'Avoid pitching riverside campsites and monitor local municipal sirens.',
    },
    {
      id: 'ADV-02',
      tier: 'WATCH',
      region: 'Haridwar – Roorkee Corridor',
      title: 'Thunderstorm & Squall Watch',
      status: 'Watch Active',
      timeWindow: 'Lead time: 2 – 4 Hours',
      description:
        'Doppler radar detects cell consolidation moving East-Northeast at 38 km/h. Gusty surface winds reaching 50–70 km/h possible during convective passage.',
      safetyTip: 'Secure unanchored temporary tin roofing and park vehicles away from old trees.',
    },
    {
      id: 'ADV-03',
      tier: 'INFO',
      region: 'Upper Gangetic Transition Zone',
      title: 'General Convective Outlook',
      status: 'Normal Monitoring',
      timeWindow: 'Valid 0-12 Hours',
      description:
        'Continuous Doppler scanning operational. No severe cloudburst thresholds breached in plain sectors. Standard agricultural operations may proceed with awareness.',
      safetyTip: 'Keep battery-powered transistor radios handy in rural zones.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1A1D20] flex flex-col antialiased">
      {/* 1. HERO SECTION */}
      <section className="bg-[#FFFFFF] border-b border-[#E5E0D8] px-4 lg:px-8 py-8 lg:py-12">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Top Badge & Mission Indicator */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="bg-[#FAF7F2] border border-[#E5E0D8] text-[#1A1D20] px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#1E3A8A]"></span>
              Ministry of Earth Sciences - IMD
            </span>
          </div>

          {/* Main Headline */}
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#1A1D20] leading-tight">
              Severe weather,{' '}
              <span className="text-[#D9532F]">seen sooner.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#6C7278] leading-relaxed">
              Convective-scale nowcasts combine Doppler radar, INSAT imagery, lightning observations, and numerical weather guidance to support 0–6 hour warnings.
            </p>
          </div>

          {/* Action Callouts */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onOpenLogin}
              className="bg-[#D9532F] hover:bg-[#BF4422] text-white px-5 py-3 rounded-lg font-bold text-sm tracking-wide flex items-center space-x-2 transition-all shadow-sm cursor-pointer"
            >
              <span>ACCESS COMMAND PORTAL</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#advisories"
              className="bg-[#FAF7F2] hover:bg-[#E5E0D8] text-[#1A1D20] border border-[#E5E0D8] px-5 py-3 rounded-lg font-semibold text-sm transition-all"
            >
              View Public Safety Advisories
            </a>
          </div>

          {/* Real-Time Monitoring Stations Ticker */}
          <div className="pt-4 border-t border-[#E5E0D8] grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-xs">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-[#6C7278] block">Radar Composite</span>
              <span className="font-bold text-[#1A1D20] block">IMD DWR</span>
              <span className="text-[10px] text-[#6C7278] font-semibold">{radarFeed?.status || 'CONNECTING'}{radarFeed?.image_status ? ` • public image ${radarFeed.image_status.toLowerCase()}` : ''}</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-[#6C7278] block">Satellite Link</span>
              <span className="font-bold text-[#1A1D20] block">MOSDAC INSAT TIR1</span>
              <span className="text-[10px] text-[#6C7278] font-semibold">{satelliteFeed?.status || 'CONNECTING'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-[#6C7278] block">Lightning Proxy</span>
              <span className="font-bold text-[#1A1D20] block">Blitzortung</span>
              <span className="text-[10px] text-[#6C7278] font-semibold">{lightningFeed?.metadata?.status || 'CONNECTING'}{lightningFeed?.features ? ` • ${lightningFeed.features.length} points` : ''}</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-[#6C7278] block">NWP Model Grid</span>
              <span className="font-bold text-[#1A1D20] block">Open-Meteo GFS / ICON</span>
              <span className="text-[10px] text-[#6C7278] font-semibold">{nwpData?.metadata?.mode || 'OFFLINE'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. LIVE RADAR & TELEMETRY PREVIEW */}
      <section id="live-radar" className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#D9532F]">
              <Radio className="w-3.5 h-3.5" />
              <span>Real-Time Sensor Telemetry Preview</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1A1D20]">
              Pilot Sector: Dehradun – Western Himalayan Foothills
            </h2>
          </div>
          <button
            onClick={onOpenLogin}
            className="text-xs font-bold text-[#D9532F] hover:text-[#BF4422] flex items-center gap-1"
          >
            <span>Open Detailed Forecaster Tools</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsDataModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#315966] hover:text-[#173644]"
            type="button"
          >
            <Info className="h-3.5 w-3.5" />
            Data Sources
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Radar Reflectivity Preview Card */}
          <div className="lg:col-span-2 bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#1A1D20]">IMD Doppler Weather Radar</h3>
                <span className="text-xs text-[#6C7278]">
                  Feed state: {radarFeed?.status || 'CONNECTING'} • Image state: {radarFeed?.image_status || 'CHECKING'}
                </span>
              </div>
            </div>

            {radarFeed?.image_status === 'AVAILABLE' && radarFeed.image_url ? (
              <a href={radarFeed.image_url} rel="noreferrer" target="_blank" title="Open the public IMD radar image">
                <img alt="Public IMD radar image; image is not georeferenced for map overlay" className="max-h-[390px] w-full bg-[#F1F5F6] object-contain" loading="lazy" src={radarFeed.image_url} />
              </a>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 border border-dashed border-[#C9D5D8] bg-[#F5F8F8] px-6 text-center">
                <Radio className="h-7 w-7 text-[#56727A]" />
                <p className="text-sm font-semibold text-[#29434B]">Radar overlay unavailable</p>
                <p className="max-w-md text-xs leading-relaxed text-[#64777C]">A georeferenced IMD WMS/TMS layer is not configured. The public station GIF is image-only and will not be placed at guessed map coordinates.</p>
              </div>
            )}

            <p className="text-xs text-[#6C7278] leading-relaxed">
              {radarFeed?.mode === 'WMS' || radarFeed?.mode === 'XYZ_TMS_TILES'
                ? 'Configured georeferenced radar layer is available in the map tracker.'
                : 'Public source: IMD Mausam radar imagery. Reflectivity values are not inferred from this display image.'}
            </p>
          </div>

          {/* Live Sensor Metrics Snapshot */}
          <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 space-y-4 shadow-2xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-[#E5E0D8] pb-3">
                <h3 className="font-bold text-sm text-[#1A1D20]">
                  Multi-Sensor Fusion Indices
                </h3>
                <span className="text-xs text-[#6C7278]">
                  Updated 2 minutes ago via Automated Station Bus
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-[#FAF7F2] border border-[#E5E0D8] rounded-lg">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#6C7278]">Lightning strikes received</span>
                    <span className="font-bold text-[#DC2626] font-mono">
                      {lightningFeed?.metadata?.status === 'LIVE' ? lightningFeed.features.length : 'Unavailable'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#6C7278] mt-0.5 block">
                    Blitzortung proxy • {lightningFeed?.metadata?.status || 'CONNECTING'}
                  </span>
                </div>

                <div className="p-3 bg-[#FAF7F2] border border-[#E5E0D8] rounded-lg">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#6C7278]">Cloud-Top Brightness (CTT)</span>
                    <span className="font-bold text-[#DC2626] font-mono">Unavailable</span>
                  </div>
                  <span className="text-[10px] text-[#6C7278] mt-0.5 block">
                    MOSDAC imagery is not a calibrated point temperature without a configured GeoTIFF.
                  </span>
                </div>

                <div className="p-3 bg-[#FAF7F2] border border-[#E5E0D8] rounded-lg">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#6C7278]">CAPE Instability Energy</span>
                    <span className="font-bold text-[#D9532F] font-mono">{nwpData?.current_cape ?? 'Unavailable'}{nwpData?.current_cape != null ? ' J/kg' : ''}</span>
                  </div>
                  <span className="text-[10px] text-[#6C7278] mt-0.5 block">
                    {nwpData ? `CIN ${nwpData.cin_estimate ?? 'unavailable'} J/kg • Lifted Index ${nwpData.lifted_index ?? 'unavailable'} °C • ${nwpData.metadata?.mode || 'STATUS UNKNOWN'}` : 'Open-Meteo point sounding unavailable.'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onOpenLogin}
              className="w-full bg-[#FAF7F2] hover:bg-[#E5E0D8] border border-[#E5E0D8] text-[#1A1D20] py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors"
            >
              <span>Official Forecaster Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. PUBLIC INFO-TIER ADVISORIES SECTION */}
      <section id="advisories" className="bg-[#FFFFFF] border-y border-[#E5E0D8] px-4 lg:px-8 py-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E0D8] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D32] flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                Public Information Bulletins
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1A1D20] mt-1">
                Active Weather Advisories for Citizens &amp; Travelers
              </h2>
            </div>
            <div className="text-xs text-[#6C7278] font-mono bg-[#FAF7F2] border border-[#E5E0D8] px-3 py-1.5 rounded">
              Updated every 15 minutes • IMD Bulletin #ND-2026-44
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {publicAdvisories.map((adv) => {
              const tierColor = adv.tier === 'WATCH' ? '#D97706' : '#2E7D32';
              const tierBg = adv.tier === 'WATCH' ? '#FEF3C7' : '#E8F5E9';
              return (
                <div
                  key={adv.id}
                  className="bg-[#FAF7F2] border border-[#E5E0D8] rounded-xl p-5 space-y-3.5 shadow-2xs hover:shadow-xs transition-shadow"
                  style={{ borderTopWidth: '4px', borderTopColor: tierColor }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: tierBg, color: tierColor }}
                    >
                      {adv.tier} TIER
                    </span>
                    <span className="text-[11px] font-mono text-[#6C7278]">{adv.timeWindow}</span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-[#6C7278] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#D9532F]" />
                      {adv.region}
                    </span>
                    <h3 className="font-bold text-sm text-[#1A1D20] mt-0.5">{adv.title}</h3>
                  </div>

                  <p className="text-xs text-[#6C7278] leading-relaxed">{adv.description}</p>

                  <div className="pt-2 border-t border-[#E5E0D8] bg-white p-2.5 rounded border">
                    <span className="text-[10px] font-bold uppercase text-[#D9532F] block">
                      Recommended Public Action:
                    </span>
                    <span className="text-xs text-[#1A1D20] font-medium">{adv.safetyTip}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. EMERGENCY CONTACT NUMBERS & ROLES CALLOUT */}
      <section className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-10 space-y-8">
        {/* Disaster Hotlines Grid */}
        <div className="bg-[#0B2E4F] text-white rounded-xl p-6 lg:p-8 space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#12426E] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#FF9933] flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4" />
                State &amp; National Disaster Response Directory
              </span>
              <h3 className="text-lg md:text-xl font-bold mt-1">
                Emergency Flash Flood &amp; Severe Storm Toll-Free Helplines
              </h3>
            </div>
            <button
              onClick={onOpenLogin}
              className="bg-[#D9532F] hover:bg-[#BF4422] text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors shrink-0"
            >
              Responder Portal
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 bg-[#08223B] rounded border border-[#16436E]">
              <span className="text-[10px] text-neutral-400 uppercase block font-sans">NDMA National Control</span>
              <span className="text-lg font-bold text-white mt-1 block">1070</span>
              <span className="text-[10px] text-emerald-400 font-sans">24x7 Emergency Line</span>
            </div>
            <div className="p-3 bg-[#08223B] rounded border border-[#16436E]">
              <span className="text-[10px] text-neutral-400 uppercase block font-sans">State Disaster (SDMA)</span>
              <span className="text-lg font-bold text-white mt-1 block">1077</span>
              <span className="text-[10px] text-emerald-400 font-sans">District Control Rooms</span>
            </div>
            <div className="p-3 bg-[#08223B] rounded border border-[#16436E]">
              <span className="text-[10px] text-neutral-400 uppercase block font-sans">Emergency Medical / NDRF</span>
              <span className="text-lg font-bold text-white mt-1 block">108 / 112</span>
              <span className="text-[10px] text-emerald-400 font-sans">Immediate Dispatch</span>
            </div>
            <div className="p-3 bg-[#08223B] rounded border border-[#16436E]">
              <span className="text-[10px] text-neutral-400 uppercase block font-sans">IMD Weather Enquiry</span>
              <span className="text-lg font-bold text-white mt-1 block">1800-180-1717</span>
              <span className="text-[10px] text-emerald-400 font-sans">Toll-Free Radar Info</span>
            </div>
          </div>
        </div>

        {/* Role Portal Dispatch Card */}
        <details className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-[#1A1D20]">
            Portal access options
          </summary>
          <div className="px-4 pb-4 lg:px-8 lg:pb-8 space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h3 className="text-xl font-bold text-[#1A1D20]">
              Authorized Access to VayuGati Nowcast Command
            </h3>
            <p className="text-xs text-[#6C7278]">
              Role-governed operational environments engineered for citizen safety, SDRF disaster response,
              and IMD Doppler radar engineering.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Citizen Portal */}
            <div className="p-5 rounded-xl border border-[#E5E0D8] bg-[#FAF7F2] space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h4 className="font-bold text-sm text-[#1A1D20]">Citizen / Community</h4>
                <p className="text-xs text-[#6C7278] leading-relaxed">
                  Localized push early warnings, storm shelter navigators, and crowdsourced hail &amp; waterlogging reporting.
                </p>
              </div>
              <button
                onClick={onOpenLogin}
                className="w-full bg-white hover:bg-emerald-50 text-[#1A1D20] border border-[#E5E0D8] py-2 rounded text-xs font-bold uppercase transition-colors"
              >
                Access Citizen View
              </button>
            </div>

            {/* Officer Portal */}
            <div className="p-5 rounded-xl border border-[#E5E0D8] bg-[#FAF7F2] space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-800 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h4 className="font-bold text-sm text-[#1A1D20]">Duty Forecaster / SDRF</h4>
                <p className="text-xs text-[#6C7278] leading-relaxed">
                  Live Doppler radar sweeps, lightning jump alarms, cell broadcast siren dispatch, and evacuation tasking.
                </p>
              </div>
              <button
                onClick={onOpenLogin}
                className="w-full bg-[#D9532F] hover:bg-[#BF4422] text-white py-2 rounded text-xs font-bold uppercase transition-colors"
              >
                Access Forecaster View
              </button>
            </div>

            {/* Admin Portal */}
            <div className="p-5 rounded-xl border border-[#E5E0D8] bg-[#FAF7F2] space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-800 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h4 className="font-bold text-sm text-[#1A1D20]">District / IMD Admin</h4>
                <p className="text-xs text-[#6C7278] leading-relaxed">
                  Radar station calibration, NWP sounding ingestion, Supabase Row-Level Security policies &amp; sensor health telemetry.
                </p>
              </div>
              <button
                onClick={onOpenLogin}
                className="w-full bg-white hover:bg-neutral-100 text-[#1A1D20] border border-[#E5E0D8] py-2 rounded text-xs font-bold uppercase transition-colors"
              >
                Access Admin View
              </button>
            </div>
          </div>
          </div>
        </details>
      </section>

      {/* 5. FOOTER */}
      <footer className="border-t border-[#E5E0D8] bg-[#FFFFFF] px-4 lg:px-8 py-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#6C7278]">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#1A1D20]">VayuGati Nowcast</span>
            <span>• Operational Severe Weather Monitoring System</span>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={onOpenLogin} className="hover:text-[#D9532F] font-semibold">
              Official Portal Sign In
            </button>
            <span>•</span>
            <a href="#advisories" className="hover:text-[#D9532F]">
              Public Advisories
            </a>
            <span>•</span>
            <span>MoES / IMD Pilot Program</span>
          </div>
        </div>
      </footer>
      <DataDisclaimerModal open={isDataModalOpen} onClose={() => setIsDataModalOpen(false)} />
    </div>
  );
}
