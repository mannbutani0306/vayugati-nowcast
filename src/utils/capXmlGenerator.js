/**
 * CAP Protocol Version & Metadata Constants
 */
export const CAP_SPEC_VERSION = '1.2';
export const CAP_SPEC_STANDARD = 'ITU-T Recommendation X.1303 / OASIS CAP v1.2';
export const CAP_XML_NAMESPACE = 'urn:oasis:names:tc:emergency:cap:1.2';

/**
 * Escapes XML special characters for safe node embedding.
 * @param {string|number|null|undefined} unsafe
 * @returns {string}
 */
export function escapeXml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Maps VayuGati alert severity tiers to OASIS CAP v1.2 Standard Urgency, Severity, and Certainty enumerations.
 * @param {string} tier - 'INFO' | 'WATCH' | 'WARNING' | 'SEVERE'
 * @returns {{ urgency: string, severity: string, certainty: string, tierColor: string }}
 */
export function mapTierToCapAttributes(tier = 'INFO') {
  switch (String(tier).toUpperCase()) {
    case 'SEVERE':
      return {
        urgency: 'Immediate',
        severity: 'Extreme',
        certainty: 'Observed',
        tierColor: 'Red',
      };
    case 'WARNING':
      return {
        urgency: 'Immediate',
        severity: 'Severe',
        certainty: 'Likely',
        tierColor: 'Orange',
      };
    case 'WATCH':
      return {
        urgency: 'Expected',
        severity: 'Moderate',
        certainty: 'Possible',
        tierColor: 'Yellow',
      };
    case 'INFO':
    default:
      return {
        urgency: 'Future',
        severity: 'Minor',
        certainty: 'Unlikely',
        tierColor: 'Green',
      };
  }
}

/**
 * Generates ISO 8601 formatted timestamp with IST (+05:30) offset per NDMA SACHET standards.
 * @param {Date|string|number} [date=new Date()]
 * @param {number} [offsetMinutes=0]
 * @returns {string} e.g. "2026-09-26T18:15:00+05:30"
 */
export function formatIstIso8601(date = new Date(), offsetMinutes = 0) {
  const baseDate = date instanceof Date ? date : new Date(date || Date.now());
  const validDate = isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const targetDate = new Date(validDate.getTime() + offsetMinutes * 60 * 1000);

  // IST is UTC + 5 hours 30 minutes
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(targetDate.getTime() + istOffsetMs);

  const pad = (n) => String(n).padStart(2, '0');
  const year = istTime.getUTCFullYear();
  const month = pad(istTime.getUTCMonth() + 1);
  const day = pad(istTime.getUTCDate());
  const hours = pad(istTime.getUTCHours());
  const minutes = pad(istTime.getUTCMinutes());
  const seconds = pad(istTime.getUTCSeconds());

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
}

/**
 * Converts GeoJSON geometry, polygon arrays, or coordinate structures into standard
 * ITU-T X.1303 / CAP v1.2 whitespace-separated "lat,lon lat,lon ..." closed ring format.
 *
 * GeoJSON uses [longitude, latitude], while CAP <polygon> requires "latitude,longitude".
 *
 * @param {object|Array|string} geoJsonOrCoords - GeoJSON Feature/Geometry, Array of coordinates, or CAP string
 * @returns {string} Closed "lat,lon lat,lon ..." polygon coordinate string
 */
export function convertGeoJsonToCapPolygon(geoJsonOrCoords) {
  // Default Shivalik foothills convective corridor polygon
  const DEFAULT_CAP_POLYGON = '30.3450,78.0820 30.3800,78.1400 30.3200,78.1800 30.2900,78.1100 30.3450,78.0820';

  if (!geoJsonOrCoords) {
    return DEFAULT_CAP_POLYGON;
  }

  // If already a CAP string format (e.g. "30.34,78.08 30.38,78.14 ...")
  if (typeof geoJsonOrCoords === 'string') {
    const trimmed = geoJsonOrCoords.trim();
    if (!trimmed) return DEFAULT_CAP_POLYGON;

    // Check if whitespace delimited coordinate pairs
    const pairs = trimmed.split(/\s+/).filter(Boolean);
    if (pairs.length >= 3 && pairs.every((p) => p.includes(','))) {
      // Ensure the polygon is a closed ring (first point equals last point)
      if (pairs[0] !== pairs[pairs.length - 1]) {
        pairs.push(pairs[0]);
      }
      return pairs.join(' ');
    }
    return DEFAULT_CAP_POLYGON;
  }

  let coordsRing = null;

  // Case 1: GeoJSON FeatureCollection
  if (geoJsonOrCoords.type === 'FeatureCollection' && Array.isArray(geoJsonOrCoords.features)) {
    const firstPolyFeature = geoJsonOrCoords.features.find(
      (f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
    );
    if (firstPolyFeature) {
      return convertGeoJsonToCapPolygon(firstPolyFeature.geometry);
    }
  }

  // Case 2: GeoJSON Feature
  if (geoJsonOrCoords.type === 'Feature' && geoJsonOrCoords.geometry) {
    return convertGeoJsonToCapPolygon(geoJsonOrCoords.geometry);
  }

  // Case 3: GeoJSON Geometry (Polygon or MultiPolygon)
  if (geoJsonOrCoords.type === 'Polygon' && Array.isArray(geoJsonOrCoords.coordinates)) {
    // GeoJSON Polygon coordinates: [ [ [lon, lat], [lon, lat], ... ] ]
    coordsRing = geoJsonOrCoords.coordinates[0];
  } else if (geoJsonOrCoords.type === 'MultiPolygon' && Array.isArray(geoJsonOrCoords.coordinates)) {
    coordsRing = geoJsonOrCoords.coordinates[0]?.[0];
  } else if (Array.isArray(geoJsonOrCoords)) {
    // Case 4: Direct Array
    if (Array.isArray(geoJsonOrCoords[0]) && Array.isArray(geoJsonOrCoords[0][0])) {
      // Nested ring [[[lon, lat], ...]]
      coordsRing = geoJsonOrCoords[0];
    } else {
      coordsRing = geoJsonOrCoords;
    }
  }

  if (!Array.isArray(coordsRing) || coordsRing.length < 3) {
    return DEFAULT_CAP_POLYGON;
  }

  // Transform each point to "lat,lon" with 5 decimal places
  const capPairs = [];
  for (const pt of coordsRing) {
    let lat = null;
    let lon = null;

    if (Array.isArray(pt) && pt.length >= 2) {
      // GeoJSON standard: pt[0] is longitude, pt[1] is latitude
      lon = Number(pt[0]);
      lat = Number(pt[1]);
    } else if (pt && typeof pt === 'object') {
      lat = Number(pt.lat ?? pt.latitude);
      lon = Number(pt.lon ?? pt.lng ?? pt.longitude);
    }

    if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
      capPairs.push(`${lat.toFixed(5)},${lon.toFixed(5)}`);
    }
  }

  if (capPairs.length < 3) {
    return DEFAULT_CAP_POLYGON;
  }

  // CAP requirement: closed ring (first coordinate equals last coordinate)
  if (capPairs[0] !== capPairs[capPairs.length - 1]) {
    capPairs.push(capPairs[0]);
  }

  return capPairs.join(' ');
}

// Alias for convenience and backward compatibility
export const geoJsonToCapPolygon = convertGeoJsonToCapPolygon;

/**
 * Hindi hazard terminology dictionary for official disaster management broadcasts.
 */
const HAZARD_TRANSLATIONS_HI = {
  CLOUDBURST: {
    event: 'तीव्र बादल फटना एवं आकस्मिक जलभराव',
    title: 'अत्यंत तीव्र मेघ गर्जन व बादल फटने की चेतावनी',
    instruction: 'तत्काल सुरक्षित पक्के भवनों में शरण लें। पहाड़ी नदी-नालों, जलधाराओं और रपतों से तुरंत दूर रहें। निचले पुलों को पार न करें।',
  },
  HAIL: {
    event: 'भीषण ओलावृष्टि एवं चक्रवाती हवाएं',
    title: 'भीषण ओलावृष्टि व आंधी की चेतावनी',
    instruction: 'खुले मैदानों से हटें और वाहनों को सुरक्षित शेड में पार्क करें। टीन शेड व कमजोर ढांचों से सुरक्षित दूरी बनाए रखें।',
  },
  HAILSTORM: {
    event: 'भीषण ओलावृष्टि एवं चक्रवाती हवाएं',
    title: 'भीषण ओलावृष्टि व आंधी की चेतावनी',
    instruction: 'खुले मैदानों से हटें और वाहनों को सुरक्षित शेड में पार्क करें। टीन शेड व कमजोर ढांचों से सुरक्षित दूरी बनाए रखें।',
  },
  SEVERE_THUNDERSTORM: {
    event: 'भीषण आंधी-तूफान एवं आकाशीय बिजली',
    title: 'भीषण आंधी-तूफान व आकाशीय बिजली की चेतावनी',
    instruction: 'आकाशीय बिजली के दौरान पेड़ों के नीचे अथवा धातु के खंभों के पास न खड़े हों। बिजली के उपकरणों को अनप्लग करें।',
  },
  FLASH_FLOOD: {
    event: 'आकस्मिक बाढ़ एवं तीव्र पर्वतीय जलप्रवाह',
    title: 'आकस्मिक बाढ़ की गंभीर चेतावनी',
    instruction: 'ऊंचे सुरक्षित स्थानों पर तत्काल जाएं। बाढ़ प्रभावित जलस्रोतों व कटाव वाले ढलानों से दूर रहें।',
  },
  HIGH_WINDS: {
    event: 'अति तीव्र आंधी व अंधड़ (गस्ट्स)',
    title: 'अति तीव्र आंधी व तेज अंधड़ की चेतावनी',
    instruction: 'कमजोर पेड़ों, होर्डिंग्स तथा बिजली की तारों से दूर रहें। यात्रा स्थगित रखें।',
  },
  CONVECTIVE_STORM: {
    event: 'भीषण संवहनी मौसमीय हलचल',
    title: 'संवहनी तूफान व तेज वर्षा की चेतावनी',
    instruction: 'सुरक्षित पक्के भवनों में रहें तथा स्थानीय आपदा प्रबंधन प्राधिकरण (DDMA) के निर्देशों का पालन करें।',
  },
};

/**
 * Generates an official ITU-T X.1303 / NDMA CAP v1.2 XML string for a verified alert object.
 *
 * Requirements satisfied:
 * 1. Standard Root Fields: <identifier>, <sender>, <sent>, <status>, <msgType>, <scope>, <restriction>, <info>
 * 2. Multi-Lingual <info> Blocks: Dual language for English (en-IN) and Hindi (hi-IN)
 *    Fields: <category>, <event>, <urgency>, <severity>, <certainty>, <headline>, <description>, <instruction>, <area>
 * 3. Spatial Area Tag: Polygon coordinates formatted in standard "lat,lon lat,lon ..."
 *
 * @param {object} alert - The approved convective alert object
 * @param {object} [options={}] - Custom configuration overrides
 * @returns {string} XML text conforming to ITU-T X.1303 & NDMA CAP v1.2
 */
export function generateCapXml(alert, options = {}) {
  const now = new Date();
  const alertId = alert?.id || `ALERT-${Date.now()}`;
  const cleanId = String(alertId).replace(/[^A-Za-z0-9_-]/g, '');

  // 1. Root Standard Fields
  const identifier =
    options.identifier ||
    alert?.capIdentifier ||
    `IN-IMD-NOWCAST-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${cleanId}`;

  const sender =
    options.sender ||
    alert?.sender ||
    'dutyforecaster.nowcast@imd.gov.in';

  // Sent timestamp in ISO 8601 with +05:30 IST offset
  const sent = options.sent || formatIstIso8601(alert?.sentDate || alert?.createdTimestamp || now);

  // Status: Actual | Exercise | System | Test | Draft
  let status = options.status || alert?.capStatus || alert?.status || 'Actual';
  if (['APPROVED', 'ACTIVE', 'SENT', 'VERIFIED'].includes(String(status).toUpperCase())) {
    status = 'Actual';
  } else if (String(status).toUpperCase() === 'DRAFT') {
    status = 'Draft';
  }

  // MsgType: Alert | Update | Cancel | Ack | Error
  const msgType = options.msgType || alert?.msgType || 'Alert';

  // Scope: Public | Restricted | Private
  const scope = options.scope || alert?.scope || 'Public';

  // Restriction: Required field under ITU-T X.1303 / NDMA CAP specifications
  const restriction =
    options.restriction ||
    alert?.restriction ||
    (scope === 'Public'
      ? 'None. Public Dissemination Authorized via NDMA SACHET Early Warning Network'
      : 'Restricted Distribution: SDRF / DDMA / AAI Air Traffic Control Nodes Only');

  // Severity Tier & Attributes
  const tier = alert?.tier || 'WARNING';
  const { urgency, severity, certainty } = mapTierToCapAttributes(tier);

  // Effective and Expiration timestamps
  const leadMinutes = alert?.leadTimeMinutes || (tier === 'SEVERE' ? 60 : 120);
  const effective = sent;
  const expires = options.expires || formatIstIso8601(now, leadMinutes);

  // Hazard, Headline, Description, Instruction
  const hazardType = alert?.hazardType || 'CONVECTIVE_STORM';
  const eventNameEn = `Severe Convective Weather (${hazardType.replace(/_/g, ' ')})`;
  const areaDescEn = alert?.targetGrid || alert?.sector || alert?.areaDesc || 'Dehradun-Rishikesh Convective Corridor';

  const headlineEn =
    options.headline ||
    alert?.headline ||
    `${tier} NOWCAST: ${hazardType.replace(/_/g, ' ')} Core Approaching ${areaDescEn}`;

  const descriptionEn =
    alert?.aiDraftedText ||
    alert?.message ||
    alert?.description ||
    `Severe convective storm cell with intense radar reflectivity detected in ${areaDescEn}. High risk of localized downpours, severe lightning, and squally surface winds.`;

  const instructionEn =
    alert?.instruction ||
    (tier === 'SEVERE'
      ? 'Move indoors immediately into reinforced concrete structures away from streams and low bridges. Avoid open grounds and metallic objects.'
      : 'Stay informed through local DDMA broadcasts and avoid travel on exposed mountain passes and flood-prone roads.');

  // Spatial Polygon parsing from GeoJSON or coordinates
  const polygonSource = alert?.geometry || alert?.polygon || alert?.coordinates || alert?.cellGeometry;
  const capPolygon = convertGeoJsonToCapPolygon(polygonSource);

  // Hindi localization data
  const hazardHi = HAZARD_TRANSLATIONS_HI[hazardType.toUpperCase()] || HAZARD_TRANSLATIONS_HI.CONVECTIVE_STORM;
  const eventNameHi = alert?.eventHindi || hazardHi.event;
  const areaDescHi = alert?.areaDescHindi || areaDescEn;
  const headlineHi =
    alert?.headlineHindi ||
    `${tier === 'SEVERE' ? 'रेड' : tier === 'WARNING' ? 'ऑरेंज' : 'येलो'} चेतावनी: ${areaDescHi} में ${hazardHi.title}`;

  const radarDbz = alert?.maxReflectivityDbz || alert?.dbz || 58.0;
  const rainRate = alert?.expectedRainfallRateMmHr || alert?.rainRateMmHr || 75;
  const windGust = alert?.windGustKmh || 65;
  const cellId = alert?.cellId || 'CELL-IMD-01';

  const descriptionHi =
    alert?.descriptionHindi ||
    `डॉपलर मौसम रडार द्वारा ${areaDescHi} में ${radarDbz} dBZ का तीव्र संवहनी सेल दर्ज किया गया है। अगले ${leadMinutes} मिनट में भारी वर्षा (${rainRate} मिमी/घंटा) एवं ${windGust} किमी/घंटा की गति से आंधी की सम्भावना है।`;

  const instructionHi = alert?.instructionHindi || hazardHi.instruction;

  // Build ITU-T X.1303 / NDMA CAP v1.2 XML Document
  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${escapeXml(identifier)}</identifier>
  <sender>${escapeXml(sender)}</sender>
  <sent>${escapeXml(sent)}</sent>
  <status>${escapeXml(status)}</status>
  <msgType>${escapeXml(msgType)}</msgType>
  <source>VayuGati Nowcast  (IMD MoES / NDMA Integrated Node)</source>
  <scope>${escapeXml(scope)}</scope>
  <restriction>${escapeXml(restriction)}</restriction>
  <code xml:lang="en">IPAWS-1.0</code>
  <code xml:lang="en">NDMA-CAP-INDIA-1.2</code>
  <code xml:lang="en">ITU-T-X.1303</code>
  <note>Forecaster Human-in-the-Loop Verified. Official NDMA SACHET / CAP v1.2 Convective Dispatch.</note>

  <!-- MULTI-LINGUAL INFO BLOCK 1: ENGLISH (en-IN) -->
  <info>
    <language>en-IN</language>
    <category>Met</category>
    <event>${escapeXml(eventNameEn)}</event>
    <urgency>${escapeXml(urgency)}</urgency>
    <severity>${escapeXml(severity)}</severity>
    <certainty>${escapeXml(certainty)}</certainty>
    <eventCode>
      <valueName>SAME</valueName>
      <value>SVR</value>
    </eventCode>
    <eventCode>
      <valueName>WMO-Hazard</valueName>
      <value>THUNDERSTORM-HAIL-CLOUDBURST</value>
    </eventCode>
    <effective>${escapeXml(effective)}</effective>
    <onset>${escapeXml(effective)}</onset>
    <expires>${escapeXml(expires)}</expires>
    <senderName>India Meteorological Department, Ministry of Earth Sciences</senderName>
    <headline>${escapeXml(headlineEn)}</headline>
    <description>${escapeXml(descriptionEn)}</description>
    <instruction>${escapeXml(instructionEn)}</instruction>
    <web>https://sachet.ndma.gov.in/</web>
    <contact>State Disaster Emergency Operation Centre (SEOC) 1070 / NDMA Control Room 011-26701728</contact>

    <!-- METEOROLOGICAL TELEMETRY PARAMETERS -->
    <parameter>
      <valueName>DopplerReflectivityDBZ</valueName>
      <value>${escapeXml(radarDbz)}</value>
    </parameter>
    <parameter>
      <valueName>RainfallRateMmHr</valueName>
      <value>${escapeXml(rainRate)}</value>
    </parameter>
    <parameter>
      <valueName>SurfaceWindGustsKmh</valueName>
      <value>${escapeXml(windGust)}</value>
    </parameter>
    <parameter>
      <valueName>ForecastLeadTimeMinutes</valueName>
      <value>${escapeXml(leadMinutes)}</value>
    </parameter>
    <parameter>
      <valueName>ConvectiveCellID</valueName>
      <value>${escapeXml(cellId)}</value>
    </parameter>
    <parameter>
      <valueName>ModelAlgorithm</valueName>
      <value>VayuGati-ConvLSTM-Fusion-v3</value>
    </parameter>

    <!-- SPATIAL AREA TAG -->
    <area>
      <areaDesc>${escapeXml(areaDescEn)}</areaDesc>
      <polygon>${escapeXml(capPolygon)}</polygon>
      <geocode>
        <valueName>Census2011-LGD</valueName>
        <value>050100</value>
      </geocode>
    </area>
  </info>

  <!-- MULTI-LINGUAL INFO BLOCK 2: HINDI (hi-IN) -->
  <info>
    <language>hi-IN</language>
    <category>Met</category>
    <event>${escapeXml(eventNameHi)}</event>
    <urgency>${escapeXml(urgency)}</urgency>
    <severity>${escapeXml(severity)}</severity>
    <certainty>${escapeXml(certainty)}</certainty>
    <eventCode>
      <valueName>SAME</valueName>
      <value>SVR</value>
    </eventCode>
    <eventCode>
      <valueName>WMO-Hazard</valueName>
      <value>THUNDERSTORM-HAIL-CLOUDBURST</value>
    </eventCode>
    <effective>${escapeXml(effective)}</effective>
    <onset>${escapeXml(effective)}</onset>
    <expires>${escapeXml(expires)}</expires>
    <senderName>भारत मौसम विज्ञान विभाग, पृथ्वी विज्ञान मंत्रालय</senderName>
    <headline>${escapeXml(headlineHi)}</headline>
    <description>${escapeXml(descriptionHi)}</description>
    <instruction>${escapeXml(instructionHi)}</instruction>
    <web>https://sachet.ndma.gov.in/</web>
    <contact>राष्ट्रीय आपदा प्रबंधन प्राधिकरण (NDMA) / राज्य आपातकालीन संचालन केंद्र (SEOC): 1070</contact>

    <!-- METEOROLOGICAL TELEMETRY PARAMETERS -->
    <parameter>
      <valueName>DopplerReflectivityDBZ</valueName>
      <value>${escapeXml(radarDbz)}</value>
    </parameter>
    <parameter>
      <valueName>RainfallRateMmHr</valueName>
      <value>${escapeXml(rainRate)}</value>
    </parameter>
    <parameter>
      <valueName>SurfaceWindGustsKmh</valueName>
      <value>${escapeXml(windGust)}</value>
    </parameter>
    <parameter>
      <valueName>ForecastLeadTimeMinutes</valueName>
      <value>${escapeXml(leadMinutes)}</value>
    </parameter>
    <parameter>
      <valueName>ConvectiveCellID</valueName>
      <value>${escapeXml(cellId)}</value>
    </parameter>
    <parameter>
      <valueName>ModelAlgorithm</valueName>
      <value>VayuGati-ConvLSTM-Fusion-v3</value>
    </parameter>

    <!-- SPATIAL AREA TAG -->
    <area>
      <areaDesc>${escapeXml(areaDescHi)}</areaDesc>
      <polygon>${escapeXml(capPolygon)}</polygon>
      <geocode>
        <valueName>Census2011-LGD</valueName>
        <value>050100</value>
      </geocode>
    </area>
  </info>
</alert>`;
}

/**
 * Initiates a browser client file download of the official NDMA CAP v1.2 XML document.
 * Institutional export function for Duty Forecasters to dispatch to SEOC/DDMA/NDMA.
 *
 * @param {object} alert - Alert object
 * @param {string} [filename] - Custom file name (optional)
 * @returns {string} The generated XML document string
 */
export function downloadCapXmlFile(alert, filename) {
  const xmlContent = generateCapXml(alert);

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const safeId = String(alert?.id || 'ALERT').replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestampStr = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const targetFilename = filename || `CAP_NDMA_SACHET_${safeId}_${timestampStr}.xml`;

    const link = document.createElement('a');
    link.href = url;
    link.download = targetFilename;
    link.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return xmlContent;
}

/**
 * Validates whether an XML string strictly contains all required ITU-T X.1303 & NDMA CAP v1.2 elements.
 *
 * Checks standard root tags:
 * - <identifier>, <sender>, <sent>, <status>, <msgType>, <scope>, <restriction>, <info>
 * Checks dual-language info tags:
 * - <language>, <category>, <event>, <urgency>, <severity>, <certainty>, <headline>, <description>, <instruction>, <area>, <polygon>
 *
 * @param {string} xmlString - Generated or ingested XML text
 * @returns {{ isValid: boolean, missingElements: string[], hasEnglishInfo: boolean, hasHindiInfo: boolean }}
 */
export function validateCapXml(xmlString) {
  if (typeof xmlString !== 'string' || !xmlString.trim()) {
    return {
      isValid: false,
      missingElements: ['<alert>'],
      hasEnglishInfo: false,
      hasHindiInfo: false,
    };
  }

  const requiredStandardFields = [
    '<alert',
    '<identifier>',
    '<sender>',
    '<sent>',
    '<status>',
    '<msgType>',
    '<scope>',
    '<restriction>',
    '<info>',
    '<category>',
    '<event>',
    '<urgency>',
    '<severity>',
    '<certainty>',
    '<headline>',
    '<description>',
    '<instruction>',
    '<area>',
    '<polygon>',
  ];

  const missingElements = requiredStandardFields.filter((tag) => !xmlString.includes(tag));
  const hasEnglishInfo = xmlString.includes('<language>en-IN</language>') || xmlString.includes('<language>en</language>');
  const hasHindiInfo = xmlString.includes('<language>hi-IN</language>') || xmlString.includes('<language>hi</language>');

  return {
    isValid: missingElements.length === 0 && hasEnglishInfo && hasHindiInfo,
    missingElements,
    hasEnglishInfo,
    hasHindiInfo,
  };
}
