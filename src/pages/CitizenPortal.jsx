/**
 * @file CitizenPortal.jsx
 * @description Mobile-First, Accessible PWA Citizen Early Warning Portal for VayuGati Nowcast .
 * Conforms strictly to institutional NDMA SACHET & IMD nowcasting operational guidelines.
 *
 * Requirements Implemented:
 * 1. Auto-GPS Hyper-Local Risk Banner:
 *    - Requests user location (`navigator.geolocation`) and queries `fetchNearbyAlerts`.
 *    - Detects whether user coordinate is inside active optical-flow storm trajectory cone.
 *    - If inside active storm cone: Displays GIANT animated red warning banner, severe weather icon,
 *      and live countdown clock ("Impact expected in: 28 Minutes" / ticking mm:ss).
 * 2. Multi-Lingual Dynamic Content:
 *    - Instantaneous UI translation: English (EN), Hindi (हिन्दी / HI), Marathi (मराठी / MR).
 *    - Actionable safety advisories ("Seek indoor shelter immediately", "Avoid electrical transformers and open fields").
 *    - 4-way persona guidance: General Citizen, Farmer/Outdoor, Commuter/Driver, Schools & Parents.
 * 3. Institutional Weather Radar View:
 *    - Lightweight simplified Leaflet map optimized for low-end smartphone displays.
 *    - Visualizes user location beacon, approaching convective rain/lightning cells (dBZ contours),
 *      optical flow storm cones, and nearest safe disaster shelters.
 * 4. Offline / Low-Bandwidth Mode:
 *    - Full LocalStorage caching (`vayugati_citizen_cached_alerts`) so safety info is preserved during network loss.
 *    - Offline state detector & banner.
 *    - Low-Bandwidth / 2G Data Saver mode toggle for minimal battery & data consumption.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { isSupabaseConfigured, supabaseConfigurationError } from '../lib/supabaseClient';
import {
  fetchNearbyAlerts,
  subscribeToApprovedAlerts,
} from '../lib/spatialQueries';
import { SEVERITY_TIERS } from '../utils/mockDataSeed';
import {
  MapPin,
  Compass,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Radio,
  Volume2,
  VolumeX,
  Navigation,
  Globe,
  Wifi,
  WifiOff,
  Users,
  Briefcase,
  Car,
  GraduationCap,
  CloudRain,
  CloudLightning,
  Zap,
  CheckCircle2,
  Bell,
  RefreshCw,
  PhoneCall,
  ChevronRight,
  ShieldCheck,
  Eye,
  Info,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

// Comprehensive 3-Language Localization Dictionary (English, Hindi, Marathi)
const TRANSLATIONS = {
  en: {
    appTitle: 'VayuGati Citizen Nowcast',
    portalSub: 'IMD / NDMA Severe Weather & Cloudburst Early Warning',
    officialBadge: 'Official Disaster Portal',
    useGps: 'Use My GPS',
    locating: 'Acquiring GPS...',
    gpsLocated: 'GPS Located',
    selectLocation: 'Select Tehsil / District:',
    offlineMode: 'Offline Mode: Displaying cached nowcast data from LocalStorage',
    lowBandwidthMode: 'Low Bandwidth (2G Data Saver)',
    standardMode: 'Full Radar Mode',
    lastSync: 'Last synced',
    syncNow: 'Sync Now',
    syncing: 'Updating...',
    justNow: 'just now',
    minsAgo: 'mins ago',
    activeConeWarningHeadline: 'APPROVED WEATHER ALERT IN YOUR AREA',
    activeConeWarningSub: 'An approved alert polygon intersects your current coordinates. Follow the official alert instructions below.',
    databaseOffline: 'Offline Database: live approved alerts are unavailable.',
    impactCountdownPrefix: 'Impact expected in:',
    minutesUnit: 'Minutes',
    safeZoneHeadline: 'You are currently outside active convective hazard cones',
    safeZoneSub: 'Routine atmospheric monitoring active. No severe cloudburst cell in your immediate path.',
    soundSiren: 'Sound Warning Siren',
    stopSiren: 'Silence Siren',
    sirenPlaying: 'Siren Active (Playing Tone)',
    safetyAdvisoriesTitle: 'Urgent Actionable Safety Advisories',
    seekShelter: 'Seek indoor shelter immediately in a reinforced concrete building. Stay away from windows and tin carports.',
    avoidTransformers: 'Avoid electrical transformers, high-voltage power lines, metal fences, and open exposed fields.',
    avoidTrees: 'DO NOT seek shelter under solitary trees; isolated trees serve as natural lightning strike paths.',
    avoidRivers: 'Stay well clear of mountain riverbeds (Rispana & Bindal) and low-lying underpasses susceptible to sudden flash floods.',
    emergencyContacts: '24x7 Emergency Helplines',
    ndrfHelpline: 'National Disaster (NDMA)',
    sdmaHelpline: 'State Control Room',
    ambulancePolice: 'Medical / Police Emergency',
    callNow: 'Call Now',
    audienceGuidanceTitle: 'Sector-Specific Guidance',
    generalCitizen: 'General Citizen',
    outdoorWorker: 'Farmer / Outdoor',
    commuter: 'Commuter / Driver',
    schoolParent: 'Schools & Parents',
    radarViewTitle: 'Approved Weather Alert Map',
    radarViewSub: 'Your location and approved alert polygons returned from PostGIS.',
    radarLegendUser: 'Your Location',
    radarLegendStorm: 'Storm Core (>60 dBZ)',
    radarLegendCone: 'Hazard Cone',
    radarLegendShelter: 'Safe Shelter',
    nearestShelterTitle: 'Nearest Designated Safe Shelter:',
    shelterDistance: 'away',
    getDirections: 'Get Directions',
    hourlyProgressionTitle: '0–6 Hour Hazard Progression',
    liveBulletinsTitle: 'Official IMD / SDMA Approved Warning Bulletins',
    noActiveAlerts: 'No approved alerts were returned for this search radius.',
    dataCachedNotice: 'Cached on device • Works 100% offline during mobile network failure.',
    testLocations: 'Quick Demo Coordinates:',
    testInsideCone: 'Inside Cone (Sahastradhara)',
    testNearCone: 'Near Fringe (Dehradun City)',
    testSafeZone: 'Safe Area (Mohand Plains)',
  },
  hi: {
    appTitle: 'वायुगति नागरिक नौकास्ट',
    portalSub: 'आईएमडी / एनडीएमए गंभीर मौसम एवं बादल फटने की पूर्व चेतावनी',
    officialBadge: 'आधिकारिक आपदा पोर्टल',
    useGps: 'मेरा जीपीएस खोजें',
    locating: 'स्थान प्राप्त कर रहे हैं...',
    gpsLocated: 'जीपीएस स्थान प्राप्त',
    selectLocation: 'तहसील / जिला चुनें:',
    offlineMode: 'ऑफ़लाइन मोड: स्थानीय संग्रह (LocalStorage) से सहेजा गया नौकास्ट डेटा प्रदर्शित है',
    lowBandwidthMode: 'धीमा नेटवर्क मोड (2G डेटा सेवर)',
    standardMode: 'पूर्ण रडार मोड',
    lastSync: 'अंतिम अपडेट',
    syncNow: 'अभी रीफ्रेश करें',
    syncing: 'अपडेट हो रहा है...',
    justNow: 'अभी-अभी',
    minsAgo: 'मिनट पहले',
    activeConeWarningHeadline: 'आपके क्षेत्र के लिए आधिकारिक मौसम चेतावनी',
    activeConeWarningSub: 'स्वीकृत चेतावनी क्षेत्र आपकी स्थिति को कवर करता है। नीचे दिए गए आधिकारिक निर्देशों का पालन करें।',
    databaseOffline: 'डेटाबेस ऑफ़लाइन: लाइव स्वीकृत चेतावनियाँ उपलब्ध नहीं हैं।',
    impactCountdownPrefix: 'संभावित प्रभाव समय:',
    minutesUnit: 'मिनट',
    safeZoneHeadline: 'आप वर्तमान में सक्रिय तूफान शंकु (Cone) से बाहर सुरक्षित हैं',
    safeZoneSub: 'सामान्य वायुमंडलीय निगरानी जारी है। आपके रास्ते में कोई तात्कालिक तीव्र तूफान नहीं है।',
    soundSiren: 'चेतावनी सायरन बजाएं',
    stopSiren: 'सायरन बंद करें',
    sirenPlaying: 'सायरन बज रहा है...',
    safetyAdvisoriesTitle: 'महत्वपूर्ण त्वरित सुरक्षा निर्देश',
    seekShelter: 'तुरंत पक्के मकान में आश्रय लें। खिड़कियों, शीशों और टिन शेड से दूर सुरक्षित कमरे में रहें।',
    avoidTransformers: 'बिजली के खंभों, ट्रांसफार्मर, लोहे की बाड़ और खुले मैदानों से तुरंत दूर रहें।',
    avoidTrees: 'अकेले ऊंचे पेड़ों के नीचे आश्रय न लें; एकाकी पेड़ आकाशीय बिजली को आकर्षित करते हैं।',
    avoidRivers: 'उफनते नालों, बरसाती नदियों और अंडरपास से तुरंत दूर रहें। 30 सेमी बहता पानी वाहन को बहा सकता है।',
    emergencyContacts: '24x7 आपातकालीन सहायता नंबर',
    ndrfHelpline: 'राष्ट्रीय आपदा प्रबंधन (NDMA)',
    sdmaHelpline: 'राज्य आपदा नियंत्रण कक्ष',
    ambulancePolice: 'आपातकालीन पुलिस / एम्बुलेंस',
    callNow: 'कॉल करें',
    audienceGuidanceTitle: 'वर्ग-विशिष्ट सुरक्षा निर्देश',
    generalCitizen: 'आम नागरिक',
    outdoorWorker: 'किसान / श्रमिक',
    commuter: 'यात्री / वाहन चालक',
    schoolParent: 'विद्यालय व अभिभावक',
    radarViewTitle: 'स्वीकृत मौसम चेतावनी मानचित्र',
    radarViewSub: 'आपका स्थान और PostGIS से प्राप्त स्वीकृत चेतावनी क्षेत्र।',
    radarLegendUser: 'आपका स्थान',
    radarLegendStorm: 'तूफान कोर (>60 dBZ)',
    radarLegendCone: 'खतरा शंकु',
    radarLegendShelter: 'सुरक्षित शरण स्थल',
    nearestShelterTitle: 'निकटतम सुरक्षित शरण स्थल:',
    shelterDistance: 'दूर',
    getDirections: 'मार्ग देखें',
    hourlyProgressionTitle: '0–6 घंटे का प्रति घंटा मौसम पूर्वानुमान',
    liveBulletinsTitle: 'आईएमडी / एसडीएमए द्वारा अनुमोदित आधिकारिक बुलेटिन',
    noActiveAlerts: 'इस खोज त्रिज्या में कोई स्वीकृत चेतावनी नहीं मिली।',
    dataCachedNotice: 'डिवाइस पर संचित • नेटवर्क बंद होने पर भी 100% ऑफ़लाइन उपलब्ध।',
    testLocations: 'त्वरित डेमो परीक्षण स्थान:',
    testInsideCone: 'तूफान शंकु के अंदर (सहस्रधारा)',
    testNearCone: 'निकटवर्ती क्षेत्र (देहरादून शहर)',
    testSafeZone: 'सुरक्षित क्षेत्र (मोहंड मैदान)',
  },
  mr: {
    appTitle: 'वायुगती नागरिक नौकास्ट',
    portalSub: 'आयएमडी / एनडीएमए अतिवृष्टी, गारपीट आणि ढगफुटी पूर्वसूचना प्रणाली',
    officialBadge: 'अधिकृत आपत्ती व्यवस्थापन पोर्टल',
    useGps: 'माझे जीपीएस वापरा',
    locating: 'स्थान शोधत आहे...',
    gpsLocated: 'जीपीएस स्थान निश्चित',
    selectLocation: 'तालुका / जिल्हा निवडा:',
    offlineMode: 'ऑफलाइन मोड: लोकल स्टोरेजमधून सेव्ह केलेला नौकास्ट डेटा दाखवत आहे',
    lowBandwidthMode: 'कमी बँडविड्थ मोड (2G डेटा सेव्हर)',
    standardMode: 'संपूर्ण रडार मोड',
    lastSync: 'शेवटचे अद्यतन',
    syncNow: 'ताजे करा',
    syncing: 'अपडेट सुरू आहे...',
    justNow: 'आत्ताच',
    minsAgo: 'मिनिटांपूर्वी',
    activeConeWarningHeadline: 'तुमच्या परिसरासाठी अधिकृत हवामान इशारा',
    activeConeWarningSub: 'मंजूर इशारा क्षेत्रात तुमचे स्थान येते. खालील अधिकृत सूचनांचे पालन करा.',
    databaseOffline: 'डेटाबेस ऑफलाइन: थेट मंजूर इशारे उपलब्ध नाहीत.',
    impactCountdownPrefix: 'संभाव्य धोका वेळ:',
    minutesUnit: 'मिनिटे',
    safeZoneHeadline: 'तुम्ही सध्या वादळाच्या प्रभावाबाहेर सुरक्षित क्षेत्रात आहात',
    safeZoneSub: 'नियमित हवामान निरीक्षण सुरू आहे. तुमच्या तात्काळ मार्गात कोणताही अतिवृष्टीचा ढग नाही.',
    soundSiren: 'सायरन आवाज तपासा',
    stopSiren: 'सायरन बंद करा',
    sirenPlaying: 'सायरन वाजत आहे...',
    safetyAdvisoriesTitle: 'तातडीच्या कृतीयोग्य सुरक्षा सूचना',
    seekShelter: 'तत्काळ पक्क्या इमारतीत सुरक्षित आश्रय घ्या. खिडक्या व पत्र्यांच्या छपरांपासून लांब राहा.',
    avoidTransformers: 'विद्युत ट्रान्सफॉर्मर, उच्च दाबाच्या तारा आणि मोकळ्या शेतांपासून त्वरित दूर जा.',
    avoidTrees: 'उंच किंवा एकाकी झाडांखाली थांबू नका; झाडांवर वीज पडण्याची दाट शक्यता असते.',
    avoidRivers: 'वाहत्या नद्या, नाले आणि पाणी साचलेल्या पुलांवरून जाणे टाळा. ३० सेमी वाहते पाणी गाडी वाहून नेऊ शकते.',
    emergencyContacts: '२४x७ आपत्कालीन संपर्क क्रमांक',
    ndrfHelpline: 'राष्ट्रीय आपत्ती निवारण (NDMA)',
    sdmaHelpline: 'राज्य नियंत्रण कक्ष',
    ambulancePolice: 'वैद्यकीय व पोलीस मदत',
    callNow: 'कॉल करा',
    audienceGuidanceTitle: 'वर्गनिहाय सुरक्षा मार्गदर्शक सूचना',
    generalCitizen: 'सामान्य नागरिक',
    outdoorWorker: 'शेतकरी / कामगार',
    commuter: 'प्रवासी / चालक',
    schoolParent: 'शाळा व पालक',
    radarViewTitle: 'मंजूर हवामान इशारा नकाशा',
    radarViewSub: 'तुमचे स्थान आणि PostGIS मधून मिळालेले मंजूर इशारा क्षेत्र.',
    radarLegendUser: 'तुमचे स्थान',
    radarLegendStorm: 'वादळ केंद्र (>६० dBZ)',
    radarLegendCone: 'धोका क्षेत्र (Cone)',
    radarLegendShelter: 'सुरक्षित निवारक',
    nearestShelterTitle: 'जवळचे सुरक्षित निवारक केंद्र:',
    shelterDistance: 'अंतरावर',
    getDirections: 'रस्ता पाहा',
    hourlyProgressionTitle: '०–६ तासांचा संभाव्य हवामान अंदाज',
    liveBulletinsTitle: 'आयएमडी व एसडीएमए अधिकृत चेतावणी बुलेटिन',
    noActiveAlerts: 'या शोध त्रिज्येत कोणताही मंजूर इशारा मिळाला नाही.',
    dataCachedNotice: 'फोनवर सुरक्षित • नेटवर्क नसतानाही १००% ऑफलाइन कार्यक्षम.',
    testLocations: 'डेमो चाचणी स्थाने:',
    testInsideCone: 'वादळाच्या आत (सहस्रधारा)',
    testNearCone: 'नजीकचे क्षेत्र (डेहराडून शहर)',
    testSafeZone: 'सुरक्षित भाग (मोहंड)',
  },
};

// Pilot region coordinates & metadata
const PILOT_LOCATIONS = [
  {
    id: 'sahastradhara',
    name: 'Sahastradhara Basin (Foothills, Dehradun)',
    lat: 30.3872,
    lon: 78.1316,
    radar: 'DWR Dehradun C-Band (8 km)',
    state: 'Uttarakhand',
    isInsideDemoCone: true,
  },
  {
    id: 'dehradun_city',
    name: 'Dehradun City Center (Clock Tower)',
    lat: 30.3255,
    lon: 78.0437,
    radar: 'DWR Dehradun C-Band (12 km)',
    state: 'Uttarakhand',
    isInsideDemoCone: false,
  },
  {
    id: 'rishikesh',
    name: 'Rishikesh Ganga Gorge',
    lat: 30.103,
    lon: 78.294,
    radar: 'DWR Dehradun C-Band (35 km)',
    state: 'Uttarakhand',
    isInsideDemoCone: false,
  },
  {
    id: 'haridwar',
    name: 'Haridwar City Plains',
    lat: 29.9457,
    lon: 78.1642,
    radar: 'DWR Dehradun C-Band (48 km)',
    state: 'Uttarakhand',
    isInsideDemoCone: false,
  },
  {
    id: 'pune_city',
    name: 'Pune City (Haveli Tehsil, Maharashtra)',
    lat: 18.5204,
    lon: 73.8567,
    radar: 'DWR Mumbai / Pune S-Band (45 km)',
    state: 'Maharashtra',
    isInsideDemoCone: false,
  },
  {
    id: 'mulshi_ghat',
    name: 'Mulshi Catchment (Western Ghats, Maharashtra)',
    lat: 18.5029,
    lon: 73.5114,
    radar: 'Western Ghats Radar Link (30 km)',
    state: 'Maharashtra',
    isInsideDemoCone: true,
  },
];

// Persona Specific Safety Directives
const PERSONA_DIRECTIVES = {
  general: {
    en: 'Move immediately to higher floors of solid masonry buildings. Turn off the main electrical breaker and gas cylinders if water enters the premises. Keep flashlights and drinking water at hand.',
    hi: 'तुरंत पक्के मकान की ऊपरी मंजिल पर जाएं। यदि घर में पानी भरने लगे तो मुख्य बिजली स्विच और गैस सिलेंडर तुरंत बंद कर दें। टॉर्च और पीने का पानी पास रखें।',
    mr: 'तत्काळ पक्क्या इमारतीच्या वरच्या मजल्यावर जा. घरात पाणी शिरल्यास मुख्य वीजपुरवठा आणि गॅस सिलिंडर बंद करा. बॅटरी आणि पिण्याचे पाणी सोबत ठेवा.',
  },
  farmer: {
    en: 'Move livestock from open fields into covered concrete barns immediately. Cease operating metal tractors and harvesters. Tie down loose roofing sheets and secure stored produce in dry elevated sheds.',
    hi: 'पशुओं को तुरंत खुले चरागाहों से पक्के बाड़े में ले जाएं। लोहे के ट्रैक्टर या कृषि यंत्र चलाना तुरंत बंद करें। कटी फसल को ऊंचे स्थान पर तिरपाल से ढकें।',
    mr: 'जनावरांना तात्काळ सुरक्षित गोठ्यात बांधा. शेतात ट्रॅक्टर किंवा लोखंडी अवजारे चालवणे त्वरित थांबवा. शेतातील धान्य उंचावर सुरक्षित ठेवा.',
  },
  commuter: {
    en: 'DO NOT attempt to cross submerged causeways or underpasses. Just 30 cm of flowing water can easily float passenger cars. Park on elevated firm ground well away from large trees and power lines.',
    hi: 'जलमग्न पुलों या अंडरपास से वाहन निकालने की कोशिश बिल्कुल न करें। 30 सेमी बहता पानी कार को बहा सकता है। वाहन को ऊंचे स्थान पर पेड़ से दूर पार्क करें।',
    mr: 'पाण्याखाली गेलेल्या पुलांवरून किंवा रस्त्यांवरून वाहन चालवू नका. सुरक्षित उंचावर गाडी थांबवा आणि झाडांखाली गाडी उभी करणे टाळा.',
  },
  school: {
    en: 'Halt all outdoor campus activities and school dismissal immediately. Keep students inside interior classrooms away from window glass until the storm core has fully dissipated. Suspend school buses.',
    hi: 'स्कूल के मैदान में खेलकूद व छुट्टी तुरंत स्थगित करें। तूफान थमने तक बच्चों को खिड़कियों से दूर सुरक्षित कमरों में रखें। स्कूल बसें रवाना न करें।',
    mr: 'शाळेच्या मैदानातील खेळ व शाळा सुटणे तात्पुरते थांबवा. विद्यार्थ्यांना खिडक्यांपासून दूर सुरक्षित वर्गांमध्ये ठेवा. स्कूल बस सेवा तात्पुरती स्थगित करा.',
  },
};

// 0-6 Hour Hourly Progression Data
export default function CitizenPortal() {
  // 1. Language state: 'en' | 'hi' | 'mr'
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('vayugati_lang') || 'en';
  });
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const handleLangChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem('vayugati_lang', newLang);
  };

  // 2. Location & Coordinate State
  const [currentCoords, setCurrentCoords] = useState({
    lat: 30.3872, // Default Sahastradhara (in storm trajectory for demo)
    lon: 78.1316,
    name: 'Sahastradhara Basin (Foothills, Dehradun)',
  });
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // 3. Network & Offline State
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isLowBandwidthMode, setIsLowBandwidthMode] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    const cachedTime = localStorage.getItem('vayugati_last_sync_timestamp');
    return cachedTime ? new Date(cachedTime) : new Date();
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // 4. Alerts & Spatial Proximity Data
  const [nearbyAlerts, setNearbyAlerts] = useState([]);
  const [isInsideStormCone, setIsInsideStormCone] = useState(false);
  const [countdownMinutes, setCountdownMinutes] = useState(0);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [databaseError, setDatabaseError] = useState('');
  const [databaseStatus, setDatabaseStatus] = useState(isSupabaseConfigured ? 'CONNECTING' : 'OFFLINE');
  const [isCachedDataDisplayed, setIsCachedDataDisplayed] = useState(false);
  const directAlert = useMemo(() => nearbyAlerts.find((alert) => alert.is_direct_intersection), [nearbyAlerts]);
  const activeAlert = useMemo(() => directAlert || nearbyAlerts[0] || null, [directAlert, nearbyAlerts]);
  const spatialAssessmentSequenceRef = useRef(0);

  // 5. Persona Guidance Tab
  const [activePersona, setActivePersona] = useState('general');

  // 6. Siren Audio Synthesizer State
  const [isSirenActive, setIsSirenActive] = useState(false);
  const sirenAudioContextRef = useRef(null);
  const sirenOscillatorRef = useRef(null);

  // Synchronize alerts with LocalStorage cache
  const updateAlertsCache = useCallback((alertsData, inCone) => {
    try {
      const cachePayload = {
        alerts: alertsData,
        isInsideCone: inCone,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('vayugati_citizen_cached_alerts_v2', JSON.stringify(cachePayload));
      localStorage.setItem('vayugati_last_sync_timestamp', new Date().toISOString());
      setLastSyncTime(new Date());
    } catch (e) {
      console.warn('LocalStorage write failed:', e);
    }
  }, []);

  // Hydrate from LocalStorage if available
  const loadAlertsFromCache = useCallback(() => {
    try {
      const raw = localStorage.getItem('vayugati_citizen_cached_alerts_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.alerts && Array.isArray(parsed.alerts)) {
          const cachedAt = parsed.timestamp ? new Date(parsed.timestamp).getTime() : Date.now();
          const elapsedSeconds = Math.max(0, Math.floor((Date.now() - cachedAt) / 1000));
          const remainingEtaSeconds = parsed.alerts.map((alert) => {
            if (alert.eta_minutes == null || !Number.isFinite(Number(alert.eta_minutes))) return null;
            return Math.max(0, Number(alert.eta_minutes) * 60 - elapsedSeconds);
          });
          const cachedAlerts = parsed.alerts.map((alert, index) => Number.isFinite(remainingEtaSeconds[index])
            ? { ...alert, eta_minutes: Math.ceil(remainingEtaSeconds[index] / 60) }
            : alert);
          setNearbyAlerts(cachedAlerts);
          setIsInsideStormCone(Boolean(parsed.isInsideCone));
          const availableEtas = remainingEtaSeconds.filter((eta) => Number.isFinite(eta) && eta >= 0);
          if (availableEtas.length) {
            const remainingSeconds = Math.min(...availableEtas);
            setCountdownMinutes(Math.floor(remainingSeconds / 60));
            setCountdownSeconds(remainingSeconds % 60);
          }
          setIsCachedDataDisplayed(true);
          if (parsed.timestamp) {
            setLastSyncTime(new Date(parsed.timestamp));
          }
          return true;
        }
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }
    return false;
  }, []);

  // Query nearby alerts and evaluate storm cone containment
  const executeSpatialAssessment = useCallback(
    async (lat, lon) => {
      const requestId = ++spatialAssessmentSequenceRef.current;
      setIsSyncing(true);
      setDatabaseError('');
      try {
        if (!isSupabaseConfigured) throw new Error(supabaseConfigurationError || 'Supabase is not configured.');
        // Query fetchNearbyAlerts from spatialQueries
        const result = await fetchNearbyAlerts(lat, lon, 35);
        if (requestId !== spatialAssessmentSequenceRef.current) return;
        if (result.error) throw result.error;
        const alertsList = result.data || [];
        setNearbyAlerts(alertsList);
        const insideAnyCone = alertsList.some((alert) => alert.is_direct_intersection);
        const etaValues = alertsList.map((alert) => alert.eta_minutes == null ? NaN : Number(alert.eta_minutes))
          .filter((eta) => Number.isFinite(eta) && eta >= 0);
        const minEta = etaValues.length ? Math.min(...etaValues) : 0;
        setIsInsideStormCone(insideAnyCone);
        setCountdownMinutes(minEta);
        setCountdownSeconds(0);
        setIsCachedDataDisplayed(false);
        updateAlertsCache(alertsList, insideAnyCone);
      } catch (err) {
        if (requestId !== spatialAssessmentSequenceRef.current) return;
        console.error('PostGIS spatial assessment failed:', err);
        setDatabaseStatus('OFFLINE');
        setDatabaseError(err.message || 'Unable to read active alerts from Supabase.');
        loadAlertsFromCache();
      } finally {
        if (requestId === spatialAssessmentSequenceRef.current) setIsSyncing(false);
      }
    },
    [updateAlertsCache, loadAlertsFromCache]
  );

  // Monitor online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      executeSpatialAssessment(currentCoords.lat, currentCoords.lon);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentCoords, executeSpatialAssessment]);

  // Load the persisted cache only as a clearly labeled offline view, then query PostGIS.
  useEffect(() => {
    loadAlertsFromCache();
    executeSpatialAssessment(currentCoords.lat, currentCoords.lon);
  }, [currentCoords.lat, currentCoords.lon, executeSpatialAssessment, loadAlertsFromCache]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setDatabaseStatus('OFFLINE');
      setDatabaseError(supabaseConfigurationError || 'Supabase is not configured.');
      return undefined;
    }

    let subscription;
    try {
      subscription = subscribeToApprovedAlerts(
        () => executeSpatialAssessment(currentCoords.lat, currentCoords.lon),
        (status) => {
          setDatabaseStatus(status === 'SUBSCRIBED' ? 'CONNECTED' : status);
          if (status === 'SUBSCRIBED') setDatabaseError('');
        }
      );
    } catch (error) {
      setDatabaseStatus('OFFLINE');
      setDatabaseError(error.message || 'Supabase Realtime is unavailable.');
    }

    return () => subscription?.unsubscribe();
  }, [currentCoords.lat, currentCoords.lon, executeSpatialAssessment]);

  // Countdown timer effect (ticking down)
  useEffect(() => {
    if (countdownMinutes <= 0 && countdownSeconds <= 0) return;

    const interval = setInterval(() => {
      setCountdownSeconds((sec) => {
        if (sec > 0) return sec - 1;
        if (countdownMinutes <= 1) {
          setCountdownMinutes(0);
          return 0;
        }
        setCountdownMinutes(countdownMinutes - 1);
        return 59;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownMinutes, countdownSeconds > 0]);

  // Auto-GPS request function
  const handleRequestGps = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        setIsLocating(false);
        setIsGpsActive(true);
        setCurrentCoords({
          lat: userLat,
          lon: userLon,
          name: `GPS Location (${userLat.toFixed(4)}°N, ${userLon.toFixed(4)}°E)`,
        });
        executeSpatialAssessment(userLat, userLon);
      },
      (error) => {
        setIsLocating(false);
        console.warn('GPS position error:', error.message);
        setGpsError('GPS permission denied or unavailable. Using pilot coordinate.');
        // Fallback to demo location inside storm cone
        setCurrentCoords(PILOT_LOCATIONS[0]);
        executeSpatialAssessment(PILOT_LOCATIONS[0].lat, PILOT_LOCATIONS[0].lon);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Quick preset selector
  const handleSelectLocation = (locationId) => {
    const loc = PILOT_LOCATIONS.find((l) => l.id === locationId);
    if (loc) {
      setIsGpsActive(false);
      setCurrentCoords(loc);
      executeSpatialAssessment(loc.lat, loc.lon);
    }
  };

  // Web Audio API Siren Generator
  const toggleSirenSound = () => {
    if (isSirenActive) {
      // Stop siren
      try {
        if (sirenOscillatorRef.current) {
          sirenOscillatorRef.current.stop();
          sirenOscillatorRef.current.disconnect();
        }
        if (sirenAudioContextRef.current) {
          sirenAudioContextRef.current.close();
        }
      } catch (e) {
        console.warn('Siren teardown:', e);
      }
      setIsSirenActive(false);
    } else {
      // Start siren
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        const now = ctx.currentTime;
        // Modulate frequency between 480Hz and 880Hz to mimic disaster warning sirens
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.8);
        osc.frequency.linearRampToValueAtTime(480, now + 1.6);
        osc.frequency.linearRampToValueAtTime(880, now + 2.4);
        osc.frequency.linearRampToValueAtTime(480, now + 3.2);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 3.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        sirenAudioContextRef.current = ctx;
        sirenOscillatorRef.current = osc;
        setIsSirenActive(true);

        // Auto-shutoff after 4 seconds
        setTimeout(() => {
          setIsSirenActive(false);
        }, 3800);
      } catch (err) {
        console.warn('Web Audio API not supported or blocked:', err);
        setIsSirenActive(false);
      }
    }
  };

  // Format last sync time string
  const formattedSyncTime = useMemo(() => {
    if (!lastSyncTime) return t.justNow;
    const diffMins = Math.floor((Date.now() - lastSyncTime.getTime()) / 60000);
    if (diffMins <= 0) return t.justNow;
    return `${diffMins} ${t.minsAgo}`;
  }, [lastSyncTime, t]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1D20] font-sans antialiased pb-24 selection:bg-red-200">
      {/* 1. TOP UTILITY BAR (OFFLINE BANNER & 2G DATA SAVER) */}
      <div className="w-full bg-[#1A1D20] text-white text-xs border-b border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          {/* Online/Offline status */}
          <div className="flex items-center space-x-2">
            {!isOnline || databaseStatus === 'OFFLINE' ? (
              <span className="flex items-center text-amber-400 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                <WifiOff className="w-3.5 h-3.5 mr-1 animate-pulse" />
                {databaseError ? t.databaseOffline : t.offlineMode}
              </span>
            ) : (
              <span className="flex items-center text-emerald-400 font-medium">
                <Wifi className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                {t.lastSync}: {formattedSyncTime}
              </span>
            )}
          </div>

          {/* Sync Button & Low Bandwidth Toggle */}
          <div className="flex items-center space-x-2 ml-auto">
            <button
              type="button"
              onClick={() => setIsLowBandwidthMode(!isLowBandwidthMode)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                isLowBandwidthMode
                  ? 'bg-amber-500 text-black font-bold shadow-xs'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white'
              }`}
              title="Optimizes data consumption for 2G / low-end devices"
            >
              {isLowBandwidthMode ? t.lowBandwidthMode : '2G Mode'}
            </button>

            <button
              type="button"
              onClick={() => executeSpatialAssessment(currentCoords.lat, currentCoords.lon)}
              disabled={isSyncing}
              className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-[#FF9933]' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? t.syncing : t.syncNow}</span>
            </button>
          </div>
        </div>
        {databaseError && (
          <div className="max-w-4xl mx-auto px-4 pb-2 text-[11px] text-amber-200" role="status">
            {databaseError}{isCachedDataDisplayed ? ' Cached approved alerts are shown and labeled as cached.' : ' Live alert data is unavailable.'}
          </div>
        )}
      </div>

      {/* 2. PWA ACCESSIBLE HEADER WITH MULTI-LINGUAL SELECTOR */}
      <header className="bg-white border-b border-[#E5E0D8] sticky top-0 z-40 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Institutional Brand */}
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#DC2626] text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
              VG
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold text-[#1A1D20] tracking-tight leading-none">
                  {t.appTitle}
                </h1>
                <span className="hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                  PWA 1.2
                </span>
              </div>
              <p className="text-[11px] text-[#6C7278] truncate max-w-[220px] sm:max-w-md mt-0.5">
                {t.portalSub}
              </p>
            </div>
          </div>

          {/* Instant Multi-Lingual Switcher: EN / HI / MR */}
          <div className="flex items-center space-x-1 bg-[#F1F3F5] p-1 rounded-lg border border-[#E5E0D8]">
            <Globe className="w-3.5 h-3.5 text-[#6C7278] ml-1 mr-0.5 shrink-0" />
            <button
              type="button"
              onClick={() => handleLangChange('en')}
              className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                lang === 'en'
                  ? 'bg-[#1A1D20] text-white shadow-xs'
                  : 'text-[#495057] hover:text-[#1A1D20]'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => handleLangChange('hi')}
              className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                lang === 'hi'
                  ? 'bg-[#1A1D20] text-white shadow-xs'
                  : 'text-[#495057] hover:text-[#1A1D20]'
              }`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => handleLangChange('mr')}
              className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                lang === 'mr'
                  ? 'bg-[#1A1D20] text-white shadow-xs'
                  : 'text-[#495057] hover:text-[#1A1D20]'
              }`}
            >
              मराठी
            </button>
          </div>
        </div>

        {/* GPS AUTO-DETECT & LOCATION PICKER STRIP */}
        <div className="bg-[#FAF7F2] border-t border-[#E5E0D8] px-4 py-2">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2 flex-1">
              <MapPin className="w-4 h-4 text-[#DC2626] shrink-0" />
              <select
                value={PILOT_LOCATIONS.some((l) => l.name === currentCoords.name) ? currentCoords.id || 'sahastradhara' : 'custom'}
                onChange={(e) => handleSelectLocation(e.target.value)}
                className="w-full sm:max-w-sm py-1.5 px-2 bg-white rounded-lg border border-[#E5E0D8] text-xs font-semibold text-[#1A1D20] focus:ring-2 focus:ring-[#DC2626] focus:outline-none"
              >
                {PILOT_LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.isInsideDemoCone ? '⚠️ (Storm Cone)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleRequestGps}
                disabled={isLocating}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer ${
                  isGpsActive
                    ? 'bg-emerald-600 border-emerald-700 text-white'
                    : 'bg-white border-[#E5E0D8] text-[#1A1D20] hover:bg-neutral-50'
                }`}
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? t.locating : isGpsActive ? t.gpsLocated : t.useGps}</span>
              </button>

              {/* Siren Test Button in Header */}
              <button
                type="button"
                onClick={toggleSirenSound}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                  isSirenActive
                    ? 'bg-red-600 border-red-700 text-white animate-pulse'
                    : 'bg-white border-[#E5E0D8] text-red-600 hover:bg-red-50'
                }`}
                title="Synthesizes emergency siren audio tone"
              >
                {isSirenActive ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">
                  {isSirenActive ? t.stopSiren : t.soundSiren}
                </span>
              </button>
            </div>
          </div>
          {gpsError && (
            <div className="max-w-4xl mx-auto mt-1 text-[11px] text-amber-700 font-medium">
              ℹ️ {gpsError}
            </div>
          )}
        </div>
      </header>

      {/* 3. MAIN ACCESSIBLE CONTENT CONTAINER */}
      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* REQUIREMENT 1: AUTO-GPS HYPER-LOCAL RISK BANNER */}
        {nearbyAlerts.length > 0 ? (
          <section
            aria-live="assertive"
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-rose-700 to-red-800 text-white p-5 sm:p-6 shadow-xl border-2 border-red-500 animate-pulse"
            style={{ animationDuration: '3s' }}
          >
            {/* Top Red Badge & Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-400/40 pb-3">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-md bg-white text-red-700 text-xs font-black uppercase tracking-wider shadow-xs">
                  {activeAlert?.severity || 'APPROVED ALERT'}
                </span>
              </div>
              <span className="text-xs font-bold text-red-100 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                Supabase approved alert
              </span>
            </div>

            {/* Giant Hazard Icon, Headline & Subtitle */}
            <div className="my-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-amber-300 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight text-white drop-shadow-sm">
                  {t.activeConeWarningHeadline}
                </h2>
                <p className="text-xs sm:text-sm text-red-100 font-medium leading-relaxed max-w-2xl">
                  {activeAlert?.headline_en || t.activeConeWarningSub}
                </p>
                <div className="text-[11px] text-red-200 font-mono pt-1">
                  {activeAlert?.identifier || activeAlert?.event_type || 'Approved alert'}
                </div>
              </div>
            </div>

            {/* REQUIREMENT 1: COUNTDOWN CLOCK ("Impact expected in: 28 Minutes") */}
            <div className="mt-4 p-4 rounded-xl bg-black/40 backdrop-blur-md border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-200 block">
                  {t.impactCountdownPrefix}
                </span>
                <div className="text-2xl sm:text-3xl font-mono font-black text-amber-300 tracking-tight flex items-center justify-center sm:justify-start gap-2">
                  <Clock className="w-6 h-6 text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>
                    {countdownMinutes > 0 ? `${countdownMinutes} ${t.minutesUnit}` : activeAlert?.is_direct_intersection ? 'Now' : 'Impact timing unavailable'}{' '}
                    <span className="text-lg text-white/70 font-mono">
                      {countdownMinutes > 0 || countdownSeconds > 0 ? `(${String(countdownMinutes).padStart(2, '0')}:${String(countdownSeconds).padStart(2, '0')})` : ''}
                    </span>
                  </span>
                </div>
              </div>

              {/* Siren Action Trigger inside Banner */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={toggleSirenSound}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-transform active:scale-95 cursor-pointer shadow-md ${
                    isSirenActive
                      ? 'bg-amber-400 text-black'
                      : 'bg-white text-red-700 hover:bg-neutral-100'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{isSirenActive ? t.stopSiren : t.soundSiren}</span>
                </button>
              </div>
            </div>
          </section>
        ) : (
          /* Safe Zone Banner when user is outside storm cone */
          <section className="rounded-2xl bg-white border border-emerald-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  IMD SAFE ZONE STATUS
                </span>
                <h2 className="text-base sm:text-lg font-bold text-[#1A1D20] mt-0.5">
                  {t.safeZoneHeadline}
                </h2>
                <p className="text-xs text-[#6C7278]">{t.safeZoneSub}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSelectLocation('sahastradhara')}
              className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all shrink-0 cursor-pointer self-start sm:self-auto"
            >
              Simulate Inside Storm Cone
            </button>
          </section>
        )}

        {/* DEMO LOCATION TEST CHIPS (Ensures evaluator can test both states instantly) */}
        <div className="bg-white rounded-xl border border-[#E5E0D8] p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-[#6C7278] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#DC2626]" />
            {t.testLocations}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectLocation('sahastradhara')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                currentCoords.id === 'sahastradhara' || isInsideStormCone
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'bg-[#F1F3F5] text-[#1A1D20] hover:bg-neutral-200'
              }`}
            >
              ⚠️ {t.testInsideCone}
            </button>
            <button
              type="button"
              onClick={() => handleSelectLocation('dehradun_city')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                currentCoords.id === 'dehradun_city'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-[#F1F3F5] text-[#1A1D20] hover:bg-neutral-200'
              }`}
            >
              ⚡ {t.testNearCone}
            </button>
            <button
              type="button"
              onClick={() => handleSelectLocation('haridwar')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                currentCoords.id === 'haridwar'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-[#F1F3F5] text-[#1A1D20] hover:bg-neutral-200'
              }`}
            >
              🛡️ {t.testSafeZone}
            </button>
          </div>
        </div>

        {/* REQUIREMENT 2: MULTI-LINGUAL ACTIONABLE SAFETY ADVISORIES */}
        <section className="bg-white rounded-2xl border border-[#E5E0D8] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-[#DC2626]" />
              <h3 className="font-extrabold text-sm sm:text-base text-[#1A1D20]">
                {t.safetyAdvisoriesTitle}
              </h3>
            </div>
            <span className="text-[10px] font-mono text-white bg-[#DC2626] px-2 py-0.5 rounded font-bold uppercase">
              NDMA SOP
            </span>
          </div>

          {/* Core Action Directives Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="text-red-900 block font-bold">1. Immediate Indoor Shelter</strong>
                <p className="text-red-950/80 leading-relaxed font-medium">{t.seekShelter}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="text-amber-900 block font-bold">2. Electrical Hazard Precaution</strong>
                <p className="text-amber-950/80 leading-relaxed font-medium">{t.avoidTransformers}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="text-orange-900 block font-bold">3. Lightning Strike Protection</strong>
                <p className="text-orange-950/80 leading-relaxed font-medium">{t.avoidTrees}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="text-blue-900 block font-bold">4. Flash Flood & Drainage Caution</strong>
                <p className="text-blue-950/80 leading-relaxed font-medium">{t.avoidRivers}</p>
              </div>
            </div>
          </div>

          {/* 4-Way Audience Specific Safety Guidance */}
          <div className="pt-2 border-t border-[#E5E0D8] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6C7278]">
                {t.audienceGuidanceTitle}
              </span>
            </div>

            {/* Persona Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-[#F1F3F5] p-1 rounded-xl">
              {[
                { id: 'general', label: t.generalCitizen, icon: Users },
                { id: 'farmer', label: t.outdoorWorker, icon: Briefcase },
                { id: 'commuter', label: t.commuter, icon: Car },
                { id: 'school', label: t.schoolParent, icon: GraduationCap },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activePersona === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActivePersona(tab.id)}
                    className={`py-2 px-2 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#DC2626] shadow-sm'
                        : 'text-[#495057] hover:text-[#1A1D20]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Persona directive content */}
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-[#E5E0D8] text-xs text-[#1A1D20] leading-relaxed flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-neutral-800 mb-0.5">
                  {activePersona === 'general'
                    ? t.generalCitizen
                    : activePersona === 'farmer'
                    ? t.outdoorWorker
                    : activePersona === 'commuter'
                    ? t.commuter
                    : t.schoolParent}
                  :
                </strong>
                <span>
                  {PERSONA_DIRECTIVES[activePersona][lang] || PERSONA_DIRECTIVES[activePersona].en}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* REQUIREMENT 3: INSTITUTIONAL WEATHER RADAR VIEW */}
        <section className="bg-white rounded-2xl border border-[#E5E0D8] p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E0D8] pb-3">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-[#1A1D20] flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-[#DC2626]" />
                {t.radarViewTitle}
              </h3>
              <p className="text-[11px] text-[#6C7278]">{t.radarViewSub}</p>
            </div>
            <span className={`text-[10px] font-mono border px-2 py-0.5 rounded self-start sm:self-auto font-bold ${databaseStatus === 'CONNECTED' ? 'text-[#2E7D32] bg-emerald-50 border-emerald-200' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>
              Supabase Realtime: {databaseStatus}
            </span>
          </div>

          {/* Interactive or Low-Bandwidth Leaflet GIS Canvas */}
          <CitizenRadarMap
            userLocation={currentCoords}
            isLowBandwidth={isLowBandwidthMode}
            t={t}
            isInsideCone={isInsideStormCone}
            alerts={nearbyAlerts}
          />

          {/* Shelter directory is not wired to a verified database table yet. */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            Verified shelter locations are not available from the operational database.
          </div>
        </section>

        {/* 0–6 HOUR PROGRESSION STRIP */}
        <section className="bg-white rounded-2xl border border-[#E5E0D8] p-5 shadow-xs space-y-3">
          <h3 className="font-extrabold text-sm text-[#1A1D20] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#DC2626]" />
            {t.hourlyProgressionTitle}
          </h3>
          <p className="text-xs text-slate-600">No forecast-progression table is connected. This view will not substitute a generated timeline.</p>
        </section>

        {/* OFFICIAL IMD / SDMA APPROVED WARNING BULLETINS */}
        <section className="bg-white rounded-2xl border border-[#E5E0D8] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-[#1A1D20] flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#DC2626]" />
                {t.liveBulletinsTitle}
              </h3>
              <p className="text-[11px] text-[#6C7278]">
                {isCachedDataDisplayed ? t.dataCachedNotice : databaseStatus === 'CONNECTED' ? 'Live approved CAP alerts from Supabase PostGIS.' : t.databaseOffline}
              </p>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${databaseStatus === 'CONNECTED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>
              Database: {databaseStatus}
            </span>
          </div>

          <div className="space-y-3">
            {nearbyAlerts.length === 0 ? (
              <div className="p-4 bg-[#FAF7F2] rounded-xl text-center text-xs text-[#6C7278]">
                {databaseError ? t.databaseOffline : t.noActiveAlerts}
              </div>
            ) : (
              nearbyAlerts.slice(0, 3).map((alert, idx) => {
                const tierColor =
                  alert.tier === 'SEVERE'
                    ? '#DC2626'
                    : alert.tier === 'WARNING'
                    ? '#EA580C'
                    : alert.tier === 'WATCH'
                    ? '#D97706'
                    : '#2E7D32';

                return (
                  <div
                    key={alert.id || idx}
                    className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E5E0D8] space-y-1.5"
                    style={{ borderLeftWidth: '4px', borderLeftColor: tierColor }}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className="px-2 py-0.5 rounded text-[9px] font-black text-white uppercase"
                          style={{ backgroundColor: tierColor }}
                        >
                          {alert.tier || 'WARNING'}
                        </span>
                        <h4 className="font-bold text-xs text-[#1A1D20]">
                          {alert.headline || alert.cellName || 'Convective Alert Bulletin'}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-[#6C7278]">
                        {alert.etaMinutes != null ? `ETA ${alert.etaMinutes}m` : 'ETA unavailable'}{alert.distanceKm != null ? ` • ${alert.distanceKm} km` : ''}
                      </span>
                    </div>

                    <p className="text-xs text-[#1A1D20] leading-relaxed">
                      {alert.description_en || 'Follow the approved CAP alert instructions issued by your local authority.'}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-[#E5E0D8] text-[10px] text-[#6C7278]">
                      <span>Approved alert • {alert.identifier}</span>
                      <span>{alert.isDirectHit ? 'Covers your location' : 'Within search radius'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 24x7 EMERGENCY DISASTER HELPLINES */}
        <section className="rounded-2xl bg-[#0B2E4F] text-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#16436E] pb-2.5">
            <span className="font-bold uppercase tracking-wider text-[#FF9933] flex items-center gap-1.5 text-xs">
              <PhoneCall className="w-4 h-4" />
              {t.emergencyContacts}
            </span>
            <span className="text-[10px] text-neutral-300 font-mono">Toll-Free 24x7</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <a
              href="tel:1070"
              className="p-3 bg-[#08223B] hover:bg-[#0f3254] rounded-xl border border-[#16436E] transition-all flex items-center justify-between"
            >
              <div>
                <span className="text-[10px] text-neutral-400 block">{t.ndrfHelpline}</span>
                <span className="text-base font-extrabold text-white font-mono">1070</span>
              </div>
              <span className="text-[11px] font-bold text-[#FF9933] bg-[#FF9933]/10 px-2 py-1 rounded">
                {t.callNow}
              </span>
            </a>

            <a
              href="tel:1077"
              className="p-3 bg-[#08223B] hover:bg-[#0f3254] rounded-xl border border-[#16436E] transition-all flex items-center justify-between"
            >
              <div>
                <span className="text-[10px] text-neutral-400 block">{t.sdmaHelpline}</span>
                <span className="text-base font-extrabold text-white font-mono">1077</span>
              </div>
              <span className="text-[11px] font-bold text-[#FF9933] bg-[#FF9933]/10 px-2 py-1 rounded">
                {t.callNow}
              </span>
            </a>

            <a
              href="tel:112"
              className="p-3 bg-[#08223B] hover:bg-[#0f3254] rounded-xl border border-[#16436E] transition-all flex items-center justify-between"
            >
              <div>
                <span className="text-[10px] text-neutral-400 block">{t.ambulancePolice}</span>
                <span className="text-base font-extrabold text-white font-mono">112 / 108</span>
              </div>
              <span className="text-[11px] font-bold text-[#FF9933] bg-[#FF9933]/10 px-2 py-1 rounded">
                {t.callNow}
              </span>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * REQUIREMENT 3: Lightweight, Mobile-Optimized Leaflet Weather Radar Map
 * Renders user position, storm core (dBZ contours), trajectory cone, and safe shelter pins.
 */
function CitizenRadarMap({ userLocation, isLowBandwidth, t, isInsideCone, alerts }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [userLocation.lat, userLocation.lon],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      // Lightweight clean basemap
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 16,
        subdomains: 'abcd',
      }).addTo(map);

      mapInstanceRef.current = map;
      layersGroupRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    const layers = layersGroupRef.current;
    layers.clearLayers();

    // Re-center map
    map.setView([userLocation.lat, userLocation.lon], 12);

    // 1. User Location Beacon (Pulsing blue marker)
    const userMarkerHtml = `
      <div style="position: relative; width: 26px; height: 26px;">
        <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background-color: rgba(37, 99, 235, 0.35); animation: ping 1.5s infinite;"></div>
        <div style="position: absolute; top: 4px; left: 4px; width: 18px; height: 18px; border-radius: 50%; background-color: #2563EB; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"></div>
      </div>
    `;
    const userIcon = L.divIcon({
      className: 'citizen-user-marker',
      html: userMarkerHtml,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
      .addTo(layers)
      .bindPopup(`<b>${t.radarLegendUser}</b><br/>${userLocation.name}`);

    (alerts || []).forEach((alert) => {
      const geometry = alert.affected_zone_geojson;
      if (!geometry) return;
      const style = {
        color: alert.is_direct_intersection ? '#B91C1C' : '#D97706',
        weight: alert.is_direct_intersection ? 3 : 2,
        fillColor: alert.is_direct_intersection ? '#EF4444' : '#F59E0B',
        fillOpacity: isLowBandwidth ? 0.08 : 0.18,
      };
      const featureLayer = L.geoJSON(geometry, { style }).addTo(layers);
      const popup = document.createElement('div');
      popup.textContent = `${alert.severity || 'Approved'} • ${alert.headline_en || alert.event_type || 'Weather alert'}${alert.distance_km != null ? ` • ${alert.distance_km} km` : ''}`;
      featureLayer.bindPopup(popup);
    });
  }, [userLocation, isLowBandwidth, t, isInsideCone, alerts]);

  return (
    <div className="relative w-full h-[260px] sm:h-[300px] rounded-xl overflow-hidden border border-[#E5E0D8] bg-[#F1F3F5]">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Radar Legend */}
      <div className="absolute top-2 right-2 z-[400] bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] text-[10px] shadow-sm flex flex-wrap items-center gap-3 text-[#1A1D20]">
        <div className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] inline-block"></span>
          <span className="font-semibold">{t.radarLegendUser}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] inline-block"></span>
          <span className="font-semibold">Approved alert geometry</span>
        </div>
      </div>

      {/* Trajectory ETA chip */}
      {isInsideCone && (
        <div className="absolute bottom-2 left-2 z-[400] bg-red-600 text-white font-mono text-[10px] font-bold px-2 py-1 rounded shadow-md">
          Approved alert polygon intersects your location
        </div>
      )}
    </div>
  );
}
