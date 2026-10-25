import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

// Best-effort phone push through Expo's push service. In-app notifications are
// always stored first, so a push failure never loses the message.
async function sendExpoPush(messages) {
  if (!messages.length) return;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) logger.warn('Expo push failed', { status: res.status });
  } catch (err) {
    logger.warn('Expo push error', { message: err.message });
  }
}

/**
 * Notify one or more users about a complaint.
 * @param {Array<ObjectId|string>} recipientIds Mongo user ids (falsy entries are ignored)
 */
export async function notifyUsers(recipientIds, { type, title, body, complaint }) {
  const ids = [...new Set(recipientIds.filter(Boolean).map(String))];
  if (!ids.length) return;
  try {
    await Notification.insertMany(
      ids.map((recipient) => ({
        recipient,
        type,
        title,
        body,
        relatedComplaint: complaint?._id,
        data: complaint ? { reportId: complaint.reportId, actionUrl: `nagarmitra://complaint/${complaint._id}` } : {},
        delivery: { status: 'sent', sentAt: new Date() },
      }))
    );
    const users = await User.find({ _id: { $in: ids }, expoPushToken: { $exists: true, $ne: '' } }).select('expoPushToken');
    await sendExpoPush(
      users.map((u) => ({
        to: u.expoPushToken,
        title,
        body,
        sound: 'default',
        data: complaint ? { complaintId: String(complaint._id), reportId: complaint.reportId } : {},
      }))
    );
  } catch (err) {
    // Notifications must never break the action that triggered them
    logger.error('notifyUsers failed', { message: err.message, type });
  }
}

/** Notify every active admin of `role` responsible for a state/district. */
export async function notifyRole(role, { state, district }, payload) {
  const q = { role, isActive: true };
  if (role === 'state_admin' || role === 'district_admin') q.state = state;
  if (role === 'district_admin') q.district = district;
  const admins = await User.find(q).select('_id');
  return notifyUsers(admins.map((a) => a._id), payload);
}
