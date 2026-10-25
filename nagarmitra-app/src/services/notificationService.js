import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
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
 * Ask for notification permission and register this phone for push.
 * Push needs FCM credentials in the EAS build; without them we silently fall
 * back to in-app polling + local alerts, which always work.
 */
export async function setupNotifications() {
  try {
    await ensureChannel();
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted' || !Device.isDevice) return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token) await userAPI.setPushToken(token);
    return true;
  } catch {
    return false;
  }
}

/** Show a local alert for a notification the app just fetched from the server. */
export async function showLocalAlert(notification, extraCount = 0) {
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
