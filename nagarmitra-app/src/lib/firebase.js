import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  reload,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from '../firebaseConfig';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  reload,
};
