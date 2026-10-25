import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { BASE_URL } from '../config';
import { APP_VERSION } from '../appInfo';

// Sends app errors to the server so problems on real phones can be diagnosed.
// Fire-and-forget: reporting must never cause another error.
export function reportClientError({ kind = 'error', message, stack, screen, fatal = false }) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 4000);
    fetch(`${BASE_URL}/api/v1/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        kind,
        fatal,
        message: String(message || '').slice(0, 1000),
        stack: String(stack || '').slice(0, 4000),
        screen,
        appVersion: APP_VERSION,
        platform: `${Platform.OS} ${Platform.Version}`,
        device: [Device.manufacturer, Device.modelName].filter(Boolean).join(' '),
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

// Capture JS errors that escape every boundary (these close the app in release builds)
export function installGlobalErrorHandler() {
  const g = global;
  if (!g.ErrorUtils || g.__nmHandlerInstalled) return;
  g.__nmHandlerInstalled = true;
  const previous = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportClientError({ kind: 'js_exception', message: error?.message, stack: error?.stack, fatal: !!isFatal });
    // give the report a moment to leave the phone before the default handler closes the app
    setTimeout(() => previous?.(error, isFatal), isFatal ? 800 : 0);
  });
}
