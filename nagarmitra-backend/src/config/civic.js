// Civic configuration: who handles what, where, and how fast.
// The app reads the non-geographic parts through GET /api/v1/meta and bundles
// the same india.json for offline State → District dropdowns.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// [{ code: 'GJ', name: 'Gujarat', type: 'State', districts: [{ code: 'anand', name: 'Anand' }, ...] }, ...]
export const INDIA = require('./india.json');

export const DEPARTMENTS = {
  roads: { name: 'Roads & Potholes', icon: 'construct' },
  sanitation: { name: 'Sanitation & Waste', icon: 'trash' },
  water: { name: 'Water Supply', icon: 'water' },
  electricity: { name: 'Electricity & Street Lights', icon: 'flash' },
  general: { name: 'General Administration', icon: 'business' },
};

export const CATEGORY_TO_DEPARTMENT = {
  Potholes: 'roads',
  Sanitation: 'sanitation',
  'Waste Management': 'sanitation',
  'Water Supply': 'water',
  'Electricity & Lighting': 'electricity',
  Miscellaneous: 'general',
};

// Jurisdiction hierarchy, most powerful first.
export const ROLES = ['super_admin', 'state_admin', 'district_admin', 'officer', 'citizen'];
export const ADMIN_ROLES = ['super_admin', 'state_admin', 'district_admin'];
export const ROLE_LABELS = {
  super_admin: 'Super Admin (India)',
  state_admin: 'State Master Admin',
  district_admin: 'District Admin',
  officer: 'Department Officer',
  citizen: 'Citizen',
};

// Service levels in hours, modelled on Swachhata-style SLAs:
// every complaint must be acknowledged within `ack`, resolved within `resolve`.
export const SLA_HOURS = {
  Potholes: { ack: 24, resolve: 72 },
  Sanitation: { ack: 12, resolve: 24 },
  'Waste Management': { ack: 12, resolve: 24 },
  'Water Supply': { ack: 12, resolve: 48 },
  'Electricity & Lighting': { ack: 12, resolve: 48 },
  Miscellaneous: { ack: 24, resolve: 120 },
};

// Critical issues get half the time, low priority 1.5x.
export const PRIORITY_FACTOR = { Critical: 0.5, High: 0.75, Medium: 1, Low: 1.5 };

// Escalation ladder once a complaint passes its resolve deadline:
//   level 1: officer reminded (immediately, then every REMINDER_INTERVAL_HOURS)
//   level 2: district admin alerted after +24h
//   level 3: state master admin alerted after +72h
//   level 4: super admin alerted after +7 days
export const ESCALATION_LADDER = [
  { level: 2, afterHours: 24, role: 'district_admin' },
  { level: 3, afterHours: 72, role: 'state_admin' },
  { level: 4, afterHours: 168, role: 'super_admin' },
];
export const REMINDER_INTERVAL_HOURS = 12;
export const CITIZEN_NUDGE_INTERVAL_HOURS = 24;
export const REOPEN_WINDOW_DAYS = 7;

export const OPEN_STATUSES = ['submitted', 'assigned', 'acknowledged', 'in_progress'];

export function departmentFor(category) {
  return CATEGORY_TO_DEPARTMENT[category] || 'general';
}

export function deadlinesFor(category, priority, from = new Date()) {
  const sla = SLA_HOURS[category] || SLA_HOURS.Miscellaneous;
  const factor = PRIORITY_FACTOR[priority] ?? 1;
  const at = (h) => new Date(from.getTime() + h * factor * 3600 * 1000);
  return { acknowledgeDueAt: at(sla.ack), dueAt: at(sla.resolve) };
}

export function findState(code) {
  return INDIA.find((s) => s.code === code) || null;
}

export function findDistrict(stateCode, districtCode) {
  return findState(stateCode)?.districts.find((d) => d.code === districtCode) || null;
}

export function isValidLocation(stateCode, districtCode) {
  return !!findDistrict(stateCode, districtCode);
}

export function locationLabel(stateCode, districtCode) {
  const s = findState(stateCode);
  const d = s?.districts.find((x) => x.code === districtCode);
  return [d?.name, s?.name].filter(Boolean).join(', ');
}
