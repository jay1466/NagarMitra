import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_VERSION } from '../appInfo';
import { userAPI, errorMessage } from '../api/client';
import { setupNotifications, unregisterPush } from '../services/notificationService';
import { useThemePref } from '../context/ThemeContext';
import { useSession } from '../context/SessionContext';
import { tc, tct, themedStyles } from '../theme';

const THEME_LABELS = { system: 'System default', light: 'Light', dark: 'Dark' };

// Every option on this screen does something real: appearance is stored on the
// phone, notification preferences are stored on the server (and respected by it).
const SettingsScreen = ({ navigation }) => {
  const { pref, setPref } = useThemePref();
  const { me, refreshMe } = useSession();
  const [prefs, setPrefs] = useState({
    pushNotifications: me?.preferences?.pushNotifications !== false,
    issueUpdates: me?.preferences?.issueUpdates !== false,
    communityUpdates: me?.preferences?.communityUpdates !== false,
  });
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (me?.preferences) {
      setPrefs({
        pushNotifications: me.preferences.pushNotifications !== false,
        issueUpdates: me.preferences.issueUpdates !== false,
        communityUpdates: me.preferences.communityUpdates !== false,
      });
    }
  }, [me?.preferences]);

  const savePref = async (key, value) => {
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaving(key);
    try {
      await userAPI.updatePreferences({ [key]: value });
      if (key === 'pushNotifications') {
        // Re-register or unregister this phone straight away
        if (value) await setupNotifications();
        else await unregisterPush();
      }
      refreshMe();
    } catch (e) {
      setPrefs((p) => ({ ...p, [key]: previous }));
      Alert.alert('Could not save', errorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  const chooseTheme = () =>
    Alert.alert('Appearance', 'Choose how NagarMitra looks', [
      { text: 'System default', onPress: () => setPref('system') },
      { text: 'Light', onPress: () => setPref('light') },
      { text: 'Dark', onPress: () => setPref('dark') },
    ]);

  const Section = ({ title, icon }) => (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={tct('#FF4500')} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const SwitchRow = ({ title, description, value, k }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {!!description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        disabled={saving === k}
        onValueChange={(v) => savePref(k, v)}
        trackColor={{ false: tc('#E0E0E0'), true: tc('#FFB08A') }}
        thumbColor={value ? tc('#FF4500') : '#F4F4F4'}
      />
    </View>
  );

  const NavRow = ({ title, description, value, onPress, icon = 'chevron-forward' }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {!!description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      {!!value && <Text style={styles.settingValue}>{value}</Text>}
      <Ionicons name={icon} size={18} color={tct('#999')} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={tct('#FF4500')} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.section}>
          <Section title="Appearance" icon="color-palette-outline" />
          <NavRow title="Theme" description="Light, dark, or follow your phone" value={THEME_LABELS[pref]} onPress={chooseTheme} />
        </View>

        <View style={styles.section}>
          <Section title="Notifications" icon="notifications-outline" />
          <SwitchRow
            k="pushNotifications"
            title="Push notifications"
            description="Alerts on this phone, even when the app is closed. Your in-app inbox always keeps every update."
            value={prefs.pushNotifications}
          />
          <SwitchRow
            k="issueUpdates"
            title="Complaint updates"
            description="Status changes on complaints you reported"
            value={prefs.issueUpdates}
          />
          <SwitchRow
            k="communityUpdates"
            title="Community activity"
            description="Likes on your community posts"
            value={prefs.communityUpdates}
          />
        </View>

        <View style={styles.section}>
          <Section title="Privacy & permissions" icon="shield-outline" />
          <NavRow
            title="App permissions"
            description="Location, camera, photos and notifications"
            onPress={() => Linking.openSettings().catch(() => {})}
            icon="open-outline"
          />
          <NavRow
            title="Privacy"
            description="What NagarMitra stores about you"
            onPress={() => navigation.navigate('AboutUs')}
          />
        </View>

        <View style={styles.section}>
          <Section title="Help" icon="help-circle-outline" />
          <NavRow title="FAQ" description="How complaints, deadlines and escalation work" onPress={() => navigation.navigate('FAQ')} />
          <NavRow title="Send feedback / report a bug" description="Goes straight to the team" onPress={() => navigation.navigate('Feedback')} />
        </View>

        <Text style={styles.version}>NagarMitra v{APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
};

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: tc('#F6F7F9') },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: tc('#FFF'),
    borderBottomWidth: 1,
    borderBottomColor: tc('#EEE'),
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: tct('#222') },
  section: { backgroundColor: tc('#FFF'), marginTop: 14, marginHorizontal: 16, borderRadius: 12, paddingVertical: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: tct('#333') },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: tc('#F2F2F2'),
    gap: 10,
  },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: 15, color: tct('#222'), fontWeight: '600' },
  settingDescription: { fontSize: 12, color: tct('#888'), marginTop: 3, lineHeight: 17 },
  settingValue: { fontSize: 13, color: tct('#FF4500'), fontWeight: '600' },
  version: { textAlign: 'center', color: tct('#999'), marginTop: 20, fontSize: 12 },
}));

export default SettingsScreen;
