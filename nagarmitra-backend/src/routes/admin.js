import { Router } from 'express';
import Complaint from '../models/Complaint.js';
import User from '../models/User.js';
import { firebaseAdmin } from '../config/firebaseAdmin.js';
import { requireUser, requireRole } from '../middleware/firebaseAuth.js';
import { sendError, parsePaging } from '../utils/http.js';
import { slaSweep } from '../services/workflow.js';
import { jurisdictionFilter, manageableUsersFilter, assignableRoles } from '../services/access.js';
import { ADMIN_ROLES, DEPARTMENTS, OPEN_STATUSES, findState, isValidLocation } from '../config/civic.js';

const router = Router();
router.use(requireUser(), requireRole(...ADMIN_ROLES));

const countsPipeline = (now) => ({
  total: { $sum: 1 },
  open: { $sum: { $cond: [{ $in: ['$status', OPEN_STATUSES] }, 1, 0] } },
  overdue: { $sum: { $cond: [{ $and: [{ $in: ['$status', OPEN_STATUSES] }, { $lt: ['$dueAt', now] }] }, 1, 0] } },
  escalated: { $sum: { $cond: [{ $and: [{ $in: ['$status', OPEN_STATUSES] }, { $gte: ['$escalationLevel', 2] }] }, 1, 0] } },
  done: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } },
  rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
});

// Overview of the caller's jurisdiction, broken down one level below them
router.get('/overview', async (req, res) => {
  try {
    const me = req.me;
    const now = new Date();
    const scope = jurisdictionFilter(me);
    const groupBy = me.role === 'super_admin' ? '$state' : me.role === 'state_admin' ? '$district' : '$department';

    const [totalsArr, breakdown, byOfficer, officers] = await Promise.all([
      Complaint.aggregate([
        { $match: scope },
        { $group: { _id: null, ...countsPipeline(now), unassigned: { $sum: { $cond: [{ $and: [{ $in: ['$status', OPEN_STATUSES] }, { $not: ['$assignedTo'] }] }, 1, 0] } } } },
      ]),
      Complaint.aggregate([{ $match: scope }, { $group: { _id: groupBy, ...countsPipeline(now) } }, { $sort: { open: -1, total: -1 } }]),
      me.role === 'district_admin'
        ? Complaint.aggregate([
            { $match: { ...scope, assignedTo: { $exists: true } } },
            { $group: { _id: '$assignedTo', ...countsPipeline(now), avgRating: { $avg: '$citizenRating' } } },
          ])
        : [],
      me.role === 'district_admin'
        ? User.find({ role: 'officer', state: me.state, district: me.district }).select('displayName email department designation isActive')
        : [],
    ]);

    const st = findState(me.state);
    const labelFor = (key) => {
      if (me.role === 'super_admin') return findState(key)?.name || key || 'Unknown';
      if (me.role === 'state_admin') return st?.districts.find((d) => d.code === key)?.name || key || 'Unknown';
      return DEPARTMENTS[key]?.name || key || 'Unknown';
    };
    const t = totalsArr[0] || {};
    const perf = Object.fromEntries(byOfficer.map((o) => [String(o._id), o]));

    return res.json({
      level: me.role,
      breakdownBy: me.role === 'super_admin' ? 'state' : me.role === 'state_admin' ? 'district' : 'department',
      totals: {
        all: t.total || 0,
        open: t.open || 0,
        overdue: t.overdue || 0,
        escalated: t.escalated || 0,
        resolved: t.done || 0,
        rejected: t.rejected || 0,
        unassigned: t.unassigned || 0,
      },
      breakdown: breakdown.map((b) => ({
        key: b._id,
        name: labelFor(b._id),
        total: b.total,
        open: b.open,
        overdue: b.overdue,
        escalated: b.escalated,
        done: b.done,
      })),
      officers: officers.map((o) => {
        const p = perf[String(o._id)] || {};
        return {
          id: o._id,
          name: o.displayName || o.email,
          email: o.email,
          department: o.department,
          designation: o.designation,
          isActive: o.isActive,
          open: p.open || 0,
          overdue: p.overdue || 0,
          done: p.done || 0,
          avgRating: p.avgRating ? Math.round(p.avgRating * 10) / 10 : null,
        };
      }),
    });
  } catch (err) {
    return sendError(res, err);
  }
});

// People the caller may manage (strictly below them, inside their jurisdiction)
router.get('/users', async (req, res) => {
  try {
    const { role, department, search, district } = req.query;
    const { limit, skip } = parsePaging(req.query, { defaultLimit: 50, maxLimit: 200 });
    const q = { ...manageableUsersFilter(req.me) };
    if (role) {
      if (!assignableRoles(req.me).includes(role)) return res.json({ users: [] });
      q.role = String(role);
    }
    if (department) q.department = String(department);
    if (district && !q.district) q.district = String(district);
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ displayName: rx }, { email: rx }];
    }
    const users = await User.find(q)
      .select('displayName email role state district department designation isActive createdAt')
      .sort({ role: 1, state: 1, district: 1, displayName: 1 })
      .skip(skip)
      .limit(limit);
    return res.json({ users, assignableRoles: assignableRoles(req.me) });
  } catch (err) {
    return sendError(res, err);
  }
});

// Validate a role + jurisdiction the caller wants to give someone
function checkPlacement(me, { role, state, district, department }) {
  if (!assignableRoles(me).includes(role)) return 'You can only assign roles below your own';
  if (role === 'state_admin' && !findState(state)) return 'Choose a valid state';
  if (['district_admin', 'officer'].includes(role) && !isValidLocation(state, district)) return 'Choose a valid state and district';
  if (role === 'officer' && !DEPARTMENTS[department]) return 'Choose a department for the officer';
  if (me.role === 'state_admin' && state !== me.state) return 'You can only manage your own state';
  if (me.role === 'district_admin' && (state !== me.state || district !== me.district)) return 'You can only manage your own district';
  return null;
}

function applyPlacement(user, { role, state, district, department, designation }) {
  user.role = role;
  user.state = role === 'super_admin' ? undefined : state;
  user.district = ['district_admin', 'officer', 'citizen'].includes(role) ? district : undefined;
  user.department = role === 'officer' ? department : undefined;
  if (designation !== undefined) user.designation = String(designation).slice(0, 80);
}

// Create a staff account (Firebase login + NagarMitra profile)
router.post('/users', async (req, res) => {
  try {
    const { email, name, password, role, state, district, department, designation } = req.body || {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) return res.status(400).json({ error: 'Enter a valid email' });
    if (String(name || '').trim().length < 2) return res.status(400).json({ error: 'Enter the person’s name' });
    if (String(password || '').length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const placement = { role, state: state || req.me.state, district: district || req.me.district, department, designation };
    const problem = checkPlacement(req.me, placement);
    if (problem) return res.status(400).json({ error: problem });

    let fbUser;
    try {
      fbUser = await firebaseAdmin.auth().createUser({ email: email.trim(), password, displayName: name.trim(), emailVerified: true });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') return res.status(409).json({ error: 'An account with this email already exists' });
      throw e;
    }
    const user = new User({ firebaseUid: fbUser.uid, email: email.trim(), displayName: name.trim(), isVerified: true });
    applyPlacement(user, placement);
    await user.save();
    return res.status(201).json({ user });
  } catch (err) {
    return sendError(res, err);
  }
});

// Change someone's role/jurisdiction or deactivate them
router.put('/users/:id', async (req, res) => {
  try {
    const target = await User.findOne({ _id: req.params.id, ...manageableUsersFilter(req.me) });
    if (!target) return res.status(404).json({ error: 'User not found in your jurisdiction' });
    const { role, state, district, department, designation, isActive } = req.body || {};
    const placement = {
      role: role ?? target.role,
      state: state ?? target.state ?? req.me.state,
      district: district ?? target.district ?? req.me.district,
      department: department ?? target.department,
      designation,
    };
    const problem = checkPlacement(req.me, placement);
    if (problem) return res.status(400).json({ error: problem });
    applyPlacement(target, placement);
    if (isActive !== undefined) {
      target.isActive = !!isActive;
      if (target.firebaseUid) await firebaseAdmin.auth().updateUser(target.firebaseUid, { disabled: !isActive }).catch(() => {});
    }
    await target.save();
    return res.json({ user: target });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/sla-sweep', requireRole('super_admin'), async (_req, res) => {
  try {
    return res.json(await slaSweep());
  } catch (err) {
    return sendError(res, err);
  }
});

export default router;
