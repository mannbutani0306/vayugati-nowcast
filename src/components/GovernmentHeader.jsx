import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility, SUPPORTED_LANGUAGES } from '../context/AccessibilityContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserCheck,
  LogOut,
  LogIn,
  Database,
  Eye,
  Globe,
  Clock,
  ChevronDown,
  ExternalLink,
  X,
} from 'lucide-react';

export default function GovernmentHeader({ onOpenLogin }) {
  const { profile, role, logout } = useAuth();
  const {
    fontScale,
    setFontScale,
    language,
    changeLanguage,
  } = useAccessibility();

  const navigate = useNavigate();
  const [istTime, setIstTime] = useState('');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);

  useEffect(() => {
    const updateClock = () => setIstTime(new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date()));
    updateClock();
    const timerId = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const handleDashboardRedirect = () => {
    const normalizedRole = String(role || '').toLowerCase().replace(/[- ]/g, '_');
    if (normalizedRole === 'admin') navigate('/admin');
    else if (normalizedRole === 'officer' || normalizedRole === 'duty_officer') navigate('/officer');
    else navigate('/citizen');
  };

  const activeLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const handleSignOut = async () => {
    await logout();
    setIsSignOutConfirmOpen(false);
    navigate('/');
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
      <div className="bg-[#0B1528] text-neutral-300 text-[11px] px-4 lg:px-8 py-1.5 border-b border-[#1A2942] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        {/* National Identity Credentials */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
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
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
              aria-pressed={fontScale === 'sm'}
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
              aria-pressed={fontScale === 'md'}
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
              aria-pressed={fontScale === 'lg'}
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                fontScale === 'lg'
                  ? 'bg-[#D9532F] text-white'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              A+
            </button>
          </div>

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
                  Available languages
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {SUPPORTED_LANGUAGES.filter((lang) => ['en', 'hi', 'mr'].includes(lang.code)).map((lang) => (
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
      <div className="bg-[#0F172A] text-[#FAF7F2] border-b border-[#1E293B] px-4 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Official Emblem & Branding */}
          <div className="flex min-w-0 items-center space-x-3.5">
            <Link to="/" className="flex min-w-0 items-center space-x-3 group">
              {/* National Emblem of India Stylized Crest */}
              <div className="w-12 h-14 rounded-lg bg-[#FAF7F2] p-1 flex items-center justify-center text-[#0F172A] shadow-md border border-[#E5E0D8] group-hover:scale-102 transition-transform">
                <img
                  src="/EMBLEM.jpeg"
                  alt="State Emblem of India"
                  className="h-12 w-[70px] object-contain"
                />
              </div>

              <div className="min-w-0">
                <div className="text-[10px] tracking-wider uppercase font-semibold text-neutral-300 flex flex-wrap items-center gap-1.5">
                  <span className="text-[#FF9933] font-bold">भारत सरकार</span>
                  <span>|</span>
                  <span>Ministry of Earth Sciences (MoES)</span>
                </div>
                <div className="text-sm md:text-base font-bold tracking-tight text-white">
                  India Meteorological Department (IMD)
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-extrabold text-[#FAF7F2] tracking-wide">
                    VayuGati Nowcast
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Quick Header Controls: Live Clock, System Status & Official Login */}
          <div className="flex flex-wrap items-center gap-2 md:ml-auto md:justify-end">
            <div className="inline-flex items-center gap-2 border border-[#1E293B] bg-[#09101F] px-2.5 py-1.5 font-mono text-xs text-white" aria-label={`Current time ${istTime} India Standard Time`}>
              <Clock aria-hidden="true" className="h-3.5 w-3.5 text-[#FF9933]" />
              <time dateTime={new Date().toISOString()}>{istTime || '--:--:--'} IST</time>
            </div>
            <Link
              to="/data-sources"
              aria-label="Data sources and attribution"
              className="border border-[#1E3A5F] bg-[#14233D] px-2.5 py-1.5 text-[11px] text-white hover:bg-[#1C3254] inline-flex items-center gap-1.5"
            >
              <Database aria-hidden="true" className="h-3.5 w-3.5 text-[#FF9933]" />
              <span>Data sources</span>
            </Link>

            {/* User Profile / Portal Action */}
            {profile ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDashboardRedirect}
                  className="bg-[#D9532F] hover:bg-[#BF4422] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="capitalize">{role} dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignOutConfirmOpen(true)}
                  className="bg-[#09101F] hover:bg-neutral-800 text-white px-3 py-1.5 rounded border border-[#1E293B] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="bg-[#D9532F] hover:bg-[#BF4422] text-white px-3.5 py-1.5 rounded text-xs font-bold tracking-wide flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isSignOutConfirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" role="presentation">
          <section className="w-full max-w-sm rounded-lg border border-[#E5E0D8] bg-white p-5 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="signout-title">
            <div className="flex items-start justify-between gap-3">
              <h2 id="signout-title" className="text-base font-bold text-[#1A1D20]">ARE YOU SURE YOU WANT TO SIGN OUT?</h2>
              <button type="button" onClick={() => setIsSignOutConfirmOpen(false)} aria-label="Close sign-out confirmation" className="text-[#6C7278] hover:text-[#1A1D20]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setIsSignOutConfirmOpen(false)} className="rounded border border-[#E5E0D8] px-3 py-2 text-sm font-semibold text-[#1A1D20]">Cancel</button>
              <button type="button" onClick={handleSignOut} className="rounded bg-[#D9532F] px-3 py-2 text-sm font-semibold text-white hover:bg-[#BF4422]">Sign out</button>
            </div>
          </section>
        </div>
      )}
    </header>
  );
}
