import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, Image, TouchableOpacity, StyleSheet, FlatList, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { complaintAPI, detectAPI, errorMessage } from '../api/client';
import { CATEGORIES, PRIORITIES } from '../constants';
import { toCompressedDataUri } from '../utils/image';
import LocationPicker from '../components/LocationPicker';
import { useSession, departmentName } from '../context/SessionContext';
import { placeLabel } from '../data/india';

const MAX_IMAGES = 3;
const MIN_DESCRIPTION = 10;

export default function RaiseScreen({ navigation }) {
  const { me, meta } = useSession();
  const [place, setPlace] = useState({ state: null, district: null });
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState('Medium');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [detectingCategory, setDetectingCategory] = useState(false);
  const [detectedConfidence, setDetectedConfidence] = useState(null);
  const [reportId, setReportId] = useState('');

  useEffect(() => {
    if (me?.state && !place.state) setPlace({ state: me.state, district: me.district || null });
  }, [me?.state, me?.district]);

  const onPlaceChange = (next) => {
    setPlace({ state: next.state, district: next.district });
    if (next.coords) setCoords(next.coords);
    if (next.address && !address.trim()) setAddress(next.address);
  };

  // AI suggestion is a nice-to-have: failures are silent and never block the form
  const detectImageCategory = async (uri) => {
    try {
      setDetectingCategory(true);
      const result = await detectAPI.detectImage(uri);
      if (result?.category && result.category !== 'miscellaneous') {
        const matched = CATEGORIES.find((c) => c.toLowerCase() === String(result.category).toLowerCase());
        if (matched) {
          setCategory(matched);
          setDetectedConfidence(typeof result.confidence === 'number' ? result.confidence : null);
        }
      }
    } catch {
      // detection unavailable
    } finally {
      setDetectingCategory(false);
    }
  };

  const addImages = (assets) => {
    const room = MAX_IMAGES - images.length;
    const added = assets.slice(0, room).map((a) => ({ uri: a.uri }));
    if (!added.length) return;
    setImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
    if (images.length === 0) detectImageCategory(added[0].uri);
  };

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can add up to ${MAX_IMAGES} photos per complaint.`);
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo access in your phone settings to add photos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - images.length,
      });
      if (!res.canceled && res.assets?.length) addImages(res.assets);
    } catch {
      Alert.alert('Error', 'Could not open your gallery. Please try again.');
    }
  };

  const takePhoto = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can add up to ${MAX_IMAGES} photos per complaint.`);
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access in your phone settings to take photos.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!res.canceled && res.assets?.length) addImages(res.assets);
    } catch {
      Alert.alert('Error', 'Could not open the camera. Please try again.');
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (images.length === 1) setDetectedConfidence(null);
  };

  const resetForm = () => {
    setDescription('');
    setAddress('');
    setCoords(null);
    setImages([]);
    setPlace(me?.state ? { state: me.state, district: me.district || null } : { state: null, district: null });
    setCategory(CATEGORIES[0]);
    setPriority('Medium');
    setDetectedConfidence(null);
  };

  const submit = async () => {
    if (loading) return;
    if (description.trim().length < MIN_DESCRIPTION) {
      Alert.alert('Add more detail', `Please describe the issue in at least ${MIN_DESCRIPTION} characters.`);
      return;
    }
    if (!place.state || !place.district) {
      Alert.alert('Location needed', 'Please choose the state and district of the issue, or tap "Detect my location".');
      return;
    }

    setLoading(true);
    try {
      // Photos are compressed and sent with the report itself
      const media = [];
      for (const img of images) {
        try {
          media.push(await toCompressedDataUri(img.uri));
        } catch {
          // Skip a photo that can't be read rather than failing the whole report
        }
      }

      const json = await complaintAPI.create({
        title: `${category} issue`,
        description: description.trim(),
        category,
        priority,
        address: address.trim(),
        state: place.state,
        district: place.district,
        location: coords,
        media,
      });
      setReportId(json.reportId || '');
      setShowSuccessModal(true);
      resetForm();
    } catch (e) {
      Alert.alert('Could not submit', errorMessage(e, 'Your complaint could not be submitted. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Raise a Complaint</Text>
        </View>

        {/* Photo Upload Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload Photos</Text>
          <Text style={styles.sectionSubtitle}>Add up to {MAX_IMAGES} photos of the issue (optional)</Text>
          
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
                </View>
              )}
              keyExtractor={(item, index) => `${index}-${item.uri}`}
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
              maxLength={1000}
              textAlignVertical="top"
              style={styles.descriptionInput}
              placeholderTextColor="#999"
            />
            
            <Text style={[styles.charCount, description.trim().length < MIN_DESCRIPTION && styles.charCountLow]}>
              {description.trim().length}/{MIN_DESCRIPTION} min characters
            </Text>
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <LocationPicker value={place} onChange={onPlaceChange} label="" />
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Street, area or landmark (optional)"
            style={[styles.locationInput, styles.addressInput]}
            placeholderTextColor="#999"
          />
          {coords && (
            <Text style={styles.coordsText}>
              📍 GPS {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </Text>
          )}
          {place.district && (
            <View style={styles.routeBox}>
              <Ionicons name="git-branch-outline" size={16} color="#2E7D32" />
              <Text style={styles.routeText}>
                Will be sent to the {departmentName(meta, meta.categoryToDepartment?.[category]) || 'concerned'} officer of {placeLabel(place.state, place.district)}
              </Text>
            </View>
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
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Complaint</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
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
      <Modal visible={showPriorityPicker} transparent animationType="slide" onRequestClose={() => setShowPriorityPicker(false)}>
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
      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <Ionicons name="checkmark-circle" size={60} color="#28A745" />
            <Text style={styles.successTitle}>Report Submitted Successfully!</Text>
            <Text style={styles.successText} selectable>Your report ID: {reportId}</Text>
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
  charCount: {
    fontSize: 12,
    color: '#28A745',
    textAlign: 'right',
    marginTop: 6,
  },
  charCountLow: {
    color: '#999',
  },
  descriptionInput: {
    color: '#1A1A1A',
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
    color: '#1A1A1A',
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  locationButton: {
    padding: 15,
    borderLeftWidth: 1,
    borderLeftColor: '#F0F0F0',
  },
  addressInput: {
    flex: 0,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF6EE',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  routeText: {
    flex: 1,
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '600',
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