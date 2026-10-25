import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { auth, updateProfile } from '../lib/firebase';

const ProfileScreen = ({ navigation }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: auth.currentUser?.displayName || '',
    email: auth.currentUser?.email || '',
    phone: auth.currentUser?.phoneNumber || '',
    photoURL: auth.currentUser?.photoURL || null,
    location: {
      city: 'Bhubaneswar',
      ward: 'Ward 15',
      address: '',
    },
  });

  useEffect(() => {
    // Load user location if available
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        if (address) {
          setProfileData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              city: address.city || prev.location.city,
              address: `${address.name || ''} ${address.street || ''} ${address.district || ''}`.trim(),
            },
          }));
        }
      }
    } catch (error) {
      console.log('Location error:', error);
    }
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setProfileData(prev => ({
          ...prev,
          photoURL: result.assets[0].uri,
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    if (!profileData.displayName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setLoading(true);
    try {
      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: profileData.displayName,
        photoURL: profileData.photoURL,
      });

      // Here you would also update the backend user profile
      // await updateUserProfile(profileData);

      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setProfileData({
      displayName: auth.currentUser?.displayName || '',
      email: auth.currentUser?.email || '',
      phone: auth.currentUser?.phoneNumber || '',
      photoURL: auth.currentUser?.photoURL || null,
      location: profileData.location,
    });
    setIsEditing(false);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
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
          <Text style={styles.sectionTitle}>Location Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={[styles.input, isEditing && styles.inputEditable]}
              value={profileData.location.city}
              onChangeText={(text) => setProfileData(prev => ({
                ...prev,
                location: { ...prev.location, city: text }
              }))}
              placeholder="Enter your city"
              editable={isEditing}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ward</Text>
            <TextInput
              style={[styles.input, isEditing && styles.inputEditable]}
              value={profileData.location.ward}
              onChangeText={(text) => setProfileData(prev => ({
                ...prev,
                location: { ...prev.location, ward: text }
              }))}
              placeholder="Enter your ward"
              editable={isEditing}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, isEditing && styles.inputEditable]}
              value={profileData.location.address}
              onChangeText={(text) => setProfileData(prev => ({
                ...prev,
                location: { ...prev.location, address: text }
              }))}
              placeholder="Enter your address"
              multiline
              numberOfLines={2}
              editable={isEditing}
            />
          </View>

          {isEditing && (
            <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
              <Ionicons name="location" size={16} color="#FF4500" />
              <Text style={styles.locationButtonText}>Use Current Location</Text>
            </TouchableOpacity>
          )}
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