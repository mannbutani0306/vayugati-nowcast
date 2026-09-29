import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility, SUPPORTED_LANGUAGES } from '../context/AccessibilityContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { subscribeToApprovedAlerts } from '../lib/spatialQueries';
import VayuGatiSaarthi from './VayuGatiSaarthi';
import {
  UserCheck,
  LogOut,
  LogIn,
  Database,
    Play,
  Globe,
  Clock,
  ChevronDown,
  ExternalLink,
  X,
  Bell,
  MessageCircle,
  Volume2,
  VolumeX,
  Menu,
} from 'lucide-react';

const NOTIFICATIONS_KEY = 'vayugati_notifications';
const NOTIFICATIONS_VIEWED_KEY = 'vayugati_notifications_viewed_at';
const NOTIFICATION_SOUND_KEY = 'vayugati_notification_sound';

function readStoredNotifications() {
  try {
    const stored = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
    return Array.isArray(stored) ? stored.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export default function GovernmentHeader({ onOpenLogin, onApprovedAlert, onTestNotification }) {
  const { profile, role, logout } = useAuth();
  const {
    fontScale,
    setFontScale,
    language,
    changeLanguage,
    translate,
  } = useAccessibility();

  const navigate = useNavigate();
  const location = useLocation();
  const [istTime, setIstTime] = useState('');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isSaarthiOpen, setIsSaarthiOpen] = useState(false);
  const [notifications, setNotifications] = useState(readStoredNotifications);
  const [realtimeStatus, setRealtimeStatus] = useState(isSupabaseConfigured ? 'CONNECTING' : 'NOT CONFIGURED');
  const [realtimeAttempt, setRealtimeAttempt] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState(() => (
    'Notification' in window ? Notification.permission : 'unsupported'
  ));
  const [lastViewedAt, setLastViewedAt] = useState(() => localStorage.getItem(NOTIFICATIONS_VIEWED_KEY) || '');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem(NOTIFICATION_SOUND_KEY) !== 'false');
  const audioContextRef = useRef(null);
  const notificationMenuRef = useRef(null);
  const seenNotificationIds = useRef(null);
  if (!seenNotificationIds.current) {
    seenNotificationIds.current = new Set(notifications.map((item) => item.id));
  }
  const unreadCount = notifications.filter((item) => item.createdAt > lastViewedAt).length;

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(NOTIFICATION_SOUND_KEY, String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    if (!isNotificationMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!notificationMenuRef.current?.contains(event.target)) setIsNotificationMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsNotificationMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isNotificationMenuOpen]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setRealtimeStatus('NOT CONFIGURED');
      return undefined;
    }

    const playNotificationSound = () => {
      if (!soundEnabled || !audioContextRef.current) return;
      const audioContext = audioContextRef.current;
      if (audioContext.state !== 'running') return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(587, audioContext.currentTime + 0.12);
      gain.gain.setValueAtTime(0.045, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.28);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.28);
    };

    let subscription;
    try {
      subscription = subscribeToApprovedAlerts((alert) => {
        const alertId = alert.id || alert.identifier;
        const id = `${alertId}:${alert.approved_at || alert.updated_at || alert.status}`;
        if (!alertId || alert.status !== 'APPROVED') return;
        if (seenNotificationIds.current.has(id)) return;
        seenNotificationIds.current.add(id);

        const title = alert.headline_en || 'Approved weather alert';
        const notification = {
          id,
          title,
          body: alert.description_en || `${alert.severity || 'Weather'} alert approved for ${alert.location_label || 'your area'}.`,
          createdAt: new Date().toISOString(),
        };
        setNotifications((current) => [notification, ...current].slice(0, 20));
        onApprovedAlert?.(alert);
        playNotificationSound();

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, { body: notification.body, tag: id });
        }
      }, setRealtimeStatus);
    } catch (error) {
      setRealtimeStatus('CHANNEL ERROR');
      console.warn('Approved-alert notifications unavailable:', error);
    }

    return () => subscription?.unsubscribe();
  }, [onApprovedAlert, realtimeAttempt, soundEnabled]);

  const handleTestNotification = async () => {
    const id = `test-${Date.now()}`;
    const notification = {
      id,
      title: 'Test notification',
      body: 'Local test only. This is not a weather observation or warning.',
      createdAt: new Date().toISOString(),
    };
    setNotifications((current) => [notification, ...current].slice(0, 20));
    onTestNotification?.();

    if (soundEnabled && (window.AudioContext || window.webkitAudioContext)) {
      try {
        if (!audioContextRef.current) {
          const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContextConstructor();
        }
        if (audioContextRef.current.state !== 'running') await audioContextRef.current.resume();
        if (audioContextRef.current.state === 'running') {
          const context = audioContextRef.current;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(740, context.currentTime);
          oscillator.frequency.setValueAtTime(587, context.currentTime + 0.12);
          gain.gain.setValueAtTime(0.045, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.28);
        }
      } catch (error) {
        console.warn('Notification sound unavailable:', error);
      }
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, { body: notification.body, tag: id });
    }
  };

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
  const dashboardRole = role === 'duty_officer' ? 'officer' : role || 'citizen';

  const handleSignOut = async () => {
    await logout();
    setIsSignOutConfirmOpen(false);
    navigate('/');
  };

  const unlockNotificationAudio = () => {
    if (!audioContextRef.current && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextConstructor();
    }
    audioContextRef.current?.resume().catch(() => {});
  };

  const handleNotificationToggle = () => {
    setIsNotificationMenuOpen((open) => !open);
    const viewedAt = new Date().toISOString();
    setLastViewedAt(viewedAt);
    localStorage.setItem(NOTIFICATIONS_VIEWED_KEY, viewedAt);

    unlockNotificationAudio();

  };

  const handleEnableBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    try {
      setNotificationPermission(await Notification.requestPermission());
    } catch {
      setNotificationPermission(Notification.permission);
    }
  };

  return (
    <header className="sticky top-0 z-50 shadow-md">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[999] focus:bg-[#D9532F] focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-2xl focus:outline-none text-xs font-bold uppercase tracking-wider transition-all"
      >
        Skip to Main Content / मुख्य सामग्री पर जाएं (Screen Reader)
      </a>

      <div
        className="h-1 w-full"
        style={{
          background: 'linear-gradient(90deg, #FF9933 0%, #FF9933 33.33%, #FFFFFF 33.33%, #FFFFFF 66.66%, #138808 66.66%, #138808 100%)',
        }}
        title="Nowcast dashboard status ribbon"
      ></div>

      <div className="bg-[#0B1528] text-neutral-300 text-[11px] px-4 lg:px-8 py-1.5 border-b border-[#1A2942] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          <span className="text-[#FF9933] font-bold">VayuGati</span>
          <span className="text-neutral-500">|</span>
          <span className="text-white font-semibold">Public weather dashboard</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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

      <div className="bg-[#0F172A] text-[#FAF7F2] border-b border-[#1E293B] px-4 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <Link to="/" className="flex min-w-0 items-center space-x-3 group">
              <img src="/icons/logo.png" alt="VayuGati logo" className="h-12 w-12 shrink-0 object-contain md:h-16 md:w-16" />

              <div className="min-w-0">
                <div className="text-lg font-black tracking-wide text-white drop-shadow-[0_1px_7px_rgba(217,83,47,0.65)] sm:text-xl md:text-2xl">
                  VAYUGATI-NOWCAST
                </div>
                <span aria-hidden="true" className="mt-1 block h-1 w-16 bg-gradient-to-r from-[#FF9933] via-white to-[#138808]" />
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileNavOpen((open) => !open)}
              aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileNavOpen}
              aria-controls="primary-navigation"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[#1E3A5F] bg-[#14233D] text-white md:hidden"
            >
              {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <div
            id="primary-navigation"
            className={`${isMobileNavOpen ? 'grid' : 'hidden'} w-full grid-cols-2 items-center gap-2 md:flex md:w-auto md:flex-wrap md:ml-auto md:justify-end`}
          >
            <div className="inline-flex items-center gap-2 border border-[#1E293B] bg-[#09101F] px-2.5 py-1.5 font-mono text-xs text-white" aria-label={`Current time ${istTime} India Standard Time`}>
              <Clock aria-hidden="true" className="h-3.5 w-3.5 text-[#FF9933]" />
              <time dateTime={new Date().toISOString()}>{istTime || '--:--:--'} IST</time>
            </div>
            <Link
              to="/data-lab"
              aria-label="Open archive replay and scenario simulation"
              className="inline-flex h-9 items-center justify-center gap-1.5 border border-[#1E3A5F] bg-[#14233D] px-3 text-[11px] text-white hover:bg-[#1C3254]"
            >
              <Play aria-hidden="true" className="h-3.5 w-3.5 text-[#FF9933]" />
              <span>Data lab</span>
            </Link>
            <Link
              to="/data-sources"
              aria-label="Data sources and attribution"
              className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 border border-[#1E3A5F] bg-[#14233D] px-3 text-[11px] text-white hover:bg-[#1C3254]"
              onClick={(event) => {
                if (['/citizen', '/officer', '/admin'].includes(location.pathname)
                  && !window.confirm('Leave your dashboard to view data sources?')) {
                  event.preventDefault();
                }
              }}
            >
              <Database aria-hidden="true" className="h-3.5 w-3.5 text-[#FF9933]" />
              <span>Data sources</span>
            </Link>

            <div className="relative" ref={notificationMenuRef}>
              <button
                type="button"
                onClick={handleNotificationToggle}
                title="Notifications"
                aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                aria-expanded={isNotificationMenuOpen}
                className="relative inline-flex h-9 min-w-9 items-center justify-center border border-[#1E3A5F] bg-[#14233D] text-white hover:bg-[#1C3254]"
              >
                <Bell aria-hidden="true" className="h-4 w-4 text-[#FF9933]" />
                {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#D9532F] px-1 text-[9px] font-bold leading-4 text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {isNotificationMenuOpen && (
                <section className="absolute right-0 top-full z-[80] mt-2 w-[min(22rem,calc(100vw-2rem))] border border-[#D4DEE5] bg-white text-[#1A1D20] shadow-2xl" aria-label="Weather notifications">
                  <div className="flex items-center justify-between border-b border-[#E5E0D8] px-4 py-3">
                    <div>
                      <h2 className="text-sm font-bold">Notifications</h2>
                      <p className="text-[11px] text-[#6C7278]">Alert feed: {realtimeStatus}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {isSupabaseConfigured && realtimeStatus !== 'SUBSCRIBED' && (
                        <button
                          type="button"
                          onClick={() => { setRealtimeStatus('CONNECTING'); setRealtimeAttempt((attempt) => attempt + 1); }}
                          className="border border-[#C9D5D8] px-2 py-1 text-[10px] font-semibold text-[#29434B] hover:bg-[#EEF4F5]"
                        >
                          Reconnect
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          unlockNotificationAudio();
                          setSoundEnabled((enabled) => !enabled);
                        }}
                        title={soundEnabled ? 'Mute notification sound' : 'Enable notification sound'}
                        aria-label={soundEnabled ? 'Mute notification sound' : 'Enable notification sound'}
                        aria-pressed={soundEnabled}
                        className="inline-flex h-8 w-8 items-center justify-center border border-[#E5E0D8] text-[#315966] hover:bg-[#F1F5F6]"
                      >
                        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-b border-[#E5E0D8] px-4 py-2">
                    <p className="text-[10px] leading-4 text-[#6C7278]">Test the in-app notice and gentle sound.</p>
                    <button type="button" onClick={handleTestNotification} className="shrink-0 border border-[#C9D5D8] px-2 py-1 text-[10px] font-semibold text-[#29434B] hover:bg-[#EEF4F5]">Test notification</button>
                  </div>
                  {notificationPermission !== 'granted' && (
                    <div className="border-b border-[#E5E0D8] px-4 py-3">
                      {notificationPermission === 'unsupported' || notificationPermission === 'denied' ? (
                        <p className="text-[11px] leading-4 text-[#6C7278]">
                          {notificationPermission === 'denied' ? 'Browser notifications are blocked in site settings.' : 'This browser does not support notifications.'}
                        </p>
                      ) : (
                        <button type="button" onClick={handleEnableBrowserNotifications} className="border border-[#0B7084] px-2.5 py-1.5 text-[11px] font-semibold text-[#07586B] hover:bg-[#EEF4F5]">
                          Enable browser notifications
                        </button>
                      )}
                    </div>
                  )}
                  <p className="border-b border-[#E5E0D8] px-4 py-2 text-[10px] leading-4 text-[#6C7278]">Alerts are received while this page is open; background push, SMS, and WhatsApp delivery are not configured.</p>
                  {notifications.length ? (
                    <ul className="max-h-[min(60vh,24rem)] divide-y divide-[#E5E0D8] overflow-y-auto">
                      {notifications.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => { setIsNotificationMenuOpen(false); navigate('/citizen'); }}
                            className="w-full px-4 py-3 text-left hover:bg-[#F5F8F8]"
                          >
                            <span className="block text-xs font-bold">{item.title}</span>
                            <span className="mt-1 block text-[11px] leading-relaxed text-[#56636A]">{item.body}</span>
                            <time className="mt-1 block text-[10px] text-[#6C7278]">{new Date(item.createdAt).toLocaleString()}</time>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-6 text-center text-xs text-[#6C7278]">No approved alerts yet.</p>
                  )}
                </section>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSaarthiOpen(true)}
              className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 border border-[#FFF0B0] bg-[#F6E7A8] px-3 text-[11px] font-bold text-[#17202A] shadow-sm hover:bg-[#EBD98C]"
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              <span>VayuGati Saarthi</span>
            </button>

            {profile ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDashboardRedirect}
                  className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded bg-[#D9532F] px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#BF4422] cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="capitalize">{translate(`${dashboardRole} dashboard`)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignOutConfirmOpen(true)}
                  className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded border border-[#1E293B] bg-[#09101F] px-3 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded bg-[#D9532F] px-3 text-xs font-bold tracking-wide text-white shadow-sm transition-all hover:bg-[#BF4422] cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden border-b border-[#D8C66F] bg-[#F6E7A8] py-1 text-[#17202A]" aria-label="VayuGati updates">
        <p className="vayugati-marquee-track inline-block whitespace-nowrap px-4 text-[11px] font-semibold">
          VayuGati public nowcast dashboard&nbsp;&nbsp;•&nbsp;&nbsp;Check authorized IMD/NDMA channels for current warnings&nbsp;&nbsp;•&nbsp;&nbsp;For emergencies, call 112&nbsp;&nbsp;•&nbsp;&nbsp;Scenario and archive views are not live warnings&nbsp;&nbsp;•&nbsp;&nbsp;VayuGati public nowcast dashboard&nbsp;&nbsp;•&nbsp;&nbsp;Check authorized IMD/NDMA channels for current warnings&nbsp;&nbsp;•&nbsp;&nbsp;For emergencies, call 112&nbsp;&nbsp;•&nbsp;&nbsp;
        </p>
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
      <VayuGatiSaarthi isOpen={isSaarthiOpen} onClose={() => setIsSaarthiOpen(false)} />
    </header>
  );
}
