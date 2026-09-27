export function convertGeoJsonToCapPolygon(geoJsonOrCoords) {
  const defaultPolygon = '30.3450,78.0820 30.3800,78.1400 30.3200,78.1800 30.2900,78.1100 30.3450,78.0820';

  if (!geoJsonOrCoords) return defaultPolygon;

  if (typeof geoJsonOrCoords === 'string') {
    const pairs = geoJsonOrCoords.trim().split(/\s+/).filter(Boolean);
    if (pairs.length < 3 || !pairs.every((pair) => pair.includes(','))) return defaultPolygon;
    if (pairs[0] !== pairs[pairs.length - 1]) pairs.push(pairs[0]);
    return pairs.join(' ');
  }

  if (geoJsonOrCoords.type === 'FeatureCollection' && Array.isArray(geoJsonOrCoords.features)) {
    const feature = geoJsonOrCoords.features.find((item) => (
      item.geometry && ['Polygon', 'MultiPolygon'].includes(item.geometry.type)
    ));
    return feature ? convertGeoJsonToCapPolygon(feature.geometry) : defaultPolygon;
  }

  if (geoJsonOrCoords.type === 'Feature' && geoJsonOrCoords.geometry) {
    return convertGeoJsonToCapPolygon(geoJsonOrCoords.geometry);
  }

  let ring = null;
  if (geoJsonOrCoords.type === 'Polygon') ring = geoJsonOrCoords.coordinates?.[0];
  else if (geoJsonOrCoords.type === 'MultiPolygon') ring = geoJsonOrCoords.coordinates?.[0]?.[0];
  else if (Array.isArray(geoJsonOrCoords)) {
    ring = Array.isArray(geoJsonOrCoords[0]?.[0]) ? geoJsonOrCoords[0] : geoJsonOrCoords;
  }

  if (!Array.isArray(ring) || ring.length < 3) return defaultPolygon;
  const pairs = ring.flatMap((point) => {
    let latitude;
    let longitude;
    if (Array.isArray(point) && point.length >= 2) {
      longitude = Number(point[0]);
      latitude = Number(point[1]);
    } else if (point && typeof point === 'object') {
      latitude = Number(point.lat ?? point.latitude);
      longitude = Number(point.lon ?? point.lng ?? point.longitude);
    }
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [`${latitude.toFixed(5)},${longitude.toFixed(5)}`]
      : [];
  });

  if (pairs.length < 3) return defaultPolygon;
  if (pairs[0] !== pairs[pairs.length - 1]) pairs.push(pairs[0]);
  return pairs.join(' ');
}