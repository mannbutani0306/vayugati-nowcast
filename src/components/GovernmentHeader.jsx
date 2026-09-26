/**
 * @file GovernmentHeader.jsx
 * @description Official GIGW 3.0 Compliant Government of India, MoES, IMD & NDMA Navigation Header.
 *
 * Requirements & Capabilities:
 * 1. National Identity Top Strip:
 *    - 4px Indian Tricolour top bar gradient (#FF9933 Saffron, #FFFFFF White, #138808 Green).
 *    - Official State Emblem of India (Ashoka Lion Capital vector SVG).
 *    - Ministry Credentials:
 *      * "भारत सरकार | Government of India"
 *      * "Ministry of Earth Sciences (MoES)"
 *      * "India Meteorological Department (IMD)"
 *      * "National Disaster Management Authority (NDMA)"
 * 2. GIGW Accessibility Bar:
 *    - Font Size Adjuster: `A-` (Small), `A` (Normal), `A+` (Enlarged) affecting document root font scale.
 *    - Tri-Mode High Contrast Switcher: Default Warm Cream, High-Contrast Dark, High-Contrast Yellow/Navy.
 *    - 12 Scheduled Indian Languages Dropdown (English, Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese).
 *    - Screen Reader Quick Link (`href="#main-content"`).
 * 3. Live Emergency Alert Ticker (CAP Marquee):
 *    - Red/Yellow emergency marquee bar displaying active ITU / NDMA Common Alerting Protocol warnings.
 *    - Audio warning icon button triggering Web Speech API to read out the live emergency bulletin.
 * 4. Government Visual Identity:
 *    - Warm cream base (#FAF7F2), deep navy header (#0F172A), and warning terracotta (#D9532F).
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility, SUPPORTED_LANGUAGES } from '../context/AccessibilityContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  Radio,
  UserCheck,
  LogOut,
  LogIn,
  AlertCircle,
  Database,
  Shield,
  Eye,
  Globe,
  Sun,
  Moon,
  ChevronDown,
  Volume2,
  VolumeX,
  Bell,
  Sparkles,
  ExternalLink,
  Flame,
} from 'lucide-react';

/**
 * State Emblem of India SVG (Ashoka Lion Capital stylized insignia)
 */
function NationalEmblemSVG({ className = 'w-9 h-11' }) {
  return (
    <svg
      viewBox="0 0 100 125"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="State Emblem of India"
      role="img"
    >
      {/* Three visible lions of the Sarnath capital */}
      {/* Central Lion Head and Mane */}
      <path
        d="M50 12 C44 12, 38 16, 38 23 C38 28, 41 33, 44 36 C42 38, 40 42, 40 46 C40 50, 43 54, 46 56 C44 58, 43 62, 44 66 C46 70, 49 71, 50 71 C51 71, 54 70, 56 66 C57 62, 56 58, 54 56 C57 54, 60 50, 60 46 C60 42, 58 38, 56 36 C59 33, 62 28, 62 23 C62 16, 56 12, 50 12 Z"
        opacity="0.95"
      />
      {/* Left Lion Profile */}
      <path
        d="M32 20 C27 20, 22 25, 23 32 C23 37, 26 42, 29 45 C27 47, 25 51, 26 56 C27 61, 30 64, 33 66 C31 69, 31 73, 33 76 C35 79, 39 80, 42 79 C40 75, 38 71, 38 67 C36 65, 35 62, 35 59 C34 54, 36 51, 38 48 C36 45, 34 41, 35 37 C35 33, 37 30, 40 27 C37 23, 35 21, 32 20 Z"
        opacity="0.85"
      />
      {/* Right Lion Profile */}
      <path
        d="M68 20 C73 20, 78 25, 77 32 C77 37, 74 42, 71 45 C73 47, 75 51, 74 56 C73 61, 70 64, 67 66 C69 69, 69 73, 67 76 C65 79, 61 80, 58 79 C60 75, 62 71, 62 67 C64 65, 65 62, 65 59 C66 54, 64 51, 62 48 C64 45, 66 41, 65 37 C65 33, 63 30, 60 27 C63 23, 65 21, 68 20 Z"
        opacity="0.85"
      />
      {/* Circular Abacus Base */}
      <rect x="22" y="80" width="56" height="8" rx="2" opacity="0.9" />
      {/* Central Ashoka Chakra on Abacus */}
      <circle cx="50" cy="84" r="3.5" fill="#FAF7F2" stroke="currentColor" strokeWidth="1" />
      <circle cx="50" cy="84" r="0.8" fill="currentColor" />
      {/* Galloping Horse (Left) & Humped Bull (Right) symbolic dots */}
      <circle cx="34" cy="84" r="1.5" opacity="0.75" />
      <circle cx="66" cy="84" r="1.5" opacity="0.75" />
      {/* Inverted Lotus Plinth Base */}
      <path d="M26 89 C32 94, 68 94, 74 89 L76 96 C68 100, 32 100, 24 96 Z" opacity="0.9" />
      {/* Pedestal Bottom Bar */}
      <rect x="20" y="97" width="60" height="4" rx="1" opacity="0.95" />
      {/* Motto "सत्यमेव जयते" (Truth Alone Triumphs) */}
      <text
        x="50"
        y="112"
        fontSize="8"
        fontFamily="sans-serif"
        fontWeight="bold"
        textAnchor="middle"
        letterSpacing="0.5"
      >
        सत्यमेव जयते
      </text>
    </svg>
  );
}

export default function GovernmentHeader({ onOpenLogin }) {
  const { user, profile, role, isConfigured, logout } = useAuth();
  const {
    fontScale,
    setFontScale,
    contrastMode,
    cycleContrastMode,
    language,
    changeLanguage,
    speakText,
    stopSpeaking,
    isSpeakingAlert,
  } = useAccessibility();

  const navigate = useNavigate();
  const [istTime, setIstTime] = useState('');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  // Live Emergency Ticker Bulletin Text
  const emergencyMarqueeText =
    'RED ALERT (NDMA CAP v1.2): Severe convective cell detected over North Pune & Sahastradhara corridor (63.8 dBZ Hail Core). Flash flood risk within 45 minutes. Avoid river streams & low-lying bridges. Pre-positioning Stage 3 activated.';

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setIstTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDashboardRedirect = () => {
    if (role === 'admin') navigate('/admin');
    else if (role === 'officer') navigate('/officer');
    else navigate('/citizen');
  };

  const activeLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const handleToggleVoiceAlert = () => {
    if (isSpeakingAlert) {
      stopSpeaking();
    } else {
      speakText(emergencyMarqueeText);
    }
  };

  return (
    <header className="sticky top-0 z-50 shadow-md">
      {/* 1. GIGW MANDATORY SCREEN READER SKIP LINK */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[999] focus:bg-[#D9532F] focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-2xl focus:outline-none text-xs font-bold uppercase tracking-wider transition-all"
      >
        Skip to Main Content / मुख्य सामग्री पर जाएं (Screen Reader)
      </a>

      {/* 2. 4PX INDIAN TRICOLOUR TOP BAR GRADIENT (#FF9933, #FFFFFF, #138808) */}
      <div
        className="h-1 w-full"
        style={{
          background: 'linear-gradient(90deg, #FF9933 0%, #FF9933 33.33%, #FFFFFF 33.33%, #FFFFFF 66.66%, #138808 66.66%, #138808 100%)',
        }}
        title="National Flag of India Tricolour Ribbon (Saffron, White, Green)"
      ></div>

      {/* 3. NATIONAL IDENTITY STRIP & GIGW ACCESSIBILITY TOOLBAR */}
      <div className="bg-[#0B1528] text-neutral-300 text-[11px] px-4 lg:px-8 py-1.5 border-b border-[#1A2942] flex flex-wrap items-center justify-between gap-2.5">
        {/* National Identity Credentials */}
        <div className="flex items-center space-x-2 font-medium">
          <span className="text-[#FF9933] font-bold">भारत सरकार</span>
          <span className="text-neutral-500">|</span>
          <span className="text-white font-semibold">Government of India</span>
          <span className="hidden sm:inline text-neutral-500">•</span>
          <span className="hidden sm:inline text-neutral-300">
            Ministry of Earth Sciences (MoES)
          </span>
          <span className="hidden md:inline text-neutral-500">•</span>
          <span className="hidden md:inline text-neutral-400">
            India Meteorological Department (IMD)
          </span>
        </div>

        {/* GIGW Accessibility Bar (Top Right) */}
        <div className="flex items-center space-x-2.5">
          {/* Screen Reader Quick Anchor */}
          <a
            href="#main-content"
            title="Screen Reader Access (GIGW 3.0)"
            className="hidden lg:flex items-center space-x-1 text-neutral-400 hover:text-white transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#FF9933]" />
            <span className="text-[10px]">Screen Reader</span>
          </a>

          <div className="h-3 w-px bg-neutral-700 hidden lg:block"></div>

          {/* Font Size Adjuster Controls: A-, A, A+ */}
          <div
            className="flex items-center space-x-0.5 bg-[#14233D] rounded px-1.5 py-0.5 border border-[#1E3A5F]"
            role="group"
            aria-label="Text Font Size Controls"
          >
            <span className="text-[10px] text-neutral-400 mr-1 hidden sm:inline">Text Size:</span>
            <button
              type="button"
              onClick={() => setFontScale('sm')}
              title="Decrease Font Size (A-)"
              aria-label="Decrease Font Size"
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                fontScale === 'sm'
                  ? 'bg-[#D9532F] text-white'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontScale('md')}
              title="Standard Font Size (A)"
              aria-label="Standard Font Size"
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                fontScale === 'md'
                  ? 'bg-[#D9532F] text-white'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontScale('lg')}
              title="Increase Font Size (A+)"
              aria-label="Increase Font Size"
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                fontScale === 'lg'
                  ? 'bg-[#D9532F] text-white'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              A+
            </button>
          </div>

          {/* High Contrast Mode Toggle: Default Cream -> Dark -> Yellow/Navy */}
          <button
            type="button"
            onClick={cycleContrastMode}
            title={`Active Mode: ${contrastMode.toUpperCase()} (Click to Cycle Contrast)`}
            aria-label={`Cycle High Contrast Mode. Current: ${contrastMode}`}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center space-x-1.5 border transition-all cursor-pointer ${
              contrastMode === 'yellow-navy'
                ? 'bg-[#001F3F] text-[#FFD700] border-[#FFD700] shadow-2xs font-extrabold'
                : contrastMode === 'dark'
                ? 'bg-neutral-900 text-white border-neutral-400 font-bold'
                : 'bg-[#14233D] text-neutral-300 border-[#1E3A5F] hover:text-white'
            }`}
          >
            {contrastMode === 'yellow-navy' ? (
              <Sun className="w-3 h-3 text-[#FFD700]" />
            ) : contrastMode === 'dark' ? (
              <Moon className="w-3 h-3 text-neutral-200" />
            ) : (
              <Eye className="w-3 h-3 text-[#FF9933]" />
            )}
            <span>
              {contrastMode === 'yellow-navy'
                ? 'Yellow/Navy'
                : contrastMode === 'dark'
                ? 'High Dark'
                : 'Contrast'}
            </span>
          </button>

          {/* 12 Scheduled Indian Languages Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              aria-expanded={isLangMenuOpen}
              aria-label="Select Regional Language"
              className="bg-[#14233D] hover:bg-[#1C3254] text-white px-2 py-0.5 rounded border border-[#1E3A5F] flex items-center space-x-1 text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Globe className="w-3 h-3 text-[#FF9933]" />
              <span>{activeLangObj.native}</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {isLangMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-[#0F172A] border border-[#233857] rounded-lg shadow-2xl py-1 z-50 text-xs divide-y divide-[#1E293B]">
                <div className="px-3 py-1.5 text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                  12 Scheduled Languages
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        changeLanguage(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        language === lang.code
                          ? 'bg-[#D9532F] text-white font-bold'
                          : 'text-neutral-200 hover:bg-[#1E293B]'
                      }`}
                    >
                      <span className="font-medium">{lang.native}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {lang.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. OFFICIAL MINISTRY BANNER (Deep Navy #0F172A) */}
      <div className="bg-[#0F172A] text-[#FAF7F2] border-b border-[#1E293B] px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Official Emblem & Branding */}
          <div className="flex items-center space-x-3.5">
            <Link to="/" className="flex items-center space-x-3 group">
              {/* National Emblem of India Stylized Crest */}
              <div className="w-12 h-14 rounded-lg bg-[#FAF7F2] p-1 flex items-center justify-center text-[#0F172A] shadow-md border border-[#E5E0D8] group-hover:scale-102 transition-transform">
                <NationalEmblemSVG className="w-8 h-12 text-[#0F172A]" />
              </div>

              <div>
                <div className="text-[10px] tracking-wider uppercase font-semibold text-neutral-300 flex flex-wrap items-center gap-1.5">
                  <span className="text-[#FF9933] font-bold">भारत सरकार</span>
                  <span>|</span>
                  <span>Ministry of Earth Sciences (MoES)</span>
                </div>
                <div className="text-sm md:text-base font-bold tracking-tight text-white flex items-center gap-2">
                  <span>India Meteorological Department (IMD)</span>
                  <span className="hidden sm:inline text-neutral-400 font-normal">•</span>
                  <span className="hidden sm:inline text-xs text-neutral-300 font-semibold">
                    NDMA Integrated Node
                  </span>
                </div>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-xs font-extrabold text-[#FAF7F2] tracking-wide">
                    VayuGati Nowcast
                  </span>
                  <span className="text-[9px] bg-[#1E3A8A] text-blue-100 border border-blue-400/40 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                    MoES - IMD Operational
                  </span>
                  <span className="text-[10px] text-neutral-400 hidden lg:inline">
                    Convective-Scale Nowcasting (0–6 Hr Lead Time, 1–3 km Mesh)
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Quick Header Controls: Live Clock, System Status & Official Login */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live IST Clock */}
            <div className="bg-[#09101F] border border-[#1E293B] px-3 py-1.5 rounded text-xs flex items-center space-x-2 font-mono text-neutral-200">
              <Clock className="w-3.5 h-3.5 text-[#FF9933]" />
              <span className="font-semibold text-white">{istTime || '12:00:00'} IST</span>
            </div>

            {/* Operational System Status Indicator */}
            <div
              className="border px-2.5 py-1.5 rounded text-[11px] flex items-center space-x-1.5 bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
              title="Doppler radar network and nowcast processing nodes active"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium">System Status: Operational</span>
            </div>

            {/* User Profile / Portal Action */}
            {profile ? (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDashboardRedirect}
                  className="bg-[#D9532F] hover:bg-[#BF4422] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="capitalize">{role} Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  title="Sign out"
                  className="p-1.5 bg-[#09101F] hover:bg-neutral-800 text-neutral-300 rounded border border-[#1E293B] transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="bg-[#D9532F] hover:bg-[#BF4422] text-white px-3.5 py-1.5 rounded text-xs font-bold tracking-wide flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>OFFICIAL LOGIN</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. LIVE EMERGENCY ALERT TICKER (RED/YELLOW CAP MARQUEE WITH AUDIO TTS) */}
      <div className="bg-[#B91C1C] text-white text-xs py-1.5 px-4 overflow-hidden border-b border-[#991B1B] flex items-center shadow-inner">
        {/* Warning Badge & Audio TTS Trigger */}
        <div className="flex items-center space-x-2 shrink-0 mr-3">
          <span className="bg-yellow-400 text-black font-extrabold text-[10px] uppercase px-2 py-0.5 rounded tracking-wider flex items-center gap-1 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            <span>CAP BULLETIN</span>
          </span>

          {/* Web Speech API Audio Warning Button */}
          <button
            type="button"
            onClick={handleToggleVoiceAlert}
            title={isSpeakingAlert ? 'Stop Audio Broadcast' : 'Read Emergency Bulletin Aloud (Web Speech API)'}
            aria-label="Read Out Emergency Alert Aloud"
            className={`p-1 rounded transition-all cursor-pointer flex items-center space-x-1 text-[11px] font-bold ${
              isSpeakingAlert
                ? 'bg-yellow-300 text-black animate-pulse'
                : 'bg-black/30 hover:bg-black/50 text-white'
            }`}
          >
            {isSpeakingAlert ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-yellow-300" />}
            <span className="hidden sm:inline text-[10px]">
              {isSpeakingAlert ? 'Stop Audio' : 'Audio Alert'}
            </span>
          </button>
        </div>

        {/* Marquee Scrolling Text Strip */}
        <div className="relative overflow-hidden w-full whitespace-nowrap">
          <div
            className="inline-block animate-marquee font-mono text-[11px] tracking-wide text-yellow-100 font-bold"
            role="marquee"
            aria-live="polite"
          >
            {emergencyMarqueeText} • Doppler C-Band dual-pol Zdr signature and 3.0σ lightning flash jump detected • Cell broadcast sirens initiated to SDMA &amp; SDRF Quick Reaction Units.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </header>
  );
}
