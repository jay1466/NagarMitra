import Complaint from '../models/Complaint.js';
import User from '../models/User.js';
import { notifyUsers, notifyRole } from './notify.js';
import { logger } from '../utils/logger.js';
import {
  DEPARTMENTS,
  departmentFor,
  deadlinesFor,
  locationLabel,
  OPEN_STATUSES,
  ESCALATION_LADDER,
  REMINDER_INTERVAL_HOURS,
  REOPEN_WINDOW_DAYS,
  ROLE_LABELS,
} from '../config/civic.js';

const HOUR = 3600 * 1000;
const deptName = (d) => DEPARTMENTS[d]?.name || d;
const where = (c) => locationLabel(c.state, c.district);

// Allowed staff status changes. Citizens use confirm/reopen instead.
const TRANSITIONS = {
  submitted: ['assigned', 'acknowledged', 'rejected'],
  assigned: ['acknowledged', 'in_progress', 'rejected'],
  acknowledged: ['in_progress', 'resolved', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved: [],
  closed: [],
  rejected: [],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function pushHistory(complaint, status, actor, notes) {
  complaint.statusHistory.push({
    status,
    changedAt: new Date(),
    changedBy: actor?._id,
    byName: actor ? actor.displayName || actor.email : 'System',
    byRole: actor?.role || 'system',
    notes,
  });
}

/**
 * Route a complaint to an officer of its department in its district, choosing the
 * one with the fewest open cases. If none exists the district admin is alerted.
 */
export async function autoAssign(complaint) {
  const officers = await User.find({
    role: 'officer',
    isActive: true,
    department: complaint.department,
    state: complaint.state,
    district: complaint.district,
  }).select('_id displayName email');

  if (!officers.length) {
    await notifyRole('district_admin', complaint, {
      type: 'complaint_escalated',
      title: 'Complaint needs an officer',
      body: `No ${deptName(complaint.department)} officer in ${where(complaint)}. Please assign #${complaint.reportId}.`,
      complaint,
    });
    return null;
  }

  const loads = await Promise.all(
    officers.map((o) => Complaint.countDocuments({ assignedTo: o._id, status: { $in: OPEN_STATUSES } }))
  );
  const officer = officers[loads.indexOf(Math.min(...loads))];
  await assignTo(complaint, officer, null, 'Auto-assigned by department and district');
  return officer;
}

export async function assignTo(complaint, officer, actor, note) {
  complaint.assignedTo = officer._id;
  complaint.assignedAt = new Date();
  if (complaint.status === 'submitted') complaint.status = 'assigned';
  pushHistory(complaint, 'assigned', actor, `${note || 'Assigned'} → ${officer.displayName || officer.email}`);
  await complaint.save();

  await notifyUsers([officer._id], {
    type: 'complaint_assigned',
    title: 'New complaint assigned to you',
    body: `#${complaint.reportId}: ${complaint.category} in ${where(complaint)}. Due ${complaint.dueAt?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    complaint,
  });
}

/** Department, deadlines and routing for a freshly created complaint. */
export async function intake(complaint) {
  complaint.department = departmentFor(complaint.category);
  Object.assign(complaint, deadlinesFor(complaint.category, complaint.priority, complaint.createdAt || new Date()));
  pushHistory(complaint, 'submitted', null, 'Complaint registered');
  await complaint.save();

  await notifyUsers([complaint.userId], {
    type: 'complaint_confirmed',
    title: 'Complaint registered',
    body: `Your report #${complaint.reportId} was sent to ${deptName(complaint.department)}, ${where(complaint)}.`,
    complaint,
  });
  await autoAssign(complaint);
  return complaint;
}

const CITIZEN_MESSAGES = {
  acknowledged: (c) => ['Complaint acknowledged', `An officer has reviewed #${c.reportId} and will act on it.`],
  in_progress: (c) => ['Work started', `Work has started on #${c.reportId}.`],
  resolved: (c) => ['Issue resolved', `#${c.reportId} is marked resolved. Please confirm or reopen it within ${REOPEN_WINDOW_DAYS} days.`],
  rejected: (c) => ['Complaint rejected', `#${c.reportId} was rejected: ${c.rejectionReason || 'see details in the app'}.`],
};

/** Staff status change with validation, history and citizen notification. */
export async function changeStatus(complaint, to, actor, { note, photo } = {}) {
  if (!canTransition(complaint.status, to)) {
    const err = new Error(`Cannot change status from ${complaint.status} to ${to}`);
    err.status = 400;
    throw err;
  }
  const now = new Date();
  complaint.status = to;
  if (to === 'acknowledged') complaint.acknowledgmentDate = now;
  if (to === 'in_progress') complaint.startDate = now;
  if (to === 'resolved') {
    complaint.completionDate = now;
    complaint.resolution = { note, photo, at: now };
  }
  if (to === 'rejected') complaint.rejectionReason = note;
  pushHistory(complaint, to, actor, note);
  await complaint.save();

  const msg = CITIZEN_MESSAGES[to];
  if (msg) {
    const [title, body] = msg(complaint);
    await notifyUsers([complaint.userId], { type: `complaint_${to}`, title, body, complaint });
  }
  return complaint;
}

/**
 * Periodic SLA sweep:
 *  - overdue → remind the assigned officer (repeats every REMINDER_INTERVAL_HOURS)
 *  - further overdue → climb the escalation ladder (district → state → super admin)
 *  - resolved and past the reopen window → close automatically
 */
export async function slaSweep(now = new Date()) {
  const stats = { reminded: 0, escalated: 0, autoClosed: 0 };

  const overdue = await Complaint.find({ status: { $in: OPEN_STATUSES }, dueAt: { $lt: now } }).limit(1000);
  for (const c of overdue) {
    const overdueHours = (now - c.dueAt) / HOUR;
    const step = [...ESCALATION_LADDER].reverse().find((s) => overdueHours >= s.afterHours);

    if (step && c.escalationLevel < step.level) {
      c.escalationLevel = step.level;
      c.escalatedAt = now;
      pushHistory(c, c.status, null, `Escalated to ${ROLE_LABELS[step.role]}: overdue by ${Math.round(overdueHours)}h`);
      await c.save();
      await notifyRole(step.role, c, {
        type: 'complaint_escalated',
        title: `Escalated: #${c.reportId}`,
        body: `${c.category} in ${where(c)} is overdue by ${Math.round(overdueHours)} hours.`,
        complaint: c,
      });
      stats.escalated++;
    }

    if (c.assignedTo && (!c.lastReminderAt || now - c.lastReminderAt >= REMINDER_INTERVAL_HOURS * HOUR)) {
      c.lastReminderAt = now;
      if (c.escalationLevel < 1) c.escalationLevel = 1;
      await c.save();
      await notifyUsers([c.assignedTo], {
        type: 'complaint_reminder',
        title: 'Reminder: complaint overdue',
        body: `#${c.reportId} passed its deadline ${Math.max(1, Math.round(overdueHours))}h ago. Please update it.`,
        complaint: c,
      });
      stats.reminded++;
    }
  }

  const reopenCutoff = new Date(now.getTime() - REOPEN_WINDOW_DAYS * 24 * HOUR);
  const stale = await Complaint.find({ status: 'resolved', completionDate: { $lt: reopenCutoff } }).limit(1000);
  for (const c of stale) {
    c.status = 'closed';
    c.closedAt = now;
    pushHistory(c, 'closed', null, `Auto-closed ${REOPEN_WINDOW_DAYS} days after resolution`);
    await c.save();
    stats.autoClosed++;
  }

  if (stats.reminded || stats.escalated || stats.autoClosed) logger.info('SLA sweep', stats);
  return stats;
}
