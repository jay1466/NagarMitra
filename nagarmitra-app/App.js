import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, ScrollView, Image, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, RefreshControl, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
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
import ErrorBoundary, { withErrorBoundary } from './src/components/ErrorBoundary';
import { complaintAPI } from './src/api/client';
import { SessionProvider, useSession } from './src/context/SessionContext';
import NotificationBell from './src/components/NotificationBell';
import ComplaintDetailScreen from './src/screens/ComplaintDetailScreen';
import WorkQueueScreen from './src/screens/WorkQueueScreen';
import AdminScreen from './src/screens/AdminScreen';
import AdminUsersScreen from './src/screens/AdminUsersScreen';
import { setupNotifications, showLocalAlert, onNotificationTap } from './src/services/notificationService';
import { installGlobalErrorHandler } from './src/services/crashReporter';

import { tc, tct, themedStyles, setScheme } from './src/theme';
import { ThemeContext } from './src/context/ThemeContext';
installGlobalErrorHandler();

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();
const Stack = createNativeStackNavigator();

const formatAgo = (date) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (mins < 60) return `${mins || 1} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const HomeScreen = ({ navigation }) => {
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [stats, setStats] = React.useState(null);
  const [updates, setUpdates] = React.useState([]);
  const [loadingStats, setLoadingStats] = React.useState(true);
  const [statsError, setStatsError] = React.useState(false);
  const slideRef = React.useRef(null);
  const firstName = (auth.currentUser?.displayName || '').split(' ')[0];

  const slides = [
    { id: 1, title: 'Building a Smarter City', icon: 'business', color: tct('#FF4500'), description: 'Join citizens making their cities better' },
    { id: 2, title: 'Your Voice, Your Community', icon: 'people', color: tct('#28A745'), description: 'Every report makes a difference in your neighborhood' },
    { id: 3, title: 'Resolve Issues Together', icon: 'checkmark-done', color: tct('#007BFF'), description: 'See real results from your civic participation' },
  ];

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % slides.length;
        slideRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = React.useCallback(async () => {
    setLoadingStats(true);
    setStatsError(false);
    try {
      const [all, resolved, inProgress, recent] = await Promise.all([
        complaintAPI.getList({ limit: 1 }),
        complaintAPI.getList({ status: 'resolved', limit: 1 }),
        complaintAPI.getList({ status: 'in_progress', limit: 1 }),
        complaintAPI.getList({ limit: 5 }),
      ]);
      const total = all.total || 0;
      setStats({
        totalReports: total,
        resolved: resolved.total || 0,
        inProgress: inProgress.total || 0,
        resolutionRate: total ? `${Math.round(((resolved.total || 0) / total) * 100)}%` : '0%',
      });
      setUpdates(recent.items || []);
    } catch {
      setStatsError(true);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { loadStats(); }, [loadStats]));

  const statValue = (v) => (loadingStats && !stats ? '…' : stats ? String(v) : '–');

  return (
    <ScrollView
      style={homeStyles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loadingStats && !!stats} onRefresh={loadStats} colors={[tc('#FF4500')]} />}
    >
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NotificationBell />
          <TouchableOpacity
            style={homeStyles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-circle" size={32} color={tct('#FF4500')} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={homeStyles.locationSection}>
        <Ionicons name="hand-right-outline" size={16} color={tct('#666')} />
        <Text style={homeStyles.locationText}>{firstName ? `Hello, ${firstName}!` : 'Welcome to NagarMitra!'}</Text>
      </View>

      {/* Slideshow */}
      <View style={homeStyles.slideshowContainer}>
        <ScrollView
          ref={slideRef}
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
            <View key={slide.id} style={homeStyles.slidePage}>
             <View style={homeStyles.slide}>
              <View style={[homeStyles.slideImage, { backgroundColor: slide.color }]}>
                <Ionicons name={slide.icon} size={72} color="rgba(255,255,255,0.9)" />
              </View>
              <View style={homeStyles.slideOverlay}>
                <Text style={homeStyles.slideTitle}>{slide.title}</Text>
                <Text style={homeStyles.slideDescription}>{slide.description}</Text>
              </View>
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
        {statsError && (
          <TouchableOpacity style={homeStyles.errorBanner} onPress={loadStats}>
            <Ionicons name="cloud-offline-outline" size={18} color={tct('#DC3545')} />
            <Text style={homeStyles.errorBannerText}>Couldn't load live numbers. Tap to retry.</Text>
          </TouchableOpacity>
        )}
        <View style={homeStyles.statsRow}>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statValue}>{statValue(stats?.inProgress)}</Text>
            <Text style={homeStyles.statLabel}>In Progress</Text>
          </View>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statValue}>{statValue(stats?.resolutionRate)}</Text>
            <Text style={homeStyles.statLabel}>Resolution Rate</Text>
          </View>
        </View>
        <View style={homeStyles.statsRow}>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statValue}>{statValue(stats?.totalReports)}</Text>
            <Text style={homeStyles.statLabel}>Total Reports</Text>
          </View>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statValue}>{statValue(stats?.resolved)}</Text>
            <Text style={homeStyles.statLabel}>Issues Resolved</Text>
          </View>
        </View>
      </View>

      {/* Recent Updates */}
      <View style={homeStyles.recentUpdatesContainer}>
        <Text style={homeStyles.sectionTitle}>Recent Updates</Text>
        {loadingStats && !updates.length ? (
          <ActivityIndicator color={tct('#FF4500')} />
        ) : updates.length === 0 ? (
          <Text style={homeStyles.emptyText}>No reports yet. Be the first to raise one!</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {updates.map((u) => (
              <View key={u._id} style={[homeStyles.updateCard, u.status === 'resolved' ? null : { borderLeftColor: tc('#FFC107') }]}>
                <Ionicons
                  name={u.status === 'resolved' ? 'checkmark-circle' : 'construct'}
                  size={20}
                  color={u.status === 'resolved' ? tc('#28A745') : tc('#FFC107')}
                />
                <Text style={homeStyles.updateText} numberOfLines={2}>{u.title || u.category}</Text>
                <Text style={homeStyles.updateTime}>{formatAgo(u.createdAt)} · {String(u.status || '').replace('_', ' ')}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Footer */}
      <View style={homeStyles.footer}>
        <Text style={homeStyles.footerTitle}>Need Help?</Text>
        <View style={homeStyles.contactRow}>
          <Ionicons name="call" size={16} color={tct('#FF4500')} />
          <Text style={homeStyles.contactText}>Helpline: 1800-123-4567</Text>
        </View>
        <View style={homeStyles.contactRow}>
          <Ionicons name="mail" size={16} color={tct('#FF4500')} />
          <Text style={homeStyles.contactText}>support@nagarmitra.gov.in</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const Safe = {
  HomeScreen: withErrorBoundary(HomeScreen),
  DashboardScreen: withErrorBoundary(DashboardScreen),
  RaiseScreen: withErrorBoundary(RaiseScreen),
  CommunityScreen: withErrorBoundary(CommunityScreen),
  OthersScreen: withErrorBoundary(OthersScreen),
  ProfileScreen: withErrorBoundary(ProfileScreen),
  NotificationsScreen: withErrorBoundary(NotificationsScreen),
  AboutUsScreen: withErrorBoundary(AboutUsScreen),
  FAQScreen: withErrorBoundary(FAQScreen),
  SettingsScreen: withErrorBoundary(SettingsScreen),
  FeedbackScreen: withErrorBoundary(FeedbackScreen),
  ComplaintDetailScreen: withErrorBoundary(ComplaintDetailScreen),
  WorkQueueScreen: withErrorBoundary(WorkQueueScreen),
  AdminScreen: withErrorBoundary(AdminScreen),
  AdminUsersScreen: withErrorBoundary(AdminUsersScreen),
};

const TAB_ICONS = {
  Home: 'home',
  Dashboard: 'stats-chart',
  Raise: 'add-circle',
  Community: 'people',
  Others: 'menu',
  Work: 'briefcase',
  Admin: 'shield-checkmark',
};

// Each role gets the tabs it needs: citizens report, officers work, admins oversee.
function MainTabs() {
  const { role, isAdmin, unreadCount, ready } = useSession();
  // Wait for the role so the tabs don't switch under the user's finger
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tc('#FFF') }}>
        <ActivityIndicator size="large" color={tct('#FF4500')} />
      </View>
    );
  }
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={focused ? TAB_ICONS[route.name] : `${TAB_ICONS[route.name]}-outline`} size={size} color={color} />
        ),
        tabBarActiveTintColor: tc('#FF4500'),
        tabBarInactiveTintColor: tc('#666'),
      })}
    >
      {isAdmin && <Tab.Screen name="Admin" component={Safe.AdminScreen} />}
      {role !== 'citizen' && (
        <Tab.Screen name="Work" component={Safe.WorkQueueScreen} options={{ title: isAdmin ? 'Complaints' : 'Work Queue' }} />
      )}
      {role === 'citizen' && <Tab.Screen name="Home" component={HomeStack} />}
      <Tab.Screen name="Dashboard" component={Safe.DashboardScreen} />
      {role === 'citizen' && <Tab.Screen name="Raise" component={Safe.RaiseScreen} />}
      <Tab.Screen name="Community" component={Safe.CommunityScreen} />
      <Tab.Screen
        name="Others"
        component={OthersStack}
        options={{ tabBarBadge: unreadCount > 0 ? unreadCount : undefined, title: 'More' }}
      />
    </Tab.Navigator>
  );
}

function SignedInApp() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen name="ComplaintDetail" component={Safe.ComplaintDetailScreen} />
      <RootStack.Screen name="Inbox" component={Safe.NotificationsScreen} />
      <RootStack.Screen name="AdminQueue" component={Safe.WorkQueueScreen} />
      <RootStack.Screen name="AdminUsers" component={Safe.AdminUsersScreen} />
    </RootStack.Navigator>
  );
}

// Stack Navigator for Others section
const OthersStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="OthersMain">
    <Stack.Screen name="OthersMain" component={Safe.OthersScreen} />
    <Stack.Screen name="Profile" component={Safe.ProfileScreen} />
    <Stack.Screen name="Notifications" component={Safe.NotificationsScreen} />
    <Stack.Screen name="AboutUs" component={Safe.AboutUsScreen} />
    <Stack.Screen name="FAQ" component={Safe.FAQScreen} />
    <Stack.Screen name="Settings" component={Safe.SettingsScreen} />
    <Stack.Screen name="Feedback" component={Safe.FeedbackScreen} />
  </Stack.Navigator>
);

// Stack Navigator for Home section (to include profile navigation)
const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="HomeMain">
    <Stack.Screen name="HomeMain" component={Safe.HomeScreen} />
    <Stack.Screen name="Profile" component={Safe.ProfileScreen} />
  </Stack.Navigator>
);

export default function App() {
  const systemScheme = useColorScheme();
  const [themePref, setThemePrefState] = React.useState('system');
  const scheme = themePref === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePref;
  // Must be set before any child renders so tc()/themedStyles() resolve correctly
  setScheme(scheme);

  React.useEffect(() => {
    AsyncStorage.getItem('theme_pref')
      .then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setThemePrefState(v); })
      .catch(() => {});
  }, []);
  const setThemePref = React.useCallback((v) => {
    setThemePrefState(v);
    AsyncStorage.setItem('theme_pref', v).catch(() => {});
  }, []);
  const themeValue = React.useMemo(() => ({ pref: themePref, scheme, setPref: setThemePref }), [themePref, scheme, setThemePref]);

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
    try {
      await AsyncStorage.setItem('onboarding_seen_v1', '1');
    } catch {
      // Not fatal: onboarding may just show again next launch
    }
    setShowOnboarding(false);
  };

  // Observe Firebase auth state
  React.useEffect(() => {
    let firstEvent = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (u && firstEvent) {
          // Restored session at app start: honour "Stay logged in = off"
          const remember = await AsyncStorage.getItem('remember_me');
          if (remember === '0') {
            await signOut(auth).catch(() => {});
            u = null;
          }
        }
      } catch {
        // Storage unavailable: keep the session as Firebase reports it
      }
      firstEvent = false;
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);
  React.useEffect(() => {
    if (!user) return undefined;
    let stopTokenSync = () => {};
    setupNotifications().then((stop) => { stopTokenSync = stop; });
    const stopTaps = onNotificationTap((id) => {
      if (navigationRef.isReady()) navigationRef.navigate('ComplaintDetail', { id });
    });
    return () => {
      stopTokenSync();
      stopTaps();
    };
  }, [user]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: tc('#FF6A00'), // dark orange
      background: tc('#FFFFFF'),
      text: tc('#111111'),
      card: tc('#FFFFFF'),
      border: tc('#E5E5E5'),
    },
  };

  if (showOnboarding === null || !authReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tc('#FFF') }}>
        <Image source={require('./assets/logo.png')} style={{ width: 72, height: 72, marginBottom: 16 }} resizeMode="contain" />
        <ActivityIndicator size="large" color={tct('#FF4500')} />
      </View>
    );
  }

  return (
    <ThemeContext.Provider value={themeValue}>
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* key: remount the UI when the scheme changes so every stylesheet is rebuilt */}
      <SafeAreaView key={scheme} style={{ flex: 1, backgroundColor: tc('#FFF') }} edges={['top', 'left', 'right']}>
        <ErrorBoundary>
          <SessionProvider firebaseUser={user} onNewNotifications={showLocalAlert}>
          <NavigationContainer theme={theme} ref={navigationRef}>
            {showOnboarding ? (
              <OnboardingScreen onDone={completeOnboarding} />
            ) : !user ? (
              <AuthScreen />
            ) : (
              <SignedInApp />
            )}
          </NavigationContainer>
          {user && <BotpressWidget />}
          </SessionProvider>
        </ErrorBoundary>
      </SafeAreaView>
    </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}

const { width } = Dimensions.get('window');

const homeStyles = themedStyles(() => StyleSheet.create({
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
    color: tct('#FF4500'),
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
    color: tct('#666'),
  },
  slideshowContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  slidePage: {
    width,
    paddingHorizontal: 20,
  },
  slide: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  slideImage: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 50,
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
    backgroundColor: tc('#DDD'),
  },
  slideIndicatorActive: {
    backgroundColor: tc('#FF4500'),
    width: 20,
  },
  raiseComplaintButton: {
    backgroundColor: tc('#FF4500'),
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: tc('#FF4500'),
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
    backgroundColor: tc('#F8F9FA'),
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: tc('#FF4500'),
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: tct('#000'),
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: tct('#666'),
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tc('#FFEBEE'),
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorBannerText: {
    color: tct('#DC3545'),
    fontSize: 13,
    flex: 1,
  },
  emptyText: {
    color: tct('#888'),
    fontSize: 14,
  },
  recentUpdatesContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: tct('#000'),
    marginBottom: 15,
  },
  updateCard: {
    backgroundColor: tc('#F8F9FA'),
    padding: 12,
    borderRadius: 8,
    marginRight: 12,
    width: 200,
    borderLeftWidth: 3,
    borderLeftColor: tc('#28A745'),
  },
  updateText: {
    fontSize: 14,
    color: tct('#000'),
    marginVertical: 4,
  },
  updateTime: {
    fontSize: 12,
    color: tct('#666'),
  },
  footer: {
    backgroundColor: tc('#F8F9FA'),
    padding: 20,
    marginTop: 20,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: tct('#000'),
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
    color: tct('#666'),
  },
}));
