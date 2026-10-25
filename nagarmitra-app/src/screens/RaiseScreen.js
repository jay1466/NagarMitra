import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Alert, ScrollView, Image, TouchableOpacity, StyleSheet, FlatList, Modal, ActivityIndicator } from 'react-native';
import { auth } from '../lib/firebase';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { apiPost, detectAPI } from '../api/client';
import { CATEGORIES, PRIORITIES } from '../constants';
import { getPresignedUrl, uploadToPresignedUrl } from '../api/media';

export default function RaiseScreen({ navigation }) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState(PRIORITIES[0]);
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [images, setImages] = useState([]);
  const [imageKeys, setImageKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [voiceUri, setVoiceUri] = useState(null);
  const [voiceKey, setVoiceKey] = useState(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [detectingCategory, setDetectingCategory] = useState(false);
  const [detectedConfidence, setDetectedConfidence] = useState(null);
  const [reportId, setReportId] = useState('');
  const user = auth.currentUser;

  // Initialize audio permissions
  useEffect(() => {
    const requestAudioPermissions = async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Audio permissions not granted');
      }
    };
    requestAudioPermissions();
  }, []);

  // Email verification functions removed - no longer required

  // Voice recording functions
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone permission is required for voice input.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording: ' + error.message);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setVoiceUri(uri);
      setRecording(null);
      setIsRecording(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording: ' + error.message);
    }
  };

  const playVoiceNote = async () => {
    if (!voiceUri) return;

    try {
      const { sound } = await Audio.Sound.createAsync({ uri: voiceUri });
      await sound.playAsync();
    } catch (error) {
      Alert.alert('Error', 'Failed to play voice note: ' + error.message);
    }
  };

  const deleteVoiceNote = () => {
    setVoiceUri(null);
    setVoiceKey(null);
  };

  const detectImageCategory = async (uri) => {
    try {
      setDetectingCategory(true);
      const result = await detectAPI.detectImage(uri);
      
      if (result && result.category && result.category !== 'miscellaneous') {
        // If the category matches one of the app's categories (case sensitive check or mapping)
        const matchedCategory = CATEGORIES.find(c => c.toLowerCase() === result.category.toLowerCase());
        if (matchedCategory) {
          setCategory(matchedCategory);
        } else if (CATEGORIES.includes(result.category)) {
          setCategory(result.category);
        }
        setDetectedConfidence(result.confidence);
      }
    } catch (err) {
      console.log('Detection error:', err);
    } finally {
      setDetectingCategory(false);
    }
  };

  const pickImage = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload maximum 5 images per complaint.');
      return;
    }
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission required', 'Media access denied');
    
    const res = await ImagePicker.launchImageLibraryAsync({ 
      allowsEditing: false, 
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length
    });
    
    if (!res.canceled) {
      const newImages = res.assets.map(asset => ({
        uri: asset.uri,
        uploaded: false,
        key: null
      }));
      setImages(prev => [...prev, ...newImages]);
      
      if (res.assets.length > 0) {
        detectImageCategory(res.assets[0].uri);
      }
    }
  };

  const takePhoto = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload maximum 5 images per complaint.');
      return;
    }
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission required', 'Camera access denied');
    
    const res = await ImagePicker.launchCameraAsync({ 
      allowsEditing: false, 
      quality: 0.7
    });
    
    if (!res.canceled) {
      const newImage = {
        uri: res.assets[0].uri,
        uploaded: false,
        key: null
      };
      setImages(prev => [...prev, newImage]);
      detectImageCategory(res.assets[0].uri);
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission required', 'Location access denied');
    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    try {
      const geos = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geos && geos[0]) {
        const g = geos[0];
        setAddress(`${g.name || ''} ${g.street || ''} ${g.city || ''} ${g.region || ''} ${g.postalCode || ''}`.trim());
      }
    } catch {}
  };

  const uploadImages = async () => {
    if (images.length === 0) {
      Alert.alert('No Images', 'Please add some images first.');
      return;
    }
    
    const unuploadedImages = images.filter(img => !img.uploaded);
    if (unuploadedImages.length === 0) {
      Alert.alert('Already Uploaded ✅', 'All images are already uploaded and ready for submission!');
      return;
    }
    
    try {
      setLoading(true);
      const uploadPromises = unuploadedImages.map(async (image, index) => {
        const actualIndex = images.findIndex(img => img.uri === image.uri);
        const contentType = guessContentType(image.uri);
        const { key, uploadUrl } = await getPresignedUrl({ contentType, prefix: 'complaints/' });
        await uploadToPresignedUrl({ uploadUrl, fileUri: image.uri, contentType });
        
        setImages(prev => prev.map((img, i) => 
          i === actualIndex ? { ...img, uploaded: true, key } : img
        ));
        
        return key;
      });
      
      await Promise.all(uploadPromises);
      Alert.alert(
        'Upload Successful! ✅', 
        `${unuploadedImages.length} image${unuploadedImages.length > 1 ? 's' : ''} uploaded successfully. You can now submit your complaint.`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch (e) {
      Alert.alert('Upload Failed ❌', `Failed to upload images: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const uploadVoiceNote = async () => {
    if (!voiceUri) {
      Alert.alert('No Voice Note', 'Please record a voice note first.');
      return;
    }
    
    try {
      setLoading(true);
      const contentType = 'audio/m4a';
      const { key, uploadUrl } = await getPresignedUrl({ contentType, prefix: 'voice/' });
      await uploadToPresignedUrl({ uploadUrl, fileUri: voiceUri, contentType });
      setVoiceKey(key);
      Alert.alert('Voice Upload Successful! 🎤✅', 'Your voice note has been uploaded and is ready for submission.');
    } catch (e) {
      Alert.alert('Voice Upload Failed ❌', `Failed to upload voice note: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!description) return Alert.alert('Validation', 'Description is required');
    if (!category) return Alert.alert('Validation', 'Please select a category');
    
    // Check if there are unuploaded images
    const unuploadedImages = images.filter(img => !img.uploaded);
    if (unuploadedImages.length > 0) {
      return Alert.alert('Upload Required', 'Please upload all images before submitting.');
    }
    
    // Check if there's an unuploaded voice note
    if (voiceUri && !voiceKey) {
      return Alert.alert('Upload Required', 'Please upload the voice note before submitting.');
    }
    
    setLoading(true);
    try {
      const imageKeys = images.map(img => img.key).filter(Boolean);
      const mediaKeys = [...imageKeys];
      if (voiceKey) mediaKeys.push(voiceKey);
      
      const body = {
        title: `${category} Issue - ${priority} Priority`, // Auto-generate title from category and priority
        description,
        category,
        priority,
        address,
        wardCode: 'W-01',
        location: coords,
        media: mediaKeys,
      };
      
      const json = await apiPost('/api/v1/complaints', body);
      setReportId(json.reportId);
      setShowSuccessModal(true);
      
      // Clear form
      setDescription('');
      setAddress('');
      setCoords(null);
      setImages([]);
      setVoiceUri(null);
      setVoiceKey(null);
      setCategory(CATEGORIES[0]);
      setPriority(PRIORITIES[0]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  function guessContentType(uri) {
    const u = uri.toLowerCase();
    if (u.endsWith('.png')) return 'image/png';
    if (u.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FF4500" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Raise a Complaint</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Email verification removed - users can submit complaints without verification */}

        {/* Photo Upload Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload Photos</Text>
          <Text style={styles.sectionSubtitle}>Add up to 5 photos of the issue</Text>
          
          {/* Image Grid */}
          {images.length > 0 && (
            <FlatList
              data={images}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: item.uri }} style={styles.image} />
                  <TouchableOpacity 
                    onPress={() => removeImage(index)} 
                    style={styles.removeImageButton}
                  >
                    <Ionicons name="close-circle" size={20} color="#DC3545" />
                  </TouchableOpacity>
                  <View style={styles.imageStatus}>
                    <Ionicons 
                      name={item.uploaded ? "checkmark-circle" : "cloud-upload"} 
                      size={16} 
                      color={item.uploaded ? "#28A745" : "#666"} 
                    />
                  </View>
                </View>
              )}
              keyExtractor={(item, index) => index.toString()}
            />
          )}
          
          {/* Photo Action Buttons */}
          <View style={styles.photoActions}>
            <TouchableOpacity onPress={takePhoto} style={styles.photoActionButton}>
              <Ionicons name="camera" size={20} color="#FF4500" />
              <Text style={styles.photoActionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickImage} style={styles.photoActionButton}>
              <Ionicons name="images" size={20} color="#FF4500" />
              <Text style={styles.photoActionText}>Gallery</Text>
            </TouchableOpacity>
            {images.length > 0 && (
              <TouchableOpacity onPress={uploadImages} style={styles.uploadButton} disabled={loading}>
                <Ionicons name="cloud-upload" size={20} color="#FFF" />
                <Text style={styles.uploadButtonText}>Upload</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <View style={styles.descriptionContainer}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the civic issue in detail..."
              multiline
              style={styles.descriptionInput}
              placeholderTextColor="#999"
            />
            
            {/* Voice Input */}
            <View style={styles.voiceContainer}>
              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                style={[styles.voiceButton, isRecording && styles.voiceButtonRecording]}
                disabled={loading}
              >
                <Ionicons 
                  name={isRecording ? "stop" : "mic"} 
                  size={20} 
                  color={isRecording ? "#DC3545" : "#FF4500"} 
                />
                <Text style={[styles.voiceButtonText, isRecording && styles.voiceButtonTextRecording]}>
                  {isRecording ? 'Stop' : 'Voice'}
                </Text>
              </TouchableOpacity>
              
              {voiceUri && (
                <View style={styles.voiceNoteContainer}>
                  <TouchableOpacity onPress={playVoiceNote} style={styles.playButton}>
                    <Ionicons name="play" size={16} color="#28A745" />
                  </TouchableOpacity>
                  <Text style={styles.voiceNoteText}>Voice note recorded</Text>
                  <TouchableOpacity onPress={deleteVoiceNote} style={styles.deleteVoiceButton}>
                    <Ionicons name="trash" size={16} color="#DC3545" />
                  </TouchableOpacity>
                  {!voiceKey && (
                    <TouchableOpacity onPress={uploadVoiceNote} style={styles.uploadVoiceButton}>
                      <Text style={styles.uploadVoiceText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                  {voiceKey && (
                    <Ionicons name="checkmark-circle" size={16} color="#28A745" />
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locationContainer}>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Enter address or use GPS"
              style={styles.locationInput}
              placeholderTextColor="#999"
            />
            <TouchableOpacity onPress={getLocation} style={styles.locationButton}>
              <Ionicons name="location" size={20} color="#FF4500" />
            </TouchableOpacity>
          </View>
          {coords && (
            <Text style={styles.coordsText}>
              📍 {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </Text>
          )}
        </View>

        {/* Category Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Issue Category</Text>
          <TouchableOpacity 
            onPress={() => setShowCategoryPicker(true)} 
            style={styles.categorySelector}
          >
            <Text style={styles.categoryText}>{category}</Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
          
          {/* AI Detection feedback */}
          {detectingCategory && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <ActivityIndicator size="small" color="#FF4500" />
              <Text style={{ marginLeft: 8, color: '#666', fontSize: 13 }}>AI is analyzing your image...</Text>
            </View>
          )}
          {!detectingCategory && detectedConfidence !== null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Ionicons name="sparkles" size={16} color="#28A745" />
              <Text style={{ marginLeft: 6, color: '#28A745', fontSize: 13, fontWeight: '500' }}>
                AI Detected: {category} ({Math.round(detectedConfidence * 100)}% confidence)
              </Text>
            </View>
          )}
        </View>

        {/* Priority Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Priority Level</Text>
          <Text style={styles.sectionSubtitle}>How urgent is this issue?</Text>
          <TouchableOpacity 
            onPress={() => setShowPriorityPicker(true)} 
            style={styles.categorySelector}
          >
            <View style={styles.priorityContainer}>
              <Ionicons 
                name={priority === 'Critical' ? 'alert' : priority === 'High' ? 'warning' : priority === 'Medium' ? 'information-circle' : 'checkmark-circle'} 
                size={20} 
                color={priority === 'Critical' ? '#DC3545' : priority === 'High' ? '#FFC107' : priority === 'Medium' ? '#FF4500' : '#28A745'} 
              />
              <Text style={[styles.categoryText, { color: priority === 'Critical' ? '#DC3545' : priority === 'High' ? '#FFC107' : priority === 'Medium' ? '#FF4500' : '#28A745' }]}>{priority}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          onPress={submit} 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Submitting...' : 'Submit Complaint'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CATEGORIES}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setCategory(item);
                    setShowCategoryPicker(false);
                  }}
                  style={[styles.categoryOption, item === category && styles.categoryOptionSelected]}
                >
                  <Text style={[styles.categoryOptionText, item === category && styles.categoryOptionTextSelected]}>
                    {item}
                  </Text>
                  {item === category && (
                    <Ionicons name="checkmark" size={20} color="#FF4500" />
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item}
            />
          </View>
        </View>
      </Modal>

      {/* Priority Picker Modal */}
      <Modal visible={showPriorityPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Priority</Text>
              <TouchableOpacity onPress={() => setShowPriorityPicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PRIORITIES}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setPriority(item);
                    setShowPriorityPicker(false);
                  }}
                  style={[styles.categoryOption, item === priority && styles.categoryOptionSelected]}
                >
                  <View style={styles.priorityRowContainer}>
                    <Ionicons 
                      name={item === 'Critical' ? 'alert' : item === 'High' ? 'warning' : item === 'Medium' ? 'information-circle' : 'checkmark-circle'} 
                      size={20} 
                      color={item === 'Critical' ? '#DC3545' : item === 'High' ? '#FFC107' : item === 'Medium' ? '#FF4500' : '#28A745'} 
                    />
                    <Text style={[styles.categoryOptionText, item === priority && styles.categoryOptionTextSelected]}>
                      {item}
                    </Text>
                  </View>
                  {item === priority && (
                    <Ionicons name="checkmark" size={20} color="#FF4500" />
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item}
            />
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <Ionicons name="checkmark-circle" size={60} color="#28A745" />
            <Text style={styles.successTitle}>Report Submitted Successfully!</Text>
            <Text style={styles.successText}>Your report ID: {reportId}</Text>
            <Text style={styles.successSubtext}>You can track the status of your complaint using this ID</Text>
            <View style={styles.successButtons}>
              <TouchableOpacity 
                onPress={() => {
                  setShowSuccessModal(false);
                  navigation.navigate('Dashboard');
                }} 
                style={styles.successButton}
              >
                <Text style={styles.successButtonText}>View Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setShowSuccessModal(false)} 
                style={styles.successButtonSecondary}
              >
                <Text style={styles.successButtonSecondaryText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  // Warning styles removed - email verification no longer required
  section: {
    marginHorizontal: 20,
    marginTop: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 10,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFF',
    borderRadius: 10,
  },
  imageStatus: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 2,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F0',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF4500',
    gap: 6,
  },
  photoActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF4500',
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4500',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  descriptionContainer: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  descriptionInput: {
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 10,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#FFF5F0',
    borderWidth: 1,
    borderColor: '#FF4500',
    gap: 6,
  },
  voiceButtonRecording: {
    backgroundColor: '#FFF5F5',
    borderColor: '#DC3545',
  },
  voiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF4500',
  },
  voiceButtonTextRecording: {
    color: '#DC3545',
  },
  voiceNoteContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 8,
  },
  playButton: {
    padding: 4,
  },
  voiceNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  deleteVoiceButton: {
    padding: 4,
  },
  uploadVoiceButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FF4500',
    borderRadius: 4,
  },
  uploadVoiceText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  locationInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  locationButton: {
    padding: 15,
    borderLeftWidth: 1,
    borderLeftColor: '#F0F0F0',
  },
  coordsText: {
    fontSize: 12,
    color: '#28A745',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  categoryText: {
    fontSize: 16,
    color: '#000',
  },
  priorityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitButton: {
    backgroundColor: '#FF4500',
    marginHorizontal: 20,
    marginTop: 30,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    margin: 20,
    maxHeight: '70%',
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  categoryOptionSelected: {
    backgroundColor: '#FFF5F0',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#000',
  },
  categoryOptionTextSelected: {
    color: '#FF4500',
    fontWeight: '600',
  },
  successModal: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    margin: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: '#FF4500',
    fontWeight: '600',
    marginBottom: 5,
  },
  successSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
  },
  successButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  successButton: {
    backgroundColor: '#FF4500',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  successButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  successButtonSecondary: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  successButtonSecondaryText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
});