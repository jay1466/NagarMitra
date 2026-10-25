import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { userAPI } from '../api/client';

// Show alerts even while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let channelReady = false;
// When real push works, the server's push is the alert; polling only updates badges
let pushActive = false;
async function ensureChannel() {
  if (channelReady || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('nagarmitra', {
    name: 'Complaint updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF4500',
  });
  channelReady = true;
}

/**
 * Ask for notification permission and register this phone's Firebase Cloud
 * Messaging token so the server can push while the app is closed.
 * Returns an unsubscribe function for token-refresh updates.
 */
export async function setupNotifications() {
  try {
    await ensureChannel();
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted' || !Device.isDevice || Platform.OS !== 'android') return () => {};
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (token) {
      await userAPI.setPushToken(token, 'fcm');
      pushActive = true;
    }
    // Firebase rotates tokens occasionally; keep the server in sync
    const sub = Notifications.addPushTokenListener(({ data }) => {
      if (data) userAPI.setPushToken(data, 'fcm').catch(() => {});
    });
    return () => sub.remove();
  } catch {
    // No FCM in this build (e.g. Expo Go): in-app polling + local alerts still work
    return () => {};
  }
}

/** Stop pushes to this phone (call before signing out). */
export async function unregisterPush() {
  pushActive = false;
  try {
    await userAPI.setPushToken('', 'fcm');
  } catch {
    // offline: the server prunes dead tokens on the next send
  }
}

/** Show a local alert for a notification the app just fetched from the server. */
export async function showLocalAlert(notification, extraCount = 0) {
  if (pushActive) return;
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: extraCount > 1 ? `${notification.body} (+${extraCount - 1} more)` : notification.body,
        data: { complaintId: notification.relatedComplaint?._id || notification.relatedComplaint || null },
      },
      trigger: Platform.OS === 'android' ? { channelId: 'nagarmitra' } : null,
    });
  } catch {
    // alerts are best-effort
  }
}

/** Call `onOpen(complaintId)` when the user taps a notification. Returns an unsubscribe fn. */
export function onNotificationTap(onOpen) {
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const id = resp?.notification?.request?.content?.data?.complaintId;
    if (id) onOpen(String(id));
  });
  return () => sub.remove();
}
