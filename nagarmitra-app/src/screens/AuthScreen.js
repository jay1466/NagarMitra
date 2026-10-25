import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, ScrollView, Alert, Platform, Image } from 'react-native';
import { auth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification, sendPasswordResetEmail, reload } from '../lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Camera from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'otp'
  const [authMethod, setAuthMethod] = useState('email'); // 'email' | 'phone'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [otp, setOtp] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissions, setPermissions] = useState({
    location: false,
    camera: false,
    microphone: false,
    notifications: false,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('remember_me');
      if (saved === '0') setRememberMe(false);
      else setRememberMe(true);
    })();
  }, []);

  // Request permissions after successful authentication
  const requestPermissions = async () => {
    setShowPermissions(true);
    
    // Location permission
    try {
      const locationResult = await Location.requestForegroundPermissionsAsync();
      setPermissions(prev => ({ ...prev, location: locationResult.status === 'granted' }));
    } catch (error) {
      console.log('Location permission error:', error);
    }

    // Camera permission
    try {
      const cameraResult = await Camera.requestCameraPermissionsAsync();
      setPermissions(prev => ({ ...prev, camera: cameraResult.status === 'granted' }));
    } catch (error) {
      console.log('Camera permission error:', error);
    }

    // Microphone permission
    try {
      const audioResult = await Audio.requestPermissionsAsync();
      setPermissions(prev => ({ ...prev, microphone: audioResult.status === 'granted' }));
    } catch (error) {
      console.log('Microphone permission error:', error);
    }

    // Notification permission
    try {
      const notificationResult = await Notifications.requestPermissionsAsync();
      setPermissions(prev => ({ ...prev, notifications: notificationResult.status === 'granted' }));
    } catch (error) {
      console.log('Notification permission error:', error);
    }
  };

  const onSubmit = async () => {
    try {
      setLoading(true);
      
      if (mode === 'signup') {
        if (authMethod === 'email') {
          if (!name || !email || !password || !city) {
            Alert.alert('Missing Information', 'Please fill in all required fields.');
            return;
          }
          
          const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
          try {
            await sendEmailVerification(cred.user);
            Alert.alert('Success', 'Account created! Please check your email for verification.');
          } catch (e) {
            // not fatal for login flow
          }
        } else {
          // Phone authentication would go here - for now just show OTP screen
          if (!name || !phone || !city) {
            Alert.alert('Missing Information', 'Please fill in all required fields.');
            return;
          }
          setMode('otp');
          Alert.alert('OTP Sent', 'Please enter the OTP sent to your phone number.');
          return;
        }
      } else if (mode === 'otp') {
        // Simulate OTP verification
        if (otp === '123456') {
          Alert.alert('Success', 'Phone number verified successfully!');
          // Here you would actually create the user account
        } else {
          Alert.alert('Error', 'Invalid OTP. Please try again.');
          return;
        }
      } else {
        // Login
        if (authMethod === 'email') {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } else {
          // Phone login would go here
          Alert.alert('Phone Login', 'Phone login not implemented in this demo.');
          return;
        }
      }
      
      await AsyncStorage.setItem('remember_me', rememberMe ? '1' : '0');
      
      // Request permissions after successful login/signup
      setTimeout(() => {
        requestPermissions();
      }, 500);
      
    } catch (e) {
      Alert.alert('Authentication Error', formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    try { await signOut(auth); } catch (e) { /* ignore */ }
  };

  const onResendVerification = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      alert('Verification email re-sent.');
    } catch (e) {
      alert(e.message);
    }
  };

  const onForgotPassword = async () => {
    if (!email) {
      alert('Enter your email to receive reset link');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert('Password reset email sent.');
    } catch (e) {
      alert(formatAuthError(e));
    }
  };

  function formatAuthError(err) {
    const code = err?.code || '';
    const map = {
      'auth/configuration-not-found': 'This sign-in method is not enabled for your Firebase project. Please enable Email/Password in Firebase Console → Authentication → Sign-in method.',
      'auth/invalid-email': 'The email address is invalid.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/email-already-in-use': 'This email is already in use. Try logging in.',
      'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
    };
    return `Firebase: ${map[code] || err.message || 'Unknown error'}`;
  }

  // Show permissions screen if user is authenticated and permissions are being requested
  if (user && showPermissions) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.permissionsContainer}>
          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={60} color="#FF4500" />
            <Text style={styles.title}>App Permissions</Text>
            <Text style={styles.subtitle}>We need these permissions to provide you with the best experience</Text>
          </View>

          <View style={styles.permissionsList}>
            <View style={styles.permissionItem}>
              <Ionicons name="location" size={24} color={permissions.location ? '#28A745' : '#666'} />
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>Location Access</Text>
                <Text style={styles.permissionDesc}>To auto-fill addresses and show nearby issues</Text>
              </View>
              <Ionicons name={permissions.location ? "checkmark-circle" : "close-circle"} size={24} color={permissions.location ? '#28A745' : '#DC3545'} />
            </View>

            <View style={styles.permissionItem}>
              <Ionicons name="camera" size={24} color={permissions.camera ? '#28A745' : '#666'} />
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>Camera Access</Text>
                <Text style={styles.permissionDesc}>To capture photos of civic issues</Text>
              </View>
              <Ionicons name={permissions.camera ? "checkmark-circle" : "close-circle"} size={24} color={permissions.camera ? '#28A745' : '#DC3545'} />
            </View>

            <View style={styles.permissionItem}>
              <Ionicons name="mic" size={24} color={permissions.microphone ? '#28A745' : '#666'} />
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>Microphone Access</Text>
                <Text style={styles.permissionDesc}>To record voice descriptions</Text>
              </View>
              <Ionicons name={permissions.microphone ? "checkmark-circle" : "close-circle"} size={24} color={permissions.microphone ? '#28A745' : '#DC3545'} />
            </View>

            <View style={styles.permissionItem}>
              <Ionicons name="notifications" size={24} color={permissions.notifications ? '#28A745' : '#666'} />
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>Notifications</Text>
                <Text style={styles.permissionDesc}>To keep you updated on your reports</Text>
              </View>
              <Ionicons name={permissions.notifications ? "checkmark-circle" : "close-circle"} size={24} color={permissions.notifications ? '#28A745' : '#DC3545'} />
            </View>
          </View>

          <TouchableOpacity 
            style={styles.continueButton} 
            onPress={() => setShowPermissions(false)}
          >
            <Text style={styles.buttonText}>Continue to App</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContainer}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>NagarMitra</Text>
        </View>
        <Text style={styles.tagline}>जन की आवाज, सरकार का समाधान</Text>
      </View>

      {user ? (
        <View style={styles.userInfo}>
          <Ionicons name="person-circle" size={60} color="#FF4500" />
          <Text style={styles.welcomeText}>Welcome back!</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.authContainer}>
          {/* Mode Selection */}
          {mode !== 'otp' && (
            <View style={styles.modeSelector}>
              <TouchableOpacity 
                onPress={() => setMode('login')} 
                style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
              >
                <Text style={[styles.modeButtonText, mode === 'login' && styles.modeButtonTextActive]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setMode('signup')} 
                style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
              >
                <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Authentication Method Selection */}
          {mode !== 'otp' && (
            <View style={styles.authMethodSelector}>
              <TouchableOpacity 
                onPress={() => setAuthMethod('email')} 
                style={[styles.authMethodButton, authMethod === 'email' && styles.authMethodButtonActive]}
              >
                <Ionicons name="mail" size={20} color={authMethod === 'email' ? '#FFF' : '#FF4500'} />
                <Text style={[styles.authMethodText, authMethod === 'email' && styles.authMethodTextActive]}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setAuthMethod('phone')} 
                style={[styles.authMethodButton, authMethod === 'phone' && styles.authMethodButtonActive]}
              >
                <Ionicons name="call" size={20} color={authMethod === 'phone' ? '#FFF' : '#FF4500'} />
                <Text style={[styles.authMethodText, authMethod === 'phone' && styles.authMethodTextActive]}>Phone</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {mode === 'otp' ? (
              <View style={styles.otpContainer}>
                <Text style={styles.otpTitle}>Enter Verification Code</Text>
                <Text style={styles.otpSubtitle}>We sent a 6-digit code to {phone}</Text>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                  keyboardType="numeric"
                  maxLength={6}
                  textAlign="center"
                />
              </View>
            ) : (
              <>
                {mode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Enter your full name"
                    />
                  </View>
                )}

                {authMethod === 'email' ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address *</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                ) : (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number *</Text>
                    <TextInput
                      style={styles.input}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="+91 98765 43210"
                      keyboardType="phone-pad"
                    />
                  </View>
                )}

                {mode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>City/Ward *</Text>
                    <TextInput
                      style={styles.input}
                      value={city}
                      onChangeText={setCity}
                      placeholder="Enter your city or ward"
                    />
                  </View>
                )}

                {authMethod === 'email' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Password *</Text>
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      secureTextEntry
                    />
                  </View>
                )}

                <View style={styles.rememberContainer}>
                  <Text style={styles.rememberText}>Stay logged in</Text>
                  <Switch 
                    value={rememberMe} 
                    onValueChange={setRememberMe}
                    trackColor={{ false: '#DDD', true: '#FF4500' }}
                    thumbColor={rememberMe ? '#FFF' : '#FFF'}
                  />
                </View>

                {mode === 'login' && authMethod === 'email' && (
                  <TouchableOpacity onPress={onForgotPassword}>
                    <Text style={styles.forgotPassword}>Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
            onPress={onSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Please wait...' : 
                mode === 'otp' ? 'Verify Code' :
                mode === 'login' ? 'Login' : 'Create Account'
              }
            </Text>
          </TouchableOpacity>

          {/* Back button for OTP */}
          {mode === 'otp' && (
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => setMode('signup')}
            >
              <Text style={styles.backButtonText}>Back to Sign Up</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF4500',
    marginTop: 5,
  },
  tagline: {
    fontSize: 16,
    color: '#FF4500',
    fontWeight: '600',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  userInfo: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 30,
    borderRadius: 15,
    marginVertical: 20,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 10,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    marginBottom: 20,
  },
  authContainer: {
    flex: 1,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 25,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
  },
  modeButtonActive: {
    backgroundColor: '#FF4500',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modeButtonTextActive: {
    color: '#FFF',
  },
  authMethodSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  authMethodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF4500',
    gap: 8,
  },
  authMethodButtonActive: {
    backgroundColor: '#FF4500',
  },
  authMethodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4500',
  },
  authMethodTextActive: {
    color: '#FFF',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
  },
  otpContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  otpTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  otpSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  otpInput: {
    borderWidth: 2,
    borderColor: '#FF4500',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 24,
    fontWeight: 'bold',
    width: 150,
    backgroundColor: '#FFF',
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  rememberText: {
    fontSize: 16,
    color: '#333',
  },
  forgotPassword: {
    fontSize: 16,
    color: '#FF4500',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  submitButton: {
    backgroundColor: '#FF4500',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#DC3545',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#FF4500',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#FF4500',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  permissionsContainer: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  permissionsList: {
    marginVertical: 30,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginVertical: 5,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  permissionText: {
    flex: 1,
    marginLeft: 15,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  permissionDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});
