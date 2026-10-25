import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';
import { firebaseAdmin } from '../config/firebaseAdmin.js';

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

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// Phone push straight through Firebase Cloud Messaging (works while the app is closed).
async function sendFcm(users, { title, body, complaint }) {
  const targets = users.filter((u) => u.fcmToken);
  if (!targets.length || !firebaseAdmin?.apps?.length) return;
  try {
    const res = await firebaseAdmin.messaging().sendEachForMulticast({
      tokens: targets.map((u) => u.fcmToken),
      notification: { title, body },
      data: complaint ? { complaintId: String(complaint._id), reportId: String(complaint.reportId || '') } : {},
      android: { priority: 'high', notification: { channelId: 'nagarmitra', color: '#FF4500', sound: 'default' } },
    });
    // Forget tokens of phones that uninstalled the app or logged out
    const dead = res.responses
      .map((r, i) => (!r.success && DEAD_TOKEN_CODES.has(r.error?.code) ? targets[i]._id : null))
      .filter(Boolean);
    if (dead.length) await User.updateMany({ _id: { $in: dead } }, { $unset: { fcmToken: 1 } });
  } catch (err) {
    logger.warn('FCM push error', { message: err.message });
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
    const users = await User.find({
      _id: { $in: ids },
      $or: [{ fcmToken: { $exists: true, $ne: '' } }, { expoPushToken: { $exists: true, $ne: '' } }],
    }).select('fcmToken expoPushToken');
    await sendFcm(users, { title, body, complaint });
    await sendExpoPush(
      users.filter((u) => u.expoPushToken && !u.fcmToken).map((u) => ({
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
