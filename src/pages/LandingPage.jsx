import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import DataDisclaimerModal from '../components/DataDisclaimerModal';
import LoginModal from '../components/LoginModal';
import { fetchCurrentPlace, fetchCurrentWeather, fetchRadarFeed, PUBLIC_IMD_RADAR_IMAGE_URL } from '../lib/apiClient';
import {
  Cloud,
  CloudRain,
  Radio,
  Info,
  MapPin,
  LocateFixed,
  Sun,
} from 'lucide-react';

function weatherDescription(code) {
  if (code === 0) return 'Clear sky';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Fog';
  if (code >= 51 && code <= 67) return 'Rain showers';
  if (code >= 71 && code <= 77) return 'Snowfall';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Weather update';
}

function WeatherIcon({ code }) {
  if (code === 0) return <Sun aria-hidden="true" className="h-16 w-16 text-yellow-200" strokeWidth={1.5} />;
  if (code >= 51 && code <= 99) return <CloudRain aria-hidden="true" className="h-16 w-16 text-white" strokeWidth={1.5} />;
  return <Cloud aria-hidden="true" className="h-16 w-16 text-white" strokeWidth={1.5} />;
}

export default function LandingPage() {
  const [radarFeed, setRadarFeed] = useState(null);
  const [weather, setWeather] = useState(null);
  const [locationName, setLocationName] = useState('Finding your location...');
  const [locationStatus, setLocationStatus] = useState('locating');
  const [locationRefreshCounter, setLocationRefreshCounter] = useState(0);
  const [indiaTimeNow, setIndiaTimeNow] = useState(() => new Date());
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

  useEffect(() => {
    let active = true;
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setLocationName('Location unavailable');
      return () => { active = false; };
    }

    setLocationStatus('locating');
    setLocationName('Finding your location...');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (!active) return;
      const controller = new AbortController();
      try {
        const [weatherResult, placeResult] = await Promise.allSettled([
          fetchCurrentWeather({ lat: coords.latitude, lon: coords.longitude, signal: controller.signal }),
          fetchCurrentPlace({ lat: coords.latitude, lon: coords.longitude, signal: controller.signal }),
        ]);
        if (!active) return;
        if (weatherResult.status === 'fulfilled') setWeather(weatherResult.value);
        else console.warn('Current local weather unavailable:', weatherResult.reason);
        if (placeResult.status === 'fulfilled') setLocationName(placeResult.value);
        else setLocationName('Your location');
        setLocationStatus('located');
      } finally {
        controller.abort();
      }
    }, () => {
      if (!active) return;
      setLocationStatus('unavailable');
      setLocationName('Location unavailable');
    }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 12000 });

    return () => { active = false; };
  }, [locationRefreshCounter]);

  useEffect(() => {
    const timerId = window.setInterval(() => setIndiaTimeNow(new Date()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const istTime = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(indiaTimeNow);
  const istDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(indiaTimeNow);
  const currentWeather = weather?.current;
  const weatherCode = Number(currentWeather?.weather_code);

  const publicAdvisories = [
    {
      id: 'ADV-01',
      tier: 'INFO',
      region: 'Dehradun & Rishikesh Foothills',
      title: 'Heavy-rain safety example',
      description:
        'During intense rainfall, water levels in streams and underpasses can rise quickly. Check current local authority updates before travelling.',
      safetyTip: 'Keep away from riverbeds, drains, and flooded roads.',
    },
    {
      id: 'ADV-02',
      tier: 'WATCH',
      region: 'Haridwar – Roorkee Corridor',
      title: 'Strong-wind safety example',
      description:
        'Thunderstorm outflows can produce sudden damaging gusts. Follow official warnings and avoid exposed locations during storms.',
      safetyTip: 'Stay indoors and keep away from trees, temporary structures, and power lines.',
    },
    {
      id: 'ADV-03',
      tier: 'INFO',
      region: 'Upper Gangetic Transition Zone',
      title: 'Lightning safety example',
      description:
        'A lack of an alert on this prototype does not mean conditions are safe. Check official IMD and disaster-management bulletins for your area.',
      safetyTip: 'Move inside a substantial building when thunder is heard.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1A1D20] flex flex-col antialiased">
      <section className="relative isolate overflow-hidden border-b border-[#E5E0D8] bg-gradient-to-br from-sky-100 via-cyan-50 to-sky-100 px-4 py-8 lg:px-8 lg:py-12">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-100/70 via-cyan-50/40 to-sky-200/70" />
          <div className="absolute bottom-0 left-0 h-2/5 w-full bg-sky-300/35 [clip-path:polygon(0_72%,14%_48%,29%_68%,45%_35%,57%_65%,73%_28%,86%_57%,100%_38%,100%_100%,0_100%)]" />
          <div className="absolute bottom-0 left-0 h-1/4 w-full bg-cyan-800/15 [clip-path:polygon(0_70%,17%_32%,33%_68%,51%_24%,70%_72%,85%_34%,100%_61%,100%_100%,0_100%)]" />
        </div>
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] lg:gap-12">
          <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="bg-[#FAF7F2] border border-[#E5E0D8] text-[#1A1D20] px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#1E3A8A]"></span>
              VayuGati nowcast dashboard · Not an official warning service
            </span>
          </div>

          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#1A1D20] leading-tight">
              Severe weather,{' '}
              <span className="text-[#D9532F]">seen sooner.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#6C7278] leading-relaxed">
              Built to explore 0–6 hour convective nowcasting. This prototype currently provides live NWP guidance, public imagery, and local historical archives; authorized radar, calibrated satellite, and lightning feeds are not yet configured for operational fusion.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/data-lab"
              className="bg-[#0B7084] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#07586B]"
            >
              Explore archived data
            </Link>
            <a
              href="#advisories"
              className="bg-[#FAF7F2] hover:bg-[#E5E0D8] text-[#1A1D20] border border-[#E5E0D8] px-5 py-3 rounded-lg font-semibold text-sm transition-all"
            >
              View safety examples
            </a>
          </div>
          </div>

          <aside className="relative min-h-[290px] overflow-hidden rounded-xl border border-white/70 bg-gradient-to-b from-sky-400 via-cyan-300 to-sky-600 p-5 text-white shadow-lg sm:min-h-[330px]" aria-label={`Current weather in ${locationName}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-sky-950/35" aria-hidden="true" />
            <div className="relative flex h-full min-h-[250px] flex-col items-center justify-center text-center sm:min-h-[290px]">
              <div className="absolute left-0 top-0 flex flex-col items-start text-left text-sm font-medium leading-tight text-white/90">
                <time dateTime={indiaTimeNow.toISOString()}>{istTime}</time>
                <span>{istDate}</span>
              </div>
              <button
                type="button"
                onClick={() => setLocationRefreshCounter((version) => version + 1)}
                title="Use your current location"
                aria-label="Retry current location"
                className="absolute right-0 top-0 inline-flex max-w-[45%] items-center gap-1 truncate text-right text-sm font-semibold text-white/95 hover:text-white"
              >
                {locationStatus === 'locating' && <LocateFixed aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-pulse" />}
                <span className="truncate">{locationName}</span>
              </button>
              <WeatherIcon code={weatherCode} />
              <div className="mt-2 text-6xl font-light leading-none tabular-nums sm:text-7xl">
                {Number.isFinite(currentWeather?.temperature_2m) ? `${Math.round(currentWeather.temperature_2m)}°` : '--°'}
              </div>
              <p className="mt-2 text-base font-medium text-white/90">{Number.isFinite(weatherCode) ? weatherDescription(weatherCode) : 'Current conditions'}</p>
              <p className="mt-1 text-xs text-white/80">
                {weather?.daily?.temperature_2m_min?.[0] != null && weather?.daily?.temperature_2m_max?.[0] != null
                  ? `Today ${Math.round(weather.daily.temperature_2m_min[0])}° / ${Math.round(weather.daily.temperature_2m_max[0])}°`
                  : locationStatus === 'locating' ? 'Finding local weather...' : locationStatus === 'unavailable' ? 'Allow location access to view local weather.' : 'Live weather from Open-Meteo'}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section id="live-radar" className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#D9532F]">
              <Radio className="w-3.5 h-3.5" />
              <span>Public feed status &amp; imagery preview</span>
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
          <div className="lg:col-span-2 bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#1A1D20]">IMD Doppler Weather Radar</h3>
              </div>
            </div>

            {radarFeed?.mode !== 'WMS' && radarFeed?.mode !== 'XYZ_TMS_TILES' ? (
              <a href={radarFeed?.image_url || PUBLIC_IMD_RADAR_IMAGE_URL} rel="noreferrer" target="_blank" title="Open the public IMD radar image">
                <img alt="Public IMD radar image; image is not georeferenced for map overlay" className="block h-[min(60vh,520px)] min-h-[260px] w-full bg-[#F1F5F6] object-contain" decoding="async" fetchPriority="high" loading="eager" src={radarFeed?.image_url || PUBLIC_IMD_RADAR_IMAGE_URL} />
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

      {/* 3. ILLUSTRATIVE SAFETY EXAMPLES */}
      <section id="advisories" className="bg-[#FFFFFF] border-y border-[#E5E0D8] px-4 lg:px-8 py-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E0D8] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D32] flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                Illustrative safety examples · not live warnings
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1A1D20] mt-1">
                Example guidance for severe-weather scenarios
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
                      EXAMPLE · {adv.tier}
                    </span>
                    <span className="text-[11px] font-semibold text-[#6C7278]">Example only</span>
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
            <span>• Convective nowcast research prototype</span>
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
