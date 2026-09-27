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

const DASHBOARD_TRANSLATIONS = {
  hi: {
    'citizen dashboard': 'नागरिक डैशबोर्ड', 'officer dashboard': 'अधिकारी डैशबोर्ड', 'admin dashboard': 'प्रशासक डैशबोर्ड',
    'Feed transparency': 'डेटा स्रोत पारदर्शिता', 'About Data Sources': 'डेटा स्रोतों के बारे में', 'Provider site': 'प्रदाता वेबसाइट',
    'NWP Model': 'एनडब्ल्यूपी मॉडल', 'DB update #': 'डेटाबेस अपडेट #', 'Latency:': 'विलंबता:', 'Not measured': 'मापा नहीं गया',
    'DRAFTS PENDING': 'मसौदे लंबित', 'Draw Hazard Zone': 'खतरा क्षेत्र बनाएं', 'Drawing Active (Click Map)': 'ड्रॉइंग सक्रिय (मानचित्र पर क्लिक करें)',
    'Close Ring': 'बहुभुज बंद करें', 'Center': 'केंद्र', 'GIS Raster & Vector Layers': 'GIS रास्टर और वेक्टर परतें', '5-Layer Fusion': '5-परत फ्यूजन',
    'Radar Reflectivity (dBZ)': 'रडार परावर्तन (dBZ)', 'INSAT Cloud Tops (IR CTT)': 'INSAT बादल शीर्ष (IR CTT)',
    'Lightning Strike Heatmap': 'आकाशीय बिजली हीटमैप', 'Optical Flow Track Cones': 'ऑप्टिकल फ्लो ट्रैक क्षेत्र', 'Active Warning Polygons': 'सक्रिय चेतावनी बहुभुज',
    'Executive Command Node': 'कार्यकारी कमान केंद्र', 'District Administrator:': 'जिला प्रशासक:', 'Download DDMA (CSV)': 'DDMA डाउनलोड करें (CSV)',
    'Print Executive Brief': 'कार्यकारी सारांश प्रिंट करें', 'District Hazard Overview': 'जिला जोखिम अवलोकन',
    'Institutional Alert Dispatches': 'संस्थागत चेतावनी प्रेषण', 'Emergency Pre-positioning Map': 'आपातकालीन पूर्व-तैनाती मानचित्र',
    'User & Forecaster Access Table': 'उपयोगकर्ता एवं पूर्वानुमानकर्ता सूची', 'Active Red Alert Sector': 'सक्रिय रेड अलर्ट क्षेत्र',
    'At-Risk Population': 'जोखिमग्रस्त जनसंख्या', 'Cell Broadcast Alert Pushed': 'सेल ब्रॉडकास्ट चेतावनी भेजी गई',
    'Mobilized SDRF Assets': 'तैनात SDRF संसाधन', 'Radar Ingestion Health': 'रडार डेटा प्राप्ति स्थिति',
    'District Key Infrastructure & Utility Directives': 'जिला प्रमुख अवसंरचना एवं सेवा निर्देश',
    'View Full Institutional Control Console': 'पूरा संस्थागत नियंत्रण कक्ष देखें',
    'Authorized User & Duty Forecaster Directory': 'अधिकृत उपयोगकर्ता एवं ड्यूटी पूर्वानुमानकर्ता सूची',
    'Approve': 'स्वीकृत करें', 'Edit': 'संपादित करें', 'Revoke': 'रद्द करें', 'Reactivate': 'पुनः सक्रिय करें', 'Cancel': 'रद्द करें', 'Save User Changes': 'उपयोगकर्ता परिवर्तन सहेजें',
  },
  mr: {
    'citizen dashboard': 'नागरिक डॅशबोर्ड', 'officer dashboard': 'अधिकारी डॅशबोर्ड', 'admin dashboard': 'प्रशासक डॅशबोर्ड',
    'Feed transparency': 'डेटा स्रोत पारदर्शकता', 'About Data Sources': 'डेटा स्रोतांविषयी', 'Provider site': 'प्रदाता संकेतस्थळ',
    'NWP Model': 'NWP मॉडेल', 'DB update #': 'डेटाबेस अद्यतन #', 'Latency:': 'विलंब:', 'Not measured': 'मोजलेले नाही',
    'DRAFTS PENDING': 'मसुदे प्रलंबित', 'Draw Hazard Zone': 'धोका क्षेत्र काढा', 'Drawing Active (Click Map)': 'रेखाटन सुरू (नकाशावर क्लिक करा)',
    'Close Ring': 'बहुभुज बंद करा', 'Center': 'केंद्र', 'GIS Raster & Vector Layers': 'GIS रास्टर आणि व्हेक्टर स्तर', '5-Layer Fusion': '5-स्तरीय फ्यूजन',
    'Radar Reflectivity (dBZ)': 'रडार परावर्तन (dBZ)', 'INSAT Cloud Tops (IR CTT)': 'INSAT ढगांचे शिखर (IR CTT)',
    'Lightning Strike Heatmap': 'वीज प्रहार हीटमॅप', 'Optical Flow Track Cones': 'ऑप्टिकल फ्लो ट्रॅक क्षेत्र', 'Active Warning Polygons': 'सक्रिय इशारा बहुभुज',
    'Executive Command Node': 'कार्यकारी नियंत्रण केंद्र', 'District Administrator:': 'जिल्हा प्रशासक:', 'Download DDMA (CSV)': 'DDMA डाउनलोड करा (CSV)',
    'Print Executive Brief': 'कार्यकारी सारांश छापा', 'District Hazard Overview': 'जिल्हा धोका आढावा',
    'Institutional Alert Dispatches': 'संस्थात्मक इशारा प्रेषण', 'Emergency Pre-positioning Map': 'आपत्कालीन पूर्वतैनाती नकाशा',
    'User & Forecaster Access Table': 'वापरकर्ता आणि अंदाजकर्ते यादी', 'Active Red Alert Sector': 'सक्रिय रेड अलर्ट क्षेत्र',
    'At-Risk Population': 'धोक्यातील लोकसंख्या', 'Cell Broadcast Alert Pushed': 'सेल ब्रॉडकास्ट इशारा पाठवला',
    'Mobilized SDRF Assets': 'तैनात SDRF साधने', 'Radar Ingestion Health': 'रडार डेटा स्थिती',
    'District Key Infrastructure & Utility Directives': 'जिल्हा प्रमुख पायाभूत सुविधा निर्देश',
    'View Full Institutional Control Console': 'संपूर्ण संस्थात्मक नियंत्रण कक्ष पाहा',
    'Authorized User & Duty Forecaster Directory': 'अधिकृत वापरकर्ता आणि ड्यूटी अंदाजकर्ता यादी',
    'Approve': 'मंजूर करा', 'Edit': 'संपादित करा', 'Revoke': 'रद्द करा', 'Reactivate': 'पुन्हा सक्रिय करा', 'Cancel': 'रद्द करा', 'Save User Changes': 'वापरकर्ता बदल जतन करा',
  },
};

function translateDashboardText(text, language) {
  return DASHBOARD_TRANSLATIONS[language]?.[text] || text;
}

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  // 1. Font Resizer: 'sm' (14px), 'md' (16px), 'lg' (18px)
  const [fontScale, setFontScale] = useState(() => {
    const stored = localStorage.getItem('vayugati_font_scale');
    return ['sm', 'md', 'lg'].includes(stored) ? stored : 'md';
  });

  // 2. High Contrast Tri-Mode: 'default' | 'dark' | 'yellow-navy'
  const [contrastMode, setContrastMode] = useState(() => {
    const stored = localStorage.getItem('vayugati_contrast_mode');
    return ['default', 'dark', 'yellow-navy'].includes(stored) ? stored : 'default';
  });

  // 3. 12-Language Selector
  const [language, setLanguage] = useState(() => {
    const stored = localStorage.getItem('vayugati_lang');
    return ['en', 'hi', 'mr'].includes(stored) ? stored : 'en';
  });

  // 4. Audio Text-to-Speech playing state
  const [isSpeakingAlert, setIsSpeakingAlert] = useState(false);

  // Apply Font Scale to Document Root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-scale-sm', 'font-scale-md', 'font-scale-lg');
    root.classList.add(`font-scale-${fontScale}`);

    root.style.setProperty('--app-font-scale', fontScale === 'sm' ? '1' : fontScale === 'lg' ? '1.25' : '1.125');

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

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem('vayugati_lang', language);
  }, [language]);

  // Apply Language Selection
  const changeLanguage = (code) => {
    if (!['en', 'hi', 'mr'].includes(code)) return;
    setLanguage(code);
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
        translate: (text) => translateDashboardText(text, language),
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
      translate: (text) => text,
      speakText: () => {},
      stopSpeaking: () => {},
      isSpeakingAlert: false,
    };
  }
  return context;
}
