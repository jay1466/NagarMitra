import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Image,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from '../lib/firebase';
import { userAPI } from '../api/client';
import LocationPicker from '../components/LocationPicker';

import { tc, tct, themedStyles } from '../theme';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const AUTH_ERRORS = {
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/user-not-found': 'No account found with this email. Please sign up first.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/email-already-in-use': 'An account already exists with this email. Try logging in.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
  'auth/network-request-failed': 'No internet connection. Please check your network.',
  'auth/missing-password': 'Please enter your password.',
  'auth/operation-not-allowed': 'Email sign-in is not enabled for this app yet.',
  'auth/configuration-not-found': 'Email sign-in is not enabled for this app yet.',
};

function formatAuthError(err) {
  return AUTH_ERRORS[err?.code] || 'Something went wrong. Please try again.';
}

function Field({ label, icon, error, right, inputRef, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputRowFocused, error && styles.inputRowError]}>
        <Ionicons name={icon} size={20} color={focused ? tc('#FF4500') : tc('#888')} style={styles.inputIcon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholderTextColor={tc('#9A9A9A')}
          selectionColor={tc('#FF4500')}
          cursorColor={tc('#FF4500')}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {right}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [place, setPlace] = useState({ state: null, district: null });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('remember_me')
      .then((saved) => setRememberMe(saved !== '0'))
      .catch(() => {});
  }, []);

  const switchMode = (next) => {
    setMode(next);
    setErrors({});
  };

  const validate = () => {
    const e = {};
    if (mode === 'signup' && name.trim().length < 2) e.name = 'Please enter your full name.';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Please enter a valid email address.';
    if (mode === 'signup' && (!place.state || !place.district)) e.place = 'Please choose your state and district.';
    if (!password) e.password = 'Please enter your password.';
    else if (mode === 'signup' && password.length < 6) e.password = 'Use at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    if (loading || !validate()) return;
    setLoading(true);
    try {
      // Save first: the auth listener may unmount this screen as soon as we sign in
      await AsyncStorage.setItem('remember_me', rememberMe ? '1' : '0').catch(() => {});

      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // Profile details are best-effort: the account already exists at this point
        await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
        userAPI
          .updateProfile({ displayName: name.trim(), state: place.state, district: place.district })
          .catch(() => {});
        sendEmailVerification(cred.user).catch(() => {});
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e) {
      setLoading(false);
      const message = formatAuthError(e);
      if (['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(e?.code)) {
        setErrors({ password: message });
      } else if (['auth/invalid-email', 'auth/user-not-found', 'auth/email-already-in-use'].includes(e?.code)) {
        setErrors({ email: message });
      } else {
        Alert.alert(mode === 'signup' ? 'Sign up failed' : 'Login failed', message);
      }
    }
  };

  const onForgotPassword = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setErrors({ email: 'Enter your email above, then tap “Forgot password?”.' });
      emailRef.current?.focus();
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Check your email', `We sent a password reset link to ${email.trim()}.`);
    } catch (e) {
      Alert.alert('Could not send reset email', formatAuthError(e));
    }
  };

  const isSignup = mode === 'signup';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.logoText}>NagarMitra</Text>
          <Text style={styles.tagline}>जन की आवाज, सरकार का समाधान</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.modeSelector}>
            {['login', 'signup'].map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => switchMode(m)}
                style={[styles.modeButton, mode === m && styles.modeButtonActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
              >
                <Text style={[styles.modeButtonText, mode === m && styles.modeButtonTextActive]}>
                  {m === 'login' ? 'Login' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.title}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.subtitle}>
            {isSignup ? 'Report civic issues and track them to resolution.' : 'Log in to continue to NagarMitra.'}
          </Text>

          {isSignup && (
            <Field
              label="Full name"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Jay Patel"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              error={errors.name}
            />
          )}

          <Field
            inputRef={emailRef}
            label="Email address"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={errors.email}
          />

          {isSignup && (
            <View style={styles.inputGroup}>
              <LocationPicker
                label="Your state & district"
                value={place}
                onChange={(p) => setPlace({ state: p.state, district: p.district })}
              />
              {!!errors.place && <Text style={styles.errorText}>{errors.place}</Text>}
            </View>
          )}

          <Field
            inputRef={passwordRef}
            label="Password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder={isSignup ? 'At least 6 characters' : 'Enter your password'}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            textContentType={isSignup ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            error={errors.password}
            right={
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeButton}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={tct('#666')} />
              </TouchableOpacity>
            }
          />

          <View style={styles.rememberContainer}>
            <Text style={styles.rememberText}>Stay logged in</Text>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              trackColor={{ false: tc('#DDD'), true: tc('#FFB08A') }}
              thumbColor={rememberMe ? tc('#FF4500') : '#F4F4F4'}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>{isSignup ? 'Create Account' : 'Login'}</Text>
            )}
          </TouchableOpacity>

          {!isSignup && (
            <TouchableOpacity onPress={onForgotPassword} style={styles.linkButton}>
              <Text style={styles.forgotPassword}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => switchMode(isSignup ? 'login' : 'signup')} style={styles.linkButton}>
            <Text style={styles.switchText}>
              {isSignup ? 'Already have an account? ' : 'New to NagarMitra? '}
              <Text style={styles.switchTextBold}>{isSignup ? 'Log in' : 'Create an account'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: tc('#FFF7F3') },
  scrollContainer: { flexGrow: 1, padding: 20, paddingBottom: 40, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 20 },
  logoImage: { width: 64, height: 64 },
  logoText: { fontSize: 28, fontWeight: 'bold', color: tct('#FF4500'), marginTop: 6 },
  tagline: { fontSize: 15, color: tct('#FF4500'), fontWeight: '600', marginTop: 4, fontStyle: 'italic' },
  card: {
    backgroundColor: tc('#FFF'),
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: tc('#000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  modeSelector: { flexDirection: 'row', backgroundColor: tc('#F2F2F2'), borderRadius: 25, padding: 4, marginBottom: 20 },
  modeButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 21 },
  modeButtonActive: { backgroundColor: tc('#FF4500') },
  modeButtonText: { fontSize: 16, fontWeight: '600', color: tct('#666') },
  modeButtonTextActive: { color: '#FFF' },
  title: { fontSize: 22, fontWeight: 'bold', color: tct('#1A1A1A') },
  subtitle: { fontSize: 14, color: tct('#666'), marginTop: 4, marginBottom: 18 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: tct('#333'), marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: tc('#DDD'),
    borderRadius: 10,
    backgroundColor: tc('#FAFAFA'),
    minHeight: 50,
  },
  inputRowFocused: { borderColor: tc('#FF4500'), backgroundColor: tc('#FFF') },
  inputRowError: { borderColor: tc('#DC3545') },
  inputIcon: { marginLeft: 12 },
  // Explicit text colour: without it Android dark mode renders white text on this white field
  input: { flex: 1, fontSize: 16, color: tct('#1A1A1A'), paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 14 : 10 },
  eyeButton: { paddingHorizontal: 12, paddingVertical: 10 },
  errorText: { color: tct('#DC3545'), fontSize: 13, marginTop: 5 },
  rememberContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 },
  rememberText: { fontSize: 15, color: tct('#333') },
  submitButton: {
    backgroundColor: tc('#FF4500'),
    minHeight: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  submitButtonDisabled: { backgroundColor: tc('#FF9F7A') },
  buttonText: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
  linkButton: { paddingVertical: 10, alignItems: 'center' },
  forgotPassword: { fontSize: 15, color: tct('#FF4500'), fontWeight: '600' },
  switchText: { fontSize: 14, color: tct('#666') },
  switchTextBold: { color: tct('#FF4500'), fontWeight: 'bold' },
}));
