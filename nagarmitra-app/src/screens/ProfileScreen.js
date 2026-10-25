import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { auth, updateProfile } from '../lib/firebase';
import { userAPI, errorMessage } from '../api/client';
import { toCompressedDataUri } from '../utils/image';
import LocationPicker from '../components/LocationPicker';
import { useSession, roleLabel, jurisdictionLabel } from '../context/SessionContext';

const emptyProfile = () => ({
  displayName: auth.currentUser?.displayName || '',
  email: auth.currentUser?.email || '',
  phone: '',
  photoURL: null,
  location: { state: null, district: null, address: '' },
});

const fromServer = (u) => ({
  displayName: u?.displayName || auth.currentUser?.displayName || '',
  email: u?.email || auth.currentUser?.email || '',
  phone: u?.phoneNumber || '',
  photoURL: u?.photoURL || null,
  location: {
    state: u?.state || null,
    district: u?.district || null,
    address: u?.profile?.address || '',
  },
});

const ProfileScreen = ({ navigation }) => {
  const { me, meta, refreshMe } = useSession();
  const isCitizen = !me || me.role === 'citizen';
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saved, setSaved] = useState(emptyProfile());
  const [profileData, setProfileData] = useState(emptyProfile());

  const loadProfile = useCallback(async () => {
    try {
      const res = await userAPI.getProfile();
      const p = fromServer(res.user);
      setSaved(p);
      setProfileData(p);
    } catch (e) {
      Alert.alert('Could not load profile', errorMessage(e));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo access in your phone settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const photo = await toCompressedDataUri(result.assets[0].uri, { maxWidth: 256, quality: 0.7 });
        setProfileData((prev) => ({ ...prev, photoURL: photo }));
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    const name = profileData.displayName.trim();
    if (name.length < 2) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }
    const phone = profileData.phone.trim();
    if (phone && !/^\+?[0-9\s-]{7,15}$/.test(phone)) {
      Alert.alert('Invalid phone number', 'Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await userAPI.updateProfile({
        displayName: name,
        phoneNumber: phone,
        photoURL: profileData.photoURL,
        profile: { address: profileData.location.address.trim() },
        ...(isCitizen && profileData.location.state && profileData.location.district
          ? { state: profileData.location.state, district: profileData.location.district }
          : {}),
      });
      refreshMe();
      // Keep the Firebase display name in sync (photos live on our server, not in Firebase)
      await updateProfile(auth.currentUser, { displayName: name }).catch(() => {});
      const p = fromServer(res.user);
      setSaved(p);
      setProfileData(p);
      setIsEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error) {
      Alert.alert('Could not save', errorMessage(error, 'Failed to update profile.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setProfileData(saved);
    setIsEditing(false);
  };

  if (initialLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FF4500" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (isEditing ? handleCancel() : navigation.goBack())}>
          <Ionicons name="arrow-back" size={24} color="#FF4500" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          onPress={isEditing ? handleSave : () => setIsEditing(true)}
          disabled={loading}
        >
          <Text style={styles.editButton}>
            {isEditing ? (loading ? 'Saving...' : 'Save') : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Profile Picture Section */}
      <View style={styles.profilePictureSection}>
        <TouchableOpacity
          style={styles.profilePictureContainer}
          onPress={isEditing ? handleImagePicker : undefined}
        >
          {profileData.photoURL ? (
            <Image source={{ uri: profileData.photoURL }} style={styles.profilePicture} />
          ) : (
            <View style={styles.defaultProfilePicture}>
              <Ionicons name="person" size={40} color="#FF4500" />
            </View>
          )}
          {isEditing && (
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Profile Form */}
      <View style={styles.formContainer}>
        {/* Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            placeholderTextColor="#9A9A9A"
            style={[styles.input, isEditing && styles.inputEditable]}
            value={profileData.displayName}
            onChangeText={(text) => setProfileData(prev => ({ ...prev, displayName: text }))}
            placeholder="Enter your full name"
            editable={isEditing}
          />
        </View>

        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholderTextColor="#9A9A9A"
            style={styles.input}
            value={profileData.email}
            placeholder="No email provided"
            editable={false}
          />
          <Text style={styles.helpText}>Email cannot be changed</Text>
        </View>

        {/* Phone */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            placeholderTextColor="#9A9A9A"
            style={[styles.input, isEditing && styles.inputEditable]}
            value={profileData.phone}
            onChangeText={(text) => setProfileData(prev => ({ ...prev, phone: text }))}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
            editable={isEditing}
          />
        </View>

        {/* Location Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{isCitizen ? 'Home location' : 'Role & jurisdiction'}</Text>

          {!isCitizen && (
            <View style={styles.roleBox}>
              <Ionicons name="shield-checkmark" size={20} color="#FF4500" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.roleTitle}>{roleLabel(meta, me?.role)}</Text>
                <Text style={styles.roleSub}>{me?.designation ? `${me.designation} · ` : ''}{jurisdictionLabel(meta, me)}</Text>
              </View>
            </View>
          )}

          {isCitizen && (
            <View style={styles.inputGroup}>
              <LocationPicker
                label="State & district"
                value={profileData.location}
                disabled={!isEditing}
                allowDetect={isEditing}
                onChange={(p) =>
                  setProfileData((prev) => ({
                    ...prev,
                    location: {
                      ...prev.location,
                      state: p.state,
                      district: p.district,
                      address: p.address && !prev.location.address ? p.address : prev.location.address,
                    },
                  }))
                }
              />
              <Text style={styles.helpText}>New complaints will default to this district.</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              placeholderTextColor="#9A9A9A"
              style={[styles.input, isEditing && styles.inputEditable]}
              value={profileData.location.address}
              onChangeText={(text) => setProfileData((prev) => ({ ...prev, location: { ...prev.location, address: text } }))}
              placeholder="House, street, area"
              multiline
              numberOfLines={2}
              editable={isEditing}
            />
          </View>
        </View>

        {/* Action Buttons */}
        {isEditing && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  roleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1EA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  roleTitle: { fontSize: 15, fontWeight: 'bold', color: '#222' },
  roleSub: { fontSize: 13, color: '#666', marginTop: 2 },
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
  editButton: {
    fontSize: 16,
    color: '#FF4500',
    fontWeight: '600',
  },
  profilePictureSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  profilePictureContainer: {
    position: 'relative',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  defaultProfilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF450015',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF4500',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#F9F9F9',
  },
  inputEditable: {
    backgroundColor: '#FFF',
    borderColor: '#FF4500',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  sectionContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FF4500',
    borderRadius: 8,
    marginTop: 10,
  },
  locationButtonText: {
    color: '#FF4500',
    marginLeft: 8,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 30,
    marginBottom: 30,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#FF4500',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;