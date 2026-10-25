import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AboutUsScreen = ({ navigation }) => {
  const handleLinkPress = (url) => {
    Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
  };

  const handleEmailPress = (email) => {
    Linking.openURL(`mailto:${email}`).catch(err => console.error('Failed to open email:', err));
  };

  const teamMembers = [
    {
      name: 'Development Team',
      role: 'Full Stack Development',
      description: 'Building the future of civic engagement through technology',
    },
    {
      name: 'Design Team',
      role: 'UI/UX Design',
      description: 'Creating intuitive and accessible user experiences',
    },
    {
      name: 'Policy Team',
      role: 'Government Relations',
      description: 'Bridging the gap between citizens and authorities',
    },
  ];

  const features = [
    {
      icon: 'camera-outline',
      title: 'Easy Reporting',
      description: 'Report civic issues with just a photo and description',
    },
    {
      icon: 'trending-up-outline',
      title: 'Real-time Tracking',
      description: 'Track your complaint status in real-time',
    },
    {
      icon: 'map-outline',
      title: 'Ward-wise Transparency',
      description: 'View issues and resolutions in your locality',
    },
    {
      icon: 'people-outline',
      title: 'Community Engagement',
      description: 'Engage with your community on civic matters',
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FF4500" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={styles.placeholder} />
      </View>

      {/* App Logo and Tagline */}
      <View style={styles.logoSection}>
        <View style={styles.logoContainer}>
          <Ionicons name="ribbon" size={60} color="#FF4500" />
        </View>
        <Text style={styles.appName}>NagarMitra</Text>
        <Text style={styles.tagline}>जन की आवाज, सरकार का समाधान</Text>
        <Text style={styles.taglineEnglish}>Voice of the People, Government's Solution</Text>
      </View>

      {/* Mission Statement */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Our Mission</Text>
        <Text style={styles.missionText}>
          NagarMitra is a crowd-sourced civic issue reporting and resolution platform that empowers citizens to report local infrastructure and municipal issues while providing transparent tracking and community engagement features. We bridge the gap between citizens and government authorities through technology-driven civic participation.
        </Text>
      </View>

      {/* Key Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Features</Text>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name={feature.icon} size={24} color="#FF4500" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Team Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Our Team</Text>
        {teamMembers.map((member, index) => (
          <View key={index} style={styles.teamMember}>
            <View style={styles.memberAvatar}>
              <Ionicons name="people" size={20} color="#FF4500" />
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberRole}>{member.role}</Text>
              <Text style={styles.memberDescription}>{member.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Technology Stack */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Technology Stack</Text>
        <View style={styles.techStack}>
          <View style={styles.techCategory}>
            <Text style={styles.techCategoryTitle}>Frontend</Text>
            <Text style={styles.techItem}>• React Native</Text>
            <Text style={styles.techItem}>• Expo</Text>
            <Text style={styles.techItem}>• React Navigation</Text>
          </View>
          <View style={styles.techCategory}>
            <Text style={styles.techCategoryTitle}>Backend</Text>
            <Text style={styles.techItem}>• Node.js + Express</Text>
            <Text style={styles.techItem}>• MongoDB Atlas</Text>
            <Text style={styles.techItem}>• Firebase Authentication</Text>
          </View>
          <View style={styles.techCategory}>
            <Text style={styles.techCategoryTitle}>Services</Text>
            <Text style={styles.techItem}>• Google Maps API</Text>
            <Text style={styles.techItem}>• AWS S3</Text>
            <Text style={styles.techItem}>• Push Notifications</Text>
          </View>
        </View>
      </View>

      {/* App Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Information</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Released</Text>
            <Text style={styles.infoValue}>September 2024</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>Android & iOS</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>Civic Engagement</Text>
          </View>
        </View>
      </View>

      {/* Contact Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <TouchableOpacity
          style={styles.contactItem}
          onPress={() => handleEmailPress('support@nagarmitra.gov.in')}
        >
          <Ionicons name="mail-outline" size={20} color="#FF4500" />
          <Text style={styles.contactText}>support@nagarmitra.gov.in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.contactItem}
          onPress={() => Linking.openURL('tel:1800-123-4567')}
        >
          <Ionicons name="call-outline" size={20} color="#FF4500" />
          <Text style={styles.contactText}>1800-123-4567 (Helpline)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.contactItem}
          onPress={() => handleLinkPress('https://nagarmitra.gov.in')}
        >
          <Ionicons name="globe-outline" size={20} color="#FF4500" />
          <Text style={styles.contactText}>www.nagarmitra.gov.in</Text>
        </TouchableOpacity>
      </View>

      {/* Legal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <TouchableOpacity style={styles.legalItem}>
          <Text style={styles.legalText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.legalItem}>
          <Text style={styles.legalText}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.legalItem}>
          <Text style={styles.legalText}>Open Source Licenses</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Made with ❤️ for a better tomorrow
        </Text>
        <Text style={styles.copyrightText}>
          © 2024 NagarMitra. All rights reserved.
        </Text>
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
  placeholder: {
    width: 24, // Same as back button to center the title
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF450015',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF4500',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
    fontWeight: '600',
  },
  taglineEnglish: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  missionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'justify',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF450015',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 5,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  teamMember: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF450015',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 14,
    color: '#FF4500',
    fontWeight: '500',
    marginBottom: 6,
  },
  memberDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  techStack: {
    gap: 20,
  },
  techCategory: {
    marginBottom: 10,
  },
  techCategoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4500',
    marginBottom: 8,
  },
  techItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  infoItem: {
    width: '47%',
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF4500',
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  contactText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  legalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  legalText: {
    fontSize: 16,
    color: '#333',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 16,
    color: '#FF4500',
    marginBottom: 10,
    textAlign: 'center',
  },
  copyrightText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default AboutUsScreen;