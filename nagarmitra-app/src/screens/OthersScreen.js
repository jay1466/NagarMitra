import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, signOut } from '../lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OthersScreen = ({ navigation }) => {
  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              await AsyncStorage.removeItem('remember_me');
              // Navigation will be handled by App.js auth state listener
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ],
    );
  };

  const menuItems = [
    {
      id: 'profile',
      title: 'My Profile',
      icon: 'person-outline',
      onPress: () => navigation.navigate('Profile'),
      color: '#FF4500',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: 'notifications-outline',
      onPress: () => navigation.navigate('Notifications'),
      color: '#FF4500',
    },
    {
      id: 'about',
      title: 'About Us',
      icon: 'information-circle-outline',
      onPress: () => navigation.navigate('AboutUs'),
      color: '#FF4500',
    },
    {
      id: 'faq',
      title: 'FAQ',
      icon: 'help-circle-outline',
      onPress: () => navigation.navigate('FAQ'),
      color: '#FF4500',
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings-outline',
      onPress: () => navigation.navigate('Settings'),
      color: '#FF4500',
    },
    {
      id: 'feedback',
      title: 'Feedback',
      icon: 'chatbubble-outline',
      onPress: () => navigation.navigate('Feedback'),
      color: '#FF4500',
    },
    {
      id: 'logout',
      title: 'Logout',
      icon: 'log-out-outline',
      onPress: handleLogout,
      color: '#DC3545',
    },
  ];

  const renderMenuItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemContent}>
        <View style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}>
          <Ionicons name={item.icon} size={24} color={item.color} />
        </View>
        <Text style={styles.menuItemText}>{item.title}</Text>
        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoSection}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>NagarMitra</Text>
        </View>
        <Text style={styles.subtitle}>More Options</Text>
      </View>

      {/* User Info Section */}
      <View style={styles.userSection}>
        <View style={styles.userAvatar}>
          <Ionicons name="person" size={30} color="#FF4500" />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {auth.currentUser?.displayName || auth.currentUser?.email || 'User'}
          </Text>
          <Text style={styles.userEmail}>
            {auth.currentUser?.email || 'No email provided'}
          </Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {menuItems.map(renderMenuItem)}
      </View>

      {/* App Version */}
      <View style={styles.footer}>
        <Text style={styles.versionText}>NagarMitra v1.0.0</Text>
        <Text style={styles.footerText}>जन की आवाज, सरकार का समाधान</Text>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF4500',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 38,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF450015',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  menuContainer: {
    paddingTop: 10,
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  footerText: {
    fontSize: 12,
    color: '#FF4500',
    fontStyle: 'italic',
  },
});

export default OthersScreen;