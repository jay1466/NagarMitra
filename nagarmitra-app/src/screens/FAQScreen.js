import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FAQScreen = ({ navigation }) => {
  const [expandedItem, setExpandedItem] = useState(null);

  const faqData = [
    {
      id: '1',
      question: 'How do I report a civic issue?',
      answer: 'To report an issue, tap on the "Raise a Complaint" button from the home screen. Take a photo of the issue, add a description, select the issue category, and submit. Your location will be auto-detected.',
    },
    {
      id: '2',
      question: 'How can I track my complaint status?',
      answer: 'You can track your complaint in the Dashboard section. Your complaints will show different statuses: Submitted (red), Acknowledged (yellow), In Progress (blue), and Resolved (green). You\'ll also receive push notifications for status updates.',
    },
    {
      id: '3',
      question: 'What types of issues can I report?',
      answer: 'You can report various civic issues including:\n• Potholes\n• Sanitation problems\n• Waste management issues\n• Water supply problems\n• Electricity & lighting issues\n• Other miscellaneous municipal issues',
    },
    {
      id: '4',
      question: 'How long does it take to resolve issues?',
      answer: 'Resolution time varies by issue type and complexity. On average, issues are acknowledged within 24-48 hours and resolved within 7-15 days. You can see the average response time on the home screen.',
    },
    {
      id: '5',
      question: 'Can I see issues reported by others in my area?',
      answer: 'Yes! Visit the Community section to see all issues reported in your locality. You can filter by location, category, and sort by most recent or most upvoted issues.',
    },
    {
      id: '6',
      question: 'What information do I need to provide?',
      answer: 'You need to provide:\n• A clear photo of the issue\n• Brief description (text or voice note)\n• Your location (auto-detected or manually entered)\n• Issue category selection',
    },
    {
      id: '7',
      question: 'Is my personal information secure?',
      answer: 'Yes, we take privacy seriously. Your personal information is encrypted and stored securely. We only share necessary details with relevant authorities for issue resolution. Read our Privacy Policy for more details.',
    },
    {
      id: '8',
      question: 'Can I edit or cancel my complaint?',
      answer: 'Once submitted, complaints cannot be edited or cancelled as they are immediately forwarded to authorities. However, you can add additional comments or information through the app.',
    },
    {
      id: '9',
      question: 'What if my issue is not resolved?',
      answer: 'If your issue remains unresolved for an extended period, you can:\n• Contact our support team\n• Escalate through the feedback section\n• Call the helpline: 1800-123-4567',
    },
    {
      id: '10',
      question: 'How do push notifications work?',
      answer: 'You\'ll receive notifications at three stages:\n1. Report confirmed (within 1 hour)\n2. Report acknowledged by authorities (24-48 hours)\n3. Report resolved (variable timing)\n\nYou can manage notification preferences in Settings.',
    },
    {
      id: '11',
      question: 'Can I use the app offline?',
      answer: 'Limited functionality is available offline. You can draft complaints, but submitting requires internet connection. The app will sync when you\'re back online.',
    },
    {
      id: '12',
      question: 'How do I contact support?',
      answer: 'You can reach us through:\n• Email: support@nagarmitra.gov.in\n• Helpline: 1800-123-4567\n• Feedback section in the app\n• About Us section for more contact options',
    },
  ];

  const toggleExpanded = (itemId) => {
    setExpandedItem(expandedItem === itemId ? null : itemId);
  };

  const renderFAQItem = ({ item }) => {
    const isExpanded = expandedItem === item.id;

    return (
      <View key={item.id} style={styles.faqItem}>
        <TouchableOpacity
          style={styles.questionContainer}
          onPress={() => toggleExpanded(item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.questionText}>{item.question}</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#FF4500"
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.answerContainer}>
            <Text style={styles.answerText}>{item.answer}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FF4500" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <Text style={styles.searchPlaceholder}>Search FAQs...</Text>
        </View>
      </View>

      {/* FAQ List */}
      <ScrollView style={styles.faqList} showsVerticalScrollIndicator={false}>
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Frequently Asked Questions</Text>
          <Text style={styles.introText}>
            Find answers to common questions about NagarMitra. Can't find what you're looking for? Contact our support team.
          </Text>
        </View>

        {faqData.map((item) => renderFAQItem({ item }))}

        {/* Still Have Questions */}
        <View style={styles.supportSection}>
          <Text style={styles.supportTitle}>Still have questions?</Text>
          <Text style={styles.supportText}>
            Our support team is here to help you with any questions not covered in this FAQ.
          </Text>
          <TouchableOpacity style={styles.contactButton}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
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
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
  },
  searchPlaceholder: {
    marginLeft: 10,
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  faqList: {
    flex: 1,
  },
  introSection: {
    paddingHorizontal: 20,
    paddingVertical: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
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
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  questionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    marginRight: 15,
    lineHeight: 22,
  },
  answerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FAFAFA',
  },
  answerText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    textAlign: 'left',
  },
  supportSection: {
    margin: 20,
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF4500',
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  supportText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4500',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  contactButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default FAQScreen;