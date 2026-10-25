import { ADMIN_ROLES, ROLES } from '../config/civic.js';

export const isAdmin = (me) => ADMIN_ROLES.includes(me?.role);
export const isStaff = (me) => isAdmin(me) || me?.role === 'officer';

/** Mongo filter for the complaints a staff member is responsible for. */
export function jurisdictionFilter(me) {
  switch (me?.role) {
    case 'super_admin':
      return {};
    case 'state_admin':
      return { state: me.state };
    case 'district_admin':
      return { state: me.state, district: me.district };
    case 'officer':
      return { state: me.state, district: me.district, department: me.department };
    default:
      return null;
  }
}

/** Does `me` have authority over this complaint? */
export function covers(me, complaint) {
  const f = jurisdictionFilter(me);
  if (!f) return false;
  return Object.entries(f).every(([k, v]) => complaint[k] === v);
}

export function isOwner(me, complaint) {
  return !!me && (String(complaint.userId) === String(me._id) || complaint.firebaseUid === me.firebaseUid);
}

/** Mongo filter for the users a staff member may view/manage (strictly below them). */
export function manageableUsersFilter(me) {
  const below = ROLES.slice(ROLES.indexOf(me?.role) + 1);
  switch (me?.role) {
    case 'super_admin':
      return { role: { $in: below } };
    case 'state_admin':
      return { role: { $in: below }, state: me.state };
    case 'district_admin':
      return { role: { $in: below }, state: me.state, district: me.district };
    default:
      return null;
  }
}

/** Roles `me` may assign to someone else (always strictly below their own). */
export function assignableRoles(me) {
  if (!isAdmin(me)) return [];
  return ROLES.slice(ROLES.indexOf(me.role) + 1);
}
