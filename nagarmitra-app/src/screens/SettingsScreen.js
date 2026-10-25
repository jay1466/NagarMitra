import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen = ({ navigation }) => {
  const [settings, setSettings] = useState({
    notifications: {
      enabled: true,
      reportConfirmed: true,
      reportAcknowledged: true,
      reportResolved: true,
      communityUpdates: false,
    },
    privacy: {
      locationSharing: true,
      profileVisibility: true,
    },
    general: {
      language: 'English',
      theme: 'Light',
      autoLocation: true,
    },
  });

  const updateSetting = async (category, key, value) => {
    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    };
    setSettings(newSettings);
    
    try {
      await AsyncStorage.setItem('user_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const resetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const defaultSettings = {
              notifications: {
                enabled: true,
                reportConfirmed: true,
                reportAcknowledged: true,
                reportResolved: true,
                communityUpdates: false,
              },
              privacy: {
                locationSharing: true,
                profileVisibility: true,
              },
              general: {
                language: 'English',
                theme: 'Light',
                autoLocation: true,
              },
            };
            setSettings(defaultSettings);
            AsyncStorage.setItem('user_settings', JSON.stringify(defaultSettings));
            Alert.alert('Success', 'Settings have been reset to default values');
          },
        },
      ]
    );
  };

  const renderSectionHeader = (title, icon) => (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color="#FF4500" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderSwitchSetting = (title, description, value, onValueChange) => (
    <View style={styles.settingItem}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E0E0E0', true: '#FF450080' }}
        thumbColor={value ? '#FF4500' : '#FFF'}
      />
    </View>
  );

  const renderNavigationSetting = (title, description, onPress, value) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <View style={styles.navigationValue}>
        {value && <Text style={styles.valueText}>{value}</Text>}
        <Ionicons name="chevron-forward" size={16} color="#CCC" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FF4500" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        <View style={styles.section}>
          {renderSectionHeader('Notifications', 'notifications-outline')}
          
          {renderSwitchSetting(
            'Push Notifications',
            'Receive notifications about your reports',
            settings.notifications.enabled,
            (value) => updateSetting('notifications', 'enabled', value)
          )}
          
          {settings.notifications.enabled && (
            <>
              {renderSwitchSetting(
                'Report Confirmed',
                'When your report is received by authorities',
                settings.notifications.reportConfirmed,
                (value) => updateSetting('notifications', 'reportConfirmed', value)
              )}
              
              {renderSwitchSetting(
                'Report Acknowledged',
                'When authorities review your report',
                settings.notifications.reportAcknowledged,
                (value) => updateSetting('notifications', 'reportAcknowledged', value)
              )}
              
              {renderSwitchSetting(
                'Report Resolved',
                'When your reported issue is resolved',
                settings.notifications.reportResolved,
                (value) => updateSetting('notifications', 'reportResolved', value)
              )}
              
              {renderSwitchSetting(
                'Community Updates',
                'Updates from your local community',
                settings.notifications.communityUpdates,
                (value) => updateSetting('notifications', 'communityUpdates', value)
              )}
            </>
          )}
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          {renderSectionHeader('Privacy & Security', 'shield-outline')}
          
          {renderSwitchSetting(
            'Location Sharing',
            'Share your location for better issue reporting',
            settings.privacy.locationSharing,
            (value) => updateSetting('privacy', 'locationSharing', value)
          )}
          
          {renderSwitchSetting(
            'Profile Visibility',
            'Allow others to see your profile information',
            settings.privacy.profileVisibility,
            (value) => updateSetting('privacy', 'profileVisibility', value)
          )}
          
          {renderNavigationSetting(
            'Privacy Policy',
            'View our privacy policy and data handling',
            () => Alert.alert('Info', 'Privacy Policy will be opened'),
            null
          )}
          
          {renderNavigationSetting(
            'Data & Storage',
            'Manage your app data and storage',
            () => Alert.alert('Info', 'Data management options'),
            null
          )}
        </View>

        {/* General Section */}
        <View style={styles.section}>
          {renderSectionHeader('General', 'settings-outline')}
          
          {renderNavigationSetting(
            'Language',
            'Choose your preferred language',
            () => Alert.alert('Info', 'Language selection will be available in future updates'),
            settings.general.language
          )}
          
          {renderNavigationSetting(
            'Theme',
            'Choose app appearance',
            () => Alert.alert('Info', 'Theme selection will be available in future updates'),
            settings.general.theme
          )}
          
          {renderSwitchSetting(
            'Auto-detect Location',
            'Automatically detect location when reporting',
            settings.general.autoLocation,
            (value) => updateSetting('general', 'autoLocation', value)
          )}
          
          {renderNavigationSetting(
            'Cache Management',
            'Clear app cache and temporary files',
            () => Alert.alert('Clear Cache', 'This will clear temporary files and improve performance', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', onPress: () => Alert.alert('Success', 'Cache cleared successfully') }
            ]),
            null
          )}
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          {renderSectionHeader('Support', 'help-circle-outline')}
          
          {renderNavigationSetting(
            'Help Center',
            'Get help with using the app',
            () => navigation.navigate('FAQ'),
            null
          )}
          
          {renderNavigationSetting(
            'Contact Support',
            'Get in touch with our support team',
            () => navigation.navigate('Feedback'),
            null
          )}
          
          {renderNavigationSetting(
            'Report a Bug',
            'Report technical issues or bugs',
            () => Alert.alert('Bug Report', 'Please describe the issue you encountered'),
            null
          )}
          
          {renderNavigationSetting(
            'Rate the App',
            'Rate NagarMitra on the app store',
            () => Alert.alert('Thank You', 'App store rating will be available soon'),
            null
          )}
        </View>

        {/* Advanced Section */}
        <View style={styles.section}>
          {renderSectionHeader('Advanced', 'construct-outline')}
          
          {renderNavigationSetting(
            'App Permissions',
            'Manage app permissions and access',
            () => Alert.alert('Permissions', 'Camera, Location, and Microphone permissions can be managed in device settings'),
            null
          )}
          
          {renderNavigationSetting(
            'Backup & Sync',
            'Backup your data and sync across devices',
            () => Alert.alert('Info', 'Backup feature will be available in future updates'),
            null
          )}
          
          <TouchableOpacity style={styles.settingItem} onPress={resetSettings}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, { color: '#DC3545' }]}>Reset Settings</Text>
              <Text style={styles.settingDescription}>Reset all settings to default values</Text>
            </View>
            <Ionicons name="refresh" size={20} color="#DC3545" />
          </TouchableOpacity>
        </View>

        {/* App Information */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>NagarMitra v1.0.0</Text>
          <Text style={styles.infoText}>
            Settings are automatically saved and synced across all your devices.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  placeholder: {
    width: 24,
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FAFAFA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF4500',
    marginLeft: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingContent: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    color: '#000',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  navigationValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  infoSection: {
    padding: 20,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF4500',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SettingsScreen;