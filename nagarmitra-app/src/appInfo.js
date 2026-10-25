import Constants from 'expo-constants';

// Single source of truth for what the About/Settings/Others screens show.
// The version itself comes from app.json so it can never drift from the build.
export const APP_VERSION = Constants.expoConfig?.version ?? '1.2.0';
export const RELEASE_DATE = 'October 2026';
export const COPYRIGHT_YEAR = new Date().getFullYear();
