import { createContext, useContext } from 'react';

// pref: 'system' | 'light' | 'dark' ; scheme: the resolved 'light' | 'dark'
export const ThemeContext = createContext({ pref: 'system', scheme: 'light', setPref: () => {} });
export const useThemePref = () => useContext(ThemeContext);
