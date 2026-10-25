import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, Button, ScrollView, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useState, useCallback } from 'react';
import { BASE_URL } from './src/config';
import RaiseScreen from './src/screens/RaiseScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import OthersScreen from './src/screens/OthersScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import AboutUsScreen from './src/screens/AboutUsScreen';
import FAQScreen from './src/screens/FAQScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import { auth, onAuthStateChanged, signOut } from './src/lib/firebase';
import BotpressWidget from './src/components/BotpressWidget';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeScreen = ({ navigation }) => {
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [stats, setStats] = React.useState({
    responseTime: '12 hrs',
    resolutionRate: '90%',
    totalReports: '1,247',
    resolved: '1,120'
  });
  
  const slides = [
    {
      id: 1,
      title: 'Building a Smarter City',
      image: 'https://via.placeholder.com/350x200/FF4500/FFFFFF?text=Smart+City',
      description: 'Join thousands of citizens making their cities better'
    },
    {
      id: 2,
      title: 'Your Voice, Your Community',
      image: 'https://via.placeholder.com/350x200/28A745/FFFFFF?text=Community',
      description: 'Every report makes a difference in your neighborhood'
    },
    {
      id: 3,
      title: 'Resolve Issues Together',
      image: 'https://via.placeholder.com/350x200/007BFF/FFFFFF?text=Resolution',
      description: 'See real results from your civic participation'
    }
  ];

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScrollView style={homeStyles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={homeStyles.header}>
        <View style={homeStyles.logoSection}>
          <Image 
            source={require('./assets/logo.png')} 
            style={homeStyles.logoImage} 
            resizeMode="contain"
          />
          <Text style={homeStyles.logoText}>NagarMitra</Text>
        </View>
        <TouchableOpacity 
          style={homeStyles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person-circle" size={32} color="#FF4500" />
        </TouchableOpacity>
      </View>

      {/* Location Display */}
      <View style={homeStyles.locationSection}>
        <Ionicons name="location" size={16} color="#666" />
        <Text style={homeStyles.locationText}>Bhubaneswar, Ward 15</Text>
      </View>

      {/* Slideshow */}
      <View style={homeStyles.slideshowContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const slideSize = event.nativeEvent.layoutMeasurement.width;
            const index = Math.floor(event.nativeEvent.contentOffset.x / slideSize);
            setCurrentSlide(index);
          }}
        >
          {slides.map((slide) => (
            <View key={slide.id} style={homeStyles.slide}>
              <Image source={{ uri: slide.image }} style={homeStyles.slideImage} />
              <View style={homeStyles.slideOverlay}>
                <Text style={homeStyles.slideTitle}>{slide.title}</Text>
                <Text style={homeStyles.slideDescription}>{slide.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        
        {/* Slide Indicators */}
        <View style={homeStyles.slideIndicators}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                homeStyles.slideIndicator,
                currentSlide === index && homeStyles.slideIndicatorActive
              ]}
            />
          ))}
        </View>
      </View>

      {/* Main Action Button */}
      <TouchableOpacity 
        style={homeStyles.raiseComplaintButton}
        onPress={() => navigation.navigate('Raise')}
      >
        <Ionicons name="add-circle" size={24} color="#FFF" />
        <Text style={homeStyles.raiseComplaintText}>Raise a Complaint</Text>
        <Text style={homeStyles.raiseComplaintSubtext}>Report civic issues effortlessly</Text>
      </TouchableOpacity>

      {/* Statistics Cards */}
      <View style={homeStyles.statsContainer}>
        <View style={homeStyles.statsRow}>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statValue}>{stats.responseTime}</Text>
            <Text style={homeStyles.statLabel}>Avg. Response Time</Text>
          </View>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statValue}>{stats.resolutionRate}</Text>
            <Text style={homeStyles.statLabel}>Resolution Rate</Text>
          </View>
        </View>
        <View style={homeStyles.statsRow}>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statValue}>{stats.totalReports}</Text>
            <Text style={homeStyles.statLabel}>Total Reports</Text>
          </View>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statValue}>{stats.resolved}</Text>
            <Text style={homeStyles.statLabel}>Issues Resolved</Text>
          </View>
        </View>
      </View>

      {/* Recent Updates */}
      <View style={homeStyles.recentUpdatesContainer}>
        <Text style={homeStyles.sectionTitle}>Recent Updates</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={homeStyles.updateCard}>
            <Ionicons name="checkmark-circle" size={20} color="#28A745" />
            <Text style={homeStyles.updateText}>Pothole on MG Road fixed</Text>
            <Text style={homeStyles.updateTime}>2 hrs ago</Text>
          </View>
          <View style={homeStyles.updateCard}>
            <Ionicons name="construct" size={20} color="#FFC107" />
            <Text style={homeStyles.updateText}>Street light repair in progress</Text>
            <Text style={homeStyles.updateTime}>5 hrs ago</Text>
          </View>
          <View style={homeStyles.updateCard}>
            <Ionicons name="checkmark-circle" size={20} color="#28A745" />
            <Text style={homeStyles.updateText}>Garbage cleared from Park Street</Text>
            <Text style={homeStyles.updateTime}>1 day ago</Text>
          </View>
        </ScrollView>
      </View>

      {/* Footer */}
      <View style={homeStyles.footer}>
        <Text style={homeStyles.footerTitle}>Need Help?</Text>
        <View style={homeStyles.contactRow}>
          <Ionicons name="call" size={16} color="#FF4500" />
          <Text style={homeStyles.contactText}>Helpline: 1800-123-4567</Text>
        </View>
        <View style={homeStyles.contactRow}>
          <Ionicons name="mail" size={16} color="#FF4500" />
          <Text style={homeStyles.contactText}>support@nagarmitra.gov.in</Text>
        </View>
      </View>
    </ScrollView>
  );
};

// Stack Navigator for Others section
const OthersStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="OthersMain">
    <Stack.Screen name="OthersMain" component={OthersScreen} />
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="AboutUs" component={AboutUsScreen} />
    <Stack.Screen name="FAQ" component={FAQScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="Feedback" component={FeedbackScreen} />
  </Stack.Navigator>
);

// Stack Navigator for Home section (to include profile navigation)
const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="HomeMain">
    <Stack.Screen name="HomeMain" component={HomeScreen} />
    <Stack.Screen name="Profile" component={ProfileScreen} />
  </Stack.Navigator>
);

export default function App() {
  const [showOnboarding, setShowOnboarding] = React.useState(null); // null=loading
  const [user, setUser] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem('onboarding_seen_v1');
        setShowOnboarding(!seen);
      } catch {
        setShowOnboarding(true);
      }
    })();
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('onboarding_seen_v1', '1');
    setShowOnboarding(false);
  };

  // Observe Firebase auth state
  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      // Respect remember_me: if user is signed in but remember_me was set to 0, sign out once.
      const remember = await AsyncStorage.getItem('remember_me');
      if (u && remember === '0') {
        try { await signOut(auth); } catch {}
        setUser(null);
      } else {
        setUser(u);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);
  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: '#FF6A00', // dark orange
      background: '#FFFFFF',
      text: '#111111',
      card: '#FFFFFF',
      border: '#E5E5E5',
    },
  };

  if (showOnboarding === null || !authReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer theme={theme}>
      {showOnboarding ? (
        <OnboardingScreen onDone={completeOnboarding} />
      ) : !user ? (
        <AuthScreen />
      ) : (
        <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => {
            let icon = 'ellipse';
            if (route.name === 'Home') icon = focused ? 'home' : 'home-outline';
            else if (route.name === 'Dashboard') icon = focused ? 'stats-chart' : 'stats-chart-outline';
            else if (route.name === 'Raise') icon = focused ? 'add-circle' : 'add-circle-outline';
            else if (route.name === 'Community') icon = focused ? 'people' : 'people-outline';
            else if (route.name === 'Others') icon = focused ? 'menu' : 'menu-outline';
            return <Ionicons name={icon} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#FF4500',
          tabBarInactiveTintColor: '#666',
        })}
        >
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Raise" component={RaiseScreen} />
        <Tab.Screen name="Community" component={CommunityScreen} />
        <Tab.Screen name="Others" component={OthersStack} />
        </Tab.Navigator>
      )}
    </NavigationContainer>
    <BotpressWidget />
  </View>
  );
}

const { width } = Dimensions.get('window');

const homeStyles = StyleSheet.create({
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
    paddingBottom: 10,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF4500',
    letterSpacing: 0.5,
  },
  profileButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 69, 0, 0.1)',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    gap: 5,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
  },
  slideshowContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  slide: {
    width: width - 40,
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  slideImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  slideOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 15,
  },
  slideTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 5,
  },
  slideDescription: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
  },
  slideIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  slideIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDD',
  },
  slideIndicatorActive: {
    backgroundColor: '#FF4500',
    width: 20,
  },
  raiseComplaintButton: {
    backgroundColor: '#FF4500',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  raiseComplaintText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  raiseComplaintSubtext: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginTop: 4,
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF4500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  recentUpdatesContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  updateCard: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 200,
    borderLeftWidth: 3,
    borderLeftColor: '#28A745',
  },
  updateText: {
    fontSize: 14,
    color: '#000',
    marginVertical: 4,
  },
  updateTime: {
    fontSize: 12,
    color: '#666',
  },
  footer: {
    backgroundColor: '#F8F9FA',
    padding: 20,
    marginTop: 20,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
  },
});
