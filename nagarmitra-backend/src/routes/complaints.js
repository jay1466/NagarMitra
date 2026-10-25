import { Router } from 'express';
import { sendError, parsePaging, cleanImage } from '../utils/http.js';
import Complaint from '../models/Complaint.js';
import User from '../models/User.js';
import { requireUser, optionalUser, requireRole } from '../middleware/firebaseAuth.js';
import { intake, assignTo, changeStatus, pushHistory } from '../services/workflow.js';
import { covers, isOwner, isStaff, isAdmin, jurisdictionFilter } from '../services/access.js';
import { notifyUsers } from '../services/notify.js';
import {
  ADMIN_ROLES,
  OPEN_STATUSES,
  REOPEN_WINDOW_DAYS,
  CITIZEN_NUDGE_INTERVAL_HOURS,
  deadlinesFor,
  isValidLocation,
} from '../config/civic.js';

const router = Router();

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const HOUR = 3600 * 1000;

function isValidCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

// Fields nobody outside the reporter and the responsible staff should see.
const PRIVATE_FIELDS = ['firebaseUid', 'firebaseEmail', 'userId', 'internalNotes', 'upvotedBy', 'downvotedBy'];

/**
 * Shape a complaint for a specific viewer:
 *  - reporter & covering staff get everything (plus `canAct` flags)
 *  - everyone else gets the public view without reporter identity
 */
function present(doc, me) {
  const c = doc.toObject({ virtuals: true });
  const full = isOwner(me, doc) || covers(me, doc);
  const reporter = doc.userId && typeof doc.userId === 'object' && doc.userId.email ? doc.userId : null;
  c.userId = doc.userId?._id ?? doc.userId;
  if (covers(me, doc) && reporter) {
    c.reporter = { name: reporter.displayName || null, email: reporter.email, phone: reporter.phoneNumber || null };
  }
  if (!full) {
    for (const f of PRIVATE_FIELDS) delete c[f];
    c.statusHistory = (c.statusHistory || []).map(({ status, changedAt, byRole }) => ({ status, changedAt, byRole }));
  }
  const now = Date.now();
  c.isOverdue = OPEN_STATUSES.includes(c.status) && c.dueAt && new Date(c.dueAt).getTime() < now;
  c.isMine = isOwner(me, doc);
  c.canManage = covers(me, doc);
  c.canAssign = isAdmin(me) && covers(me, doc);
  c.canReopen =
    c.isMine &&
    c.status === 'resolved' &&
    c.completionDate &&
    now - new Date(c.completionDate).getTime() < REOPEN_WINDOW_DAYS * 24 * HOUR;
  c.canNudge =
    c.isMine &&
    OPEN_STATUSES.includes(c.status) &&
    (!c.lastCitizenNudgeAt || now - new Date(c.lastCitizenNudgeAt).getTime() >= CITIZEN_NUDGE_INTERVAL_HOURS * HOUR);
  return c;
}

async function loadFor(req, res) {
  const doc = await Complaint.findById(req.params.id)
    .populate('assignedTo', 'displayName email designation department phoneNumber')
    .populate('userId', 'displayName email phoneNumber');
  if (!doc) {
    res.status(404).json({ error: 'Complaint not found' });
    return null;
  }
  return doc;
}

// ---------------------------------------------------------------- create
router.post('/', requireUser(), async (req, res) => {
  try {
    const { title, description, category, priority = 'Medium', address, state, district, location, media = [] } = req.body || {};

    if (!description || !String(description).trim() || !category) {
      return res.status(400).json({ error: 'Description and category are required' });
    }
    if (String(description).trim().length < 10) {
      return res.status(400).json({ error: 'Please describe the issue in at least 10 characters' });
    }
    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    if (!isValidLocation(state, district)) {
      return res.status(400).json({ error: 'Please choose the state and district where the issue is' });
    }

    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    const hasLocation = location != null && isValidCoord(lat, lng);

    const doc = await Complaint.createWithReportId(state, {
      title: title ? String(title).slice(0, 120) : `${category} issue`,
      description: String(description).trim(),
      category,
      priority,
      address: address ? String(address).slice(0, 300) : undefined,
      state,
      district,
      location: hasLocation ? { type: 'Point', coordinates: [lng, lat] } : undefined,
      media: Array.isArray(media) ? media.map(cleanImage).filter(Boolean).slice(0, 3) : [],
      userId: req.me._id,
      firebaseUid: req.me.firebaseUid,
      firebaseEmail: req.me.email,
    });
    await intake(doc);
    req.me.stats.complaintsSubmitted += 1;
    await req.me.save();

    await doc.populate('assignedTo', 'displayName email designation department');
    return res.status(201).json({ complaint: present(doc, req.me), reportId: doc.reportId });
  } catch (err) {
    return sendError(res, err);
  }
});

// ---------------------------------------------------------------- list
// scope=public (default): everyone's complaints, anonymised
// mine=1: the caller's own complaints
// scope=work: the caller's jurisdiction (officer: dept+district, district/state/super admin: their area)
router.get('/', optionalUser(), async (req, res) => {
  try {
    const { category, state, district, status, mine, scope, overdue, escalated, department, assignedTo, unassigned, search } = req.query;
    const { page, limit, skip } = parsePaging(req.query);
    const me = req.me;
    let q = {};

    if (mine === '1') {
      if (!me) return res.status(401).json({ error: 'Please log in to see your reports' });
      q.userId = me._id;
    } else if (scope === 'work') {
      if (!isStaff(me)) return res.status(403).json({ error: 'Only officers and admins can see the work queue' });
      q = { ...jurisdictionFilter(me) };
    }

    // Narrowing filters never widen the jurisdiction set above
    if (category) q.category = String(category);
    if (state && !q.state) q.state = String(state);
    if (district && !q.district) q.district = String(district);
    if (department && !q.department) q.department = String(department);
    if (status === 'open') q.status = { $in: OPEN_STATUSES };
    else if (status === 'done') q.status = { $in: ['resolved', 'closed'] };
    else if (status) q.status = String(status);
    if (overdue === '1') {
      q.status = { $in: OPEN_STATUSES };
      q.dueAt = { $lt: new Date() };
    }
    if (escalated === '1') q.escalationLevel = { $gte: 2 };
    if (unassigned === '1') {
      q.assignedTo = { $exists: false };
      q.status = { $in: OPEN_STATUSES };
    }
    if (isAdmin(me) && assignedTo) q.assignedTo = String(assignedTo);

    // Free-text search: report ID, title, description, address, category — and for
    // staff in their work queue also the reporter's or officer's name/email/phone
    const term = String(search || '').trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const or = [{ reportId: rx }, { title: rx }, { description: rx }, { address: rx }, { category: rx }];
      if (scope === 'work' && isStaff(me)) {
        const people = await User.find({ $or: [{ displayName: rx }, { email: rx }, { phoneNumber: rx }] }).select('_id').limit(200);
        const ids = people.map((p) => p._id);
        if (ids.length) or.push({ userId: { $in: ids } }, { assignedTo: { $in: ids } });
      }
      q.$and = [...(q.$and || []), { $or: or }];
    }

    const sort = scope === 'work' ? { escalationLevel: -1, dueAt: 1 } : { createdAt: -1 };
    const [docs, total] = await Promise.all([
      Complaint.find(q)
        .select('-media -internalNotes')
        .populate('assignedTo', 'displayName designation')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Complaint.countDocuments(q),
    ]);
    return res.json({ items: docs.map((d) => present(d, me)), total, page, limit });
  } catch (err) {
    return sendError(res, err);
  }
});

// ---------------------------------------------------------------- read
router.get('/report/:reportId', optionalUser(), async (req, res) => {
  try {
    const doc = await Complaint.findOne({ reportId: String(req.params.reportId).trim().toUpperCase() })
      .populate('assignedTo', 'displayName email designation department phoneNumber')
      .populate('userId', 'displayName email phoneNumber');
    if (!doc) return res.status(404).json({ error: 'No report found with this ID' });
    return res.json({ complaint: present(doc, req.me) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/:id', optionalUser(), async (req, res) => {
  try {
    const doc = await loadFor(req, res);
    if (!doc) return;
    return res.json({ complaint: present(doc, req.me) });
  } catch (err) {
    return sendError(res, err);
  }
});

// ---------------------------------------------------------------- staff actions
router.post('/:id/status', requireUser(), requireRole('officer', ...ADMIN_ROLES), async (req, res) => {
  try {
    const { status, note, photo } = req.body || {};
    const doc = await loadFor(req, res);
    if (!doc) return;
    if (!covers(req.me, doc)) {
      return res.status(403).json({ error: 'This complaint is outside your jurisdiction' });
    }
    if ((status === 'resolved' || status === 'rejected') && !String(note || '').trim()) {
      return res.status(400).json({
        error: status === 'resolved' ? 'Please describe what was done' : 'Please give a reason for rejecting',
      });
    }
    // Taking action on an unassigned complaint makes the officer its owner
    if (!doc.assignedTo && req.me.role === 'officer') {
      doc.assignedTo = req.me._id;
      doc.assignedAt = new Date();
    }
    await changeStatus(doc, status, req.me, { note: String(note || '').trim() || undefined, photo: cleanImage(photo) });
    await doc.populate('assignedTo', 'displayName email designation department');
    return res.json({ complaint: present(doc, req.me) });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    return sendError(res, err);
  }
});

router.post('/:id/assign', requireUser(), requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const doc = await loadFor(req, res);
    if (!doc) return;
    if (!covers(req.me, doc)) return res.status(403).json({ error: 'This complaint is outside your jurisdiction' });
    if (['resolved', 'closed', 'rejected'].includes(doc.status)) {
      return res.status(400).json({ error: 'This complaint is already finished' });
    }
    const officer = await User.findOne({ _id: req.body?.officerId, role: 'officer', isActive: true });
    if (!officer) return res.status(400).json({ error: 'Please choose a valid officer' });
    if (officer.department !== doc.department || officer.state !== doc.state || officer.district !== doc.district) {
      return res.status(400).json({ error: "That officer doesn't handle this department in this district" });
    }
    await assignTo(doc, officer, req.me, 'Reassigned by admin');
    await doc.populate('assignedTo', 'displayName email designation department');
    return res.json({ complaint: present(doc, req.me) });
  } catch (err) {
    return sendError(res, err);
  }
});

// ---------------------------------------------------------------- citizen actions
router.post('/:id/confirm', requireUser(), async (req, res) => {
  try {
    const doc = await loadFor(req, res);
    if (!doc) return;
    if (!isOwner(req.me, doc)) return res.status(403).json({ error: 'Only the person who reported this can confirm it' });
    if (doc.status !== 'resolved') return res.status(400).json({ error: 'Only resolved complaints can be confirmed' });

    const rating = Number(req.body?.rating);
    if (rating >= 1 && rating <= 5) doc.citizenRating = Math.round(rating);
    doc.status = 'closed';
    doc.closedAt = new Date();
    pushHistory(doc, 'closed', req.me, rating ? `Citizen confirmed the fix (${Math.round(rating)}★)` : 'Citizen confirmed the fix');
    await doc.save();
    req.me.stats.complaintsResolved += 1;
    await req.me.save();

    await notifyUsers([doc.assignedTo?._id], {
      type: 'complaint_closed',
      title: 'Citizen confirmed your fix',
      body: `#${doc.reportId} was closed by the citizen${rating ? ` with ${Math.round(rating)}★` : ''}.`,
      complaint: doc,
    });
    return res.json({ complaint: present(doc, req.me) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/reopen', requireUser(), async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    const doc = await loadFor(req, res);
    if (!doc) return;
    if (!isOwner(req.me, doc)) return res.status(403).json({ error: 'Only the person who reported this can reopen it' });
    if (!present(doc, req.me).canReopen) {
      return res.status(400).json({ error: `Complaints can be reopened within ${REOPEN_WINDOW_DAYS} days of being resolved` });
    }
    if (reason.length < 5) return res.status(400).json({ error: "Please tell us what's still wrong" });

    doc.status = doc.assignedTo ? 'assigned' : 'submitted';
    doc.reopenCount += 1;
    doc.escalationLevel = 0;
    doc.lastReminderAt = undefined;
    Object.assign(doc, deadlinesFor(doc.category, doc.priority));
    pushHistory(doc, 'reopened', req.me, reason);
    await doc.save();

    await notifyUsers([doc.assignedTo?._id], {
      type: 'complaint_reopened',
      title: 'Complaint reopened',
      body: `#${doc.reportId} was reopened by the citizen: "${reason.slice(0, 120)}"`,
      complaint: doc,
    });
    return res.json({ complaint: present(doc, req.me) });
  } catch (err) {
    return sendError(res, err);
  }
});

// Citizen "remind the officer" button, limited to once per CITIZEN_NUDGE_INTERVAL_HOURS
router.post('/:id/nudge', requireUser(), async (req, res) => {
  try {
    const doc = await loadFor(req, res);
    if (!doc) return;
    if (!isOwner(req.me, doc)) return res.status(403).json({ error: 'Only the person who reported this can send a reminder' });
    if (!present(doc, req.me).canNudge) {
      return res.status(429).json({ error: `You can send one reminder every ${CITIZEN_NUDGE_INTERVAL_HOURS} hours` });
    }
    doc.lastCitizenNudgeAt = new Date();
    pushHistory(doc, doc.status, req.me, 'Citizen sent a reminder');
    await doc.save();
    await notifyUsers([doc.assignedTo?._id], {
      type: 'complaint_nudge',
      title: 'Citizen is waiting for an update',
      body: `The reporter of #${doc.reportId} asked for an update.`,
      complaint: doc,
    });
    return res.json({ complaint: present(doc, req.me) });
  } catch (err) {
    return sendError(res, err);
  }
});

export default router;
