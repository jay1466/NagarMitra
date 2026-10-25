import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FeedbackScreen = ({ navigation }) => {
  const [feedbackData, setFeedbackData] = useState({
    type: 'general', // general, bug, feature, improvement
    rating: 0,
    title: '',
    message: '',
    email: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const feedbackTypes = [
    { key: 'general', label: 'General Feedback', icon: 'chatbubble-outline', color: '#007BFF' },
    { key: 'bug', label: 'Bug Report', icon: 'bug-outline', color: '#DC3545' },
    { key: 'feature', label: 'Feature Request', icon: 'bulb-outline', color: '#28A745' },
    { key: 'improvement', label: 'Improvement Suggestion', icon: 'trending-up-outline', color: '#FFC107' },
  ];

  const handleTypeSelect = (type) => {
    setFeedbackData({ ...feedbackData, type });
  };

  const handleRatingPress = (rating) => {
    setFeedbackData({ ...feedbackData, rating });
  };

  const handleSubmit = async () => {
    if (!feedbackData.title.trim()) {
      Alert.alert('Error', 'Please enter a title for your feedback');
      return;
    }
    
    if (!feedbackData.message.trim()) {
      Alert.alert('Error', 'Please enter your feedback message');
      return;
    }

    if (feedbackData.email && !isValidEmail(feedbackData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      // Here you would submit feedback to your backend
      await submitFeedback(feedbackData);
      
      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted successfully. We appreciate your input and will review it carefully.',
        [
          {
            text: 'OK',
            onPress: () => {
              setFeedbackData({
                type: 'general',
                rating: 0,
                title: '',
                message: '',
                email: '',
              });
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit feedback. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitFeedback = async (data) => {
    // Mock API call - replace with actual implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Feedback submitted:', data);
        resolve();
      }, 1500);
    });
  };

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getTypeInfo = () => {
    return feedbackTypes.find(type => type.key === feedbackData.type);
  };

  const renderStarRating = () => {
    return (
      <View style={styles.ratingContainer}>
        <Text style={styles.ratingLabel}>How would you rate your experience?</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => handleRatingPress(star)}
              style={styles.starButton}
            >
              <Ionicons
                name={star <= feedbackData.rating ? 'star' : 'star-outline'}
                size={32}
                color={star <= feedbackData.rating ? '#FFD700' : '#DDD'}
              />
            </TouchableOpacity>
          ))}
        </View>
        {feedbackData.rating > 0 && (
          <Text style={styles.ratingText}>
            {feedbackData.rating === 5 && 'Excellent!'}
            {feedbackData.rating === 4 && 'Very Good'}
            {feedbackData.rating === 3 && 'Good'}
            {feedbackData.rating === 2 && 'Fair'}
            {feedbackData.rating === 1 && 'Poor'}
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FF4500" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>We Value Your Feedback</Text>
          <Text style={styles.introText}>
            Help us improve NagarMitra by sharing your thoughts, reporting bugs, or suggesting new features.
          </Text>
        </View>

        {/* Feedback Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feedback Type</Text>
          <View style={styles.typeContainer}>
            {feedbackTypes.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.typeButton,
                  feedbackData.type === type.key && styles.typeButtonActive,
                  { borderColor: type.color }
                ]}
                onPress={() => handleTypeSelect(type.key)}
              >
                <Ionicons
                  name={type.icon}
                  size={24}
                  color={feedbackData.type === type.key ? '#FFF' : type.color}
                />
                <Text style={[
                  styles.typeButtonText,
                  feedbackData.type === type.key && styles.typeButtonTextActive
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rating Section */}
        <View style={styles.section}>
          {renderStarRating()}
        </View>

        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.titleInput}
            placeholder={`Enter a brief title for your ${getTypeInfo().label.toLowerCase()}`}
            value={feedbackData.title}
            onChangeText={(text) => setFeedbackData({ ...feedbackData, title: text })}
            maxLength={100}
          />
          <Text style={styles.charCount}>{feedbackData.title.length}/100</Text>
        </View>

        {/* Message Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.messageInput}
            placeholder={`Please provide detailed information about your ${getTypeInfo().label.toLowerCase()}...`}
            value={feedbackData.message}
            onChangeText={(text) => setFeedbackData({ ...feedbackData, message: text })}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>{feedbackData.message.length}/1000</Text>
        </View>

        {/* Email Input (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email (Optional)</Text>
          <TextInput
            style={styles.emailInput}
            placeholder="Enter your email if you'd like a response"
            value={feedbackData.email}
            onChangeText={(text) => setFeedbackData({ ...feedbackData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.helpText}>
            We'll only use this to respond to your feedback if needed
          </Text>
        </View>

        {/* Guidelines */}
        <View style={styles.guidelinesSection}>
          <Text style={styles.guidelinesTitle}>Guidelines</Text>
          <View style={styles.guideline}>
            <Ionicons name="checkmark-circle" size={16} color="#28A745" />
            <Text style={styles.guidelineText}>Be specific and descriptive</Text>
          </View>
          <View style={styles.guideline}>
            <Ionicons name="checkmark-circle" size={16} color="#28A745" />
            <Text style={styles.guidelineText}>Include steps to reproduce (for bugs)</Text>
          </View>
          <View style={styles.guideline}>
            <Ionicons name="checkmark-circle" size={16} color="#28A745" />
            <Text style={styles.guidelineText}>Suggest improvements constructively</Text>
          </View>
          <View style={styles.guideline}>
            <Ionicons name="checkmark-circle" size={16} color="#28A745" />
            <Text style={styles.guidelineText}>Keep it respectful and professional</Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <Text style={styles.submitButtonText}>Submitting...</Text>
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>Submit Feedback</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  introSection: {
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  introText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  required: {
    color: '#DC3545',
  },
  typeContainer: {
    gap: 10,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  typeButtonActive: {
    backgroundColor: '#FF4500',
    borderColor: '#FF4500',
  },
  typeButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#FFF',
  },
  ratingContainer: {
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  starButton: {
    padding: 5,
  },
  ratingText: {
    fontSize: 16,
    color: '#FF4500',
    fontWeight: '600',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    height: 120,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 5,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    lineHeight: 16,
  },
  guidelinesSection: {
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  guideline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  guidelineText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4500',
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 15,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FeedbackScreen;