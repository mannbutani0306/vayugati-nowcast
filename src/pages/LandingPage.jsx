import React, { useEffect, useState } from 'react';
import DataDisclaimerModal from '../components/DataDisclaimerModal';
import LoginModal from '../components/LoginModal';
import { fetchRadarFeed } from '../lib/apiClient';
import {
  Radio,
  Info,
  MapPin,
} from 'lucide-react';

export default function LandingPage() {
  const [radarFeed, setRadarFeed] = useState(null);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refreshPublicFeeds = async () => {
      const result = await fetchRadarFeed({ signal: controller.signal }).then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason })
      );
      if (!active) return;
      setRadarFeed(result.status === 'fulfilled' ? result.value : { status: 'OFFLINE' });
      if (result.status === 'rejected') console.warn('Public radar feed unavailable:', result.reason);
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

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="#advisories"
              className="bg-[#FAF7F2] hover:bg-[#E5E0D8] text-[#1A1D20] border border-[#E5E0D8] px-5 py-3 rounded-lg font-semibold text-sm transition-all"
            >
              View Public Safety Advisories
            </a>
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
            onClick={() => setIsDataModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#315966] hover:text-[#173644]"
            type="button"
          >
            <Info className="h-3.5 w-3.5" />
            Data Sources
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-5">
          {/* Radar Reflectivity Preview Card */}
          <div className="lg:col-span-2 bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#1A1D20]">IMD Doppler Weather Radar</h3>
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

          <div className="lg:col-span-1">
            <LoginModal embedded isOpen />
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

      {/* 5. FOOTER */}
      <footer className="border-t border-[#E5E0D8] bg-[#FFFFFF] px-4 lg:px-8 py-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#6C7278]">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#1A1D20]">VayuGati Nowcast</span>
            <span>• Operational Severe Weather Monitoring System</span>
          </div>
          <div className="flex items-center space-x-4">
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
