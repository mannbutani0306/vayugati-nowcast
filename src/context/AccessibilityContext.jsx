/**
 * @file AccessibilityContext.jsx
 * @description Global Accessibility & GIGW 3.0 Compliance State Provider for VayuGati Nowcast .
 * Capabilities:
 * - Font Resizer: 'sm' (14px), 'md' (16px), 'lg' (18px)
 * - Tri-Mode High Contrast: 'default' (Warm Cream), 'dark' (High-Contrast Dark), 'yellow-navy' (High-Contrast Yellow/Navy)
 * - 12 Scheduled Indian Official Languages Selector with persistence
 * - Web Speech API text-to-speech announcer for emergency bulletins
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'as', label: 'Assamese', native: 'অসমীয়া', flag: '🇮🇳' },
];

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  // 1. Font Resizer: 'sm' (14px), 'md' (16px), 'lg' (18px)
  const [fontScale, setFontScale] = useState(() => {
    return localStorage.getItem('vayugati_font_scale') || 'md';
  });

  // 2. High Contrast Tri-Mode: 'default' | 'dark' | 'yellow-navy'
  const [contrastMode, setContrastMode] = useState(() => {
    return localStorage.getItem('vayugati_contrast_mode') || 'default';
  });

  // 3. 12-Language Selector
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('vayugati_lang') || 'en';
  });

  // 4. Audio Text-to-Speech playing state
  const [isSpeakingAlert, setIsSpeakingAlert] = useState(false);

  // Apply Font Scale to Document Root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-scale-sm', 'font-scale-md', 'font-scale-lg');
    root.classList.add(`font-scale-${fontScale}`);

    if (fontScale === 'sm') root.style.fontSize = '14.5px';
    else if (fontScale === 'lg') root.style.fontSize = '18px';
    else root.style.fontSize = '16px';

    localStorage.setItem('vayugati_font_scale', fontScale);
  }, [fontScale]);

  // Apply Contrast Mode Classes to Document Root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('contrast-default', 'contrast-dark', 'contrast-yellow-navy', 'high-contrast');

    if (contrastMode === 'dark') {
      root.classList.add('contrast-dark', 'high-contrast');
    } else if (contrastMode === 'yellow-navy') {
      root.classList.add('contrast-yellow-navy', 'high-contrast');
    } else {
      root.classList.add('contrast-default');
    }

    localStorage.setItem('vayugati_contrast_mode', contrastMode);
  }, [contrastMode]);

  // Apply Language Selection
  const changeLanguage = (code) => {
    setLanguage(code);
    localStorage.setItem('vayugati_lang', code);
    document.documentElement.lang = code;
  };

  // Cycle Contrast Modes: default -> dark -> yellow-navy -> default
  const cycleContrastMode = () => {
    setContrastMode((prev) => {
      if (prev === 'default') return 'dark';
      if (prev === 'dark') return 'yellow-navy';
      return 'default';
    });
  };

  // Web Speech API Voice synthesis helper
  const speakText = (text) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API is not supported in this browser.');
      return;
    }

    if (isSpeakingAlert) {
      window.speechSynthesis.cancel();
      setIsSpeakingAlert(false);
      return;
    }

    window.speechSynthesis.cancel(); // Stop prior speeches
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Pick Indian English voice or Hindi if available
    const voices = window.speechSynthesis.getVoices();
    const inVoice =
      voices.find((v) => v.lang.includes('en-IN')) ||
      voices.find((v) => v.lang.includes('hi-IN')) ||
      voices[0];
    if (inVoice) utterance.voice = inVoice;

    utterance.onstart = () => setIsSpeakingAlert(true);
    utterance.onend = () => setIsSpeakingAlert(false);
    utterance.onerror = () => setIsSpeakingAlert(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingAlert(false);
    }
  };

  return (
    <AccessibilityContext.Provider
      value={{
        fontScale,
        setFontScale,
        contrastMode,
        setContrastMode,
        cycleContrastMode,
        isHighContrast: contrastMode !== 'default',
        language,
        changeLanguage,
        languages: SUPPORTED_LANGUAGES,
        speakText,
        stopSpeaking,
        isSpeakingAlert,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    return {
      fontScale: 'md',
      setFontScale: () => {},
      contrastMode: 'default',
      setContrastMode: () => {},
      cycleContrastMode: () => {},
      isHighContrast: false,
      language: 'en',
      changeLanguage: () => {},
      languages: SUPPORTED_LANGUAGES,
      speakText: () => {},
      stopSpeaking: () => {},
      isSpeakingAlert: false,
    };
  }
  return context;
}
