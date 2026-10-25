import INDIA from './india.json';

// 36 states/UTs and their districts (source: Govt. of India directory, via
// github.com/KTBsomen/Indian-state-district-json, MIT). Same file as the backend.
export const STATES = INDIA;

export const findState = (code) => INDIA.find((s) => s.code === code) || null;
export const districtsOf = (code) => findState(code)?.districts || [];
export const findDistrict = (stateCode, districtCode) =>
  districtsOf(stateCode).find((d) => d.code === districtCode) || null;

export function placeLabel(stateCode, districtCode) {
  const s = findState(stateCode);
  const d = s?.districts.find((x) => x.code === districtCode);
  return [d?.name, s?.name].filter(Boolean).join(', ');
}

const norm = (v) =>
  String(v || '')
    .toLowerCase()
    .replace(/\b(district|division|city|urban|rural|nct of|state of)\b/g, '')
    .replace(/[^a-z]/g, '');

// Common spellings that differ between phone map data and the government list
const ALIASES = {
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  calcutta: 'kolkata',
  madras: 'chennai',
  gurgaon: 'gurugram',
  baroda: 'vadodara',
  orissa: 'odisha',
  pondicherry: 'puducherry',
  kutch: 'kachchh',
};
const canon = (v) => {
  const n = norm(v);
  return ALIASES[n] || n;
};

/**
 * Match a phone reverse-geocode result to our state/district codes.
 * Returns { state, district } where either may be null when no confident match.
 */
export function matchGeocode(g) {
  if (!g) return { state: null, district: null };
  const region = canon(g.region);
  const state =
    INDIA.find((s) => canon(s.name) === region) ||
    INDIA.find((s) => region && (canon(s.name).includes(region) || region.includes(canon(s.name))));
  if (!state) return { state: null, district: null };

  const candidates = [g.subregion, g.district, g.city].map(canon).filter(Boolean);
  for (const c of candidates) {
    const exact = state.districts.find((d) => canon(d.name) === c);
    if (exact) return { state: state.code, district: exact.code };
  }
  for (const c of candidates) {
    const loose = state.districts.find((d) => canon(d.name).startsWith(c) || c.startsWith(canon(d.name)));
    if (loose) return { state: state.code, district: loose.code };
  }
  return { state: state.code, district: null };
}
