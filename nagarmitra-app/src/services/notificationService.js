import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userAPI } from '../api/client';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';
const canUsePushNotifications = !isExpoGo && Device.isDevice;

// Configure notification behavior (works in both Expo Go and development builds)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Register for push notifications
      await this.registerForPushNotifications();

      // Set up notification listeners
      this.setupNotificationListeners();

      this.isInitialized = true;
      if (isExpoGo) {
        console.log('✅ NotificationService initialized in Expo Go mode (local notifications only)');
      } else {
        console.log('✅ NotificationService initialized successfully (full functionality)');
      }
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  }

  async registerForPushNotifications() {
    if (!canUsePushNotifications) {
      if (isExpoGo) {
        console.log('⚠️  Push notifications are not supported in Expo Go. Use a development build for full notification support.');
        console.log('📱 Local notifications will still work for testing.');
      } else {
        console.log('Push notifications only work on physical devices');
      }
      return;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permissions not granted');
      return;
    }

    // Get push token (only in development/production builds)
    if (canUsePushNotifications) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        
        this.expoPushToken = tokenData.data;
        console.log('Expo push token:', this.expoPushToken);

        // Save token locally
        await AsyncStorage.setItem('expoPushToken', this.expoPushToken);

        // Send token to backend (when user is logged in)
        await this.sendTokenToBackend();

      } catch (error) {
        console.error('Failed to get push token:', error);
      }
    } else if (isExpoGo) {
      console.log('📡 In Expo Go: Local notifications are available, but push notifications require a development build.');
    }

    // Set notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('nagarmitra', {
        name: 'NagarMitra Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF4500',
        sound: 'default',
      });
    }
  }

  async sendTokenToBackend() {
    if (!this.expoPushToken) return;

    try {
      // This would be called after user authentication
      // For now, we'll just store it locally
      await AsyncStorage.setItem('expoPushToken', this.expoPushToken);
    } catch (error) {
      console.error('Failed to send token to backend:', error);
    }
  }

  setupNotificationListeners() {
    // Listener for notifications that are received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        this.handleNotificationReceived(notification);
      }
    );

    // Listener for users tapping on notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        this.handleNotificationResponse(response);
      }
    );
  }

  handleNotificationReceived(notification) {
    const { title, body, data } = notification.request.content;
    
    // You can customize behavior based on notification type
    if (data?.type === 'complaint_resolved') {
      // Special handling for resolved complaints
      this.showCustomAlert('🎉 Issue Resolved!', body);
    }

    // Update badge count
    this.updateBadgeCount();
  }

  handleNotificationResponse(response) {
    const { notification } = response;
    const { data } = notification.request.content;

    // Navigate to appropriate screen based on notification data
    if (data?.actionUrl) {
      this.handleDeepLink(data.actionUrl);
    } else if (data?.type) {
      this.navigateBasedOnType(data);
    }
  }

  handleDeepLink(url) {
    // Parse deep link and navigate
    console.log('Handling deep link:', url);
    
    if (url.includes('complaint/')) {
      const complaintId = url.split('complaint/')[1];
      // Navigate to complaint details
      // This would need to be integrated with your navigation system
    } else if (url.includes('community/post/')) {
      const postId = url.split('community/post/')[1];
      // Navigate to community post
    }
  }

  navigateBasedOnType(data) {
    switch (data.type) {
      case 'complaint_confirmed':
      case 'complaint_acknowledged':
      case 'complaint_in_progress':
      case 'complaint_resolved':
        // Navigate to Dashboard or specific complaint
        break;
      case 'community_like':
      case 'community_comment':
        // Navigate to Community or specific post
        break;
      default:
        // Navigate to home or notifications screen
        break;
    }
  }

  showCustomAlert(title, message) {
    // You can implement custom alert UI here
    console.log(`${title}: ${message}`);
  }

  async updateBadgeCount() {
    try {
      // Get unread count from API
      const response = await userAPI.getNotifications({ unreadOnly: true });
      const unreadCount = response.unreadCount || 0;
      
      await Notifications.setBadgeCountAsync(unreadCount);
    } catch (error) {
      console.error('Failed to update badge count:', error);
    }
  }

  async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Failed to clear badge:', error);
    }
  }

  // Schedule a local notification
  async scheduleLocalNotification(title, body, data = {}, trigger = null) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: trigger || null, // null means immediate
      });
      
      console.log('Local notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule local notification:', error);
    }
  }

  // Cancel a scheduled notification
  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  // Cancel all scheduled notifications
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  // Get permission status
  async getPermissionStatus() {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  }

  // Request permissions again (useful for settings screen)
  async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  }

  // Clean up listeners
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  // Utility method to test notifications in development
  async sendTestNotification() {
    if (__DEV__) {
      await this.scheduleLocalNotification(
        isExpoGo ? 'Test Local Notification (Expo Go)' : 'Test Notification',
        isExpoGo 
          ? 'This local notification works in Expo Go! Push notifications need a development build.' 
          : 'This is a test notification from NagarMitra',
        { type: 'test' }
      );
    }
  }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;

// Export individual methods for convenience
export const {
  initialize,
  registerForPushNotifications,
  scheduleLocalNotification,
  cancelNotification,
  cancelAllNotifications,
  getPermissionStatus,
  requestPermissions,
  updateBadgeCount,
  clearBadge,
  sendTestNotification,
  cleanup,
} = notificationService;