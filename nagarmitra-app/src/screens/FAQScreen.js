import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { tc, tct, themedStyles } from '../theme';
const FAQScreen = ({ navigation }) => {
  const [expandedItem, setExpandedItem] = useState(null);

  const faqData = [
    {
      id: '1',
      question: "How do I report a civic issue?",
      answer: "Open the Raise tab. Add up to 3 photos (optional), describe the problem in at least 10 characters, choose the State and District (or tap \"Detect my location\"), pick a category and priority, and tap Submit. You get a report ID straight away.",
    },
    {
      id: '2',
      question: "Who receives my complaint?",
      answer: "It is sent automatically to the officer of the responsible department (Roads, Sanitation, Water, Electricity or General Administration) in the district you chose. Officers of other departments or districts cannot see it.",
    },
    {
      id: '3',
      question: "How can I track my complaint?",
      answer: "Open Dashboard and switch on \"Mine only\", or search any report ID under \"Track Report Status\". Tap a complaint to see its officer, deadline and full timeline.",
    },
    {
      id: '4',
      question: "How long will it take?",
      answer: "Every complaint has a deadline based on its category and priority. For example, sanitation issues must be resolved within 24 hours and potholes within 72 hours; Critical issues get half that time. The deadline is shown on the complaint.",
    },
    {
      id: '5',
      question: "What if the officer doesn't act in time?",
      answer: "When the deadline passes the officer is reminded. If it stays open, it is escalated automatically: to the District Admin after 24 hours, the State Admin after 3 days and the Super Admin after 7 days. You can also tap \"Remind officer\" once every 24 hours.",
    },
    {
      id: '6',
      question: "What happens when it is marked resolved?",
      answer: "You get a notification. Open the complaint to see what was done (often with a photo). Tap \"Confirm fixed\" and rate the work, or \"Reopen\" within 7 days if the problem is still there. If you do nothing, it closes automatically after 7 days.",
    },
    {
      id: '7',
      question: "Can my complaint be rejected?",
      answer: "Yes, if it isn't something the municipality handles (for example a private-property dispute). The officer must give a reason, which you will see on the complaint.",
    },
    {
      id: '8',
      question: "Can others see my complaint?",
      answer: "The issue (category, description, photos, location and status) is public so everyone can see what is happening in their area. Your name and contact details are never shown to other citizens.",
    },
    {
      id: '9',
      question: "What types of issues can I report?",
      answer: "Potholes, sanitation, waste management, water supply, electricity and street lighting, and other municipal issues (Miscellaneous).",
    },
    {
      id: '10',
      question: "Can I edit or delete a complaint?",
      answer: "Not after it is submitted, because it is already with an officer. If something is wrong, reopen it with a note after it is resolved, or send feedback.",
    },
    {
      id: '11',
      question: "How do notifications work?",
      answer: "You are notified when your complaint is registered, acknowledged, started, resolved or rejected. Push notifications arrive even when the app is closed; you can turn them off in Settings and still see everything in the Notifications inbox.",
    },
    {
      id: '12',
      question: "What is the Community tab?",
      answer: "A space to share civic updates with photos, like and vote on posts, and see stories from the last 24 hours. You can post anonymously.",
    },
    {
      id: '13',
      question: "Does the app support dark mode?",
      answer: "Yes. It follows your phone by default; choose Light or Dark in Settings \u2192 Theme.",
    },
    {
      id: '14',
      question: "How do I get help?",
      answer: "Use Feedback (in the More menu) to ask a question or report a bug. It goes straight to the team.",
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
            color={tct('#FF4500')}
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
          <Ionicons name="arrow-back" size={24} color={tct('#FF4500')} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={tct('#666')} />
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

const styles = themedStyles(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tc('#FFF'),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: tc('#F0F0F0'),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: tct('#000'),
  },
  placeholder: {
    width: 24,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: tc('#F0F0F0'),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tc('#F8F9FA'),
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
  },
  searchPlaceholder: {
    marginLeft: 10,
    fontSize: 16,
    color: tct('#666'),
    flex: 1,
  },
  faqList: {
    flex: 1,
  },
  introSection: {
    paddingHorizontal: 20,
    paddingVertical: 25,
    borderBottomWidth: 1,
    borderBottomColor: tc('#F8F8F8'),
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: tct('#000'),
    marginBottom: 10,
  },
  introText: {
    fontSize: 16,
    color: tct('#666'),
    lineHeight: 22,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: tc('#F8F8F8'),
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
    color: tct('#000'),
    flex: 1,
    marginRight: 15,
    lineHeight: 22,
  },
  answerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: tc('#FAFAFA'),
  },
  answerText: {
    fontSize: 15,
    color: tct('#333'),
    lineHeight: 22,
    textAlign: 'left',
  },
  supportSection: {
    margin: 20,
    padding: 20,
    backgroundColor: tc('#F8F9FA'),
    borderRadius: 12,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: tc('#FF4500'),
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: tct('#000'),
    marginBottom: 10,
  },
  supportText: {
    fontSize: 15,
    color: tct('#666'),
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tc('#FF4500'),
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
}));

export default FAQScreen;