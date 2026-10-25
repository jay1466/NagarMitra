import { StyleSheet } from 'react-native';

// App-wide light/dark theming.
//
// Screens keep writing their original (light) colours; `tc()` translates each
// one to the current scheme, and `themedStyles()` builds a stylesheet per
// scheme on first use. App.js sets the scheme and remounts the UI when it changes.

let scheme = 'light';
const listeners = new Set();

export function setScheme(next) {
  if (next !== 'dark' && next !== 'light') return;
  if (next === scheme) return;
  scheme = next;
  listeners.forEach((l) => l(scheme));
}
export const getScheme = () => scheme;
export const isDark = () => scheme === 'dark';
export function onSchemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------- colour math
function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const alpha = h.length === 8 ? h.slice(6, 8) : '';
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h / 6, s, l };
}

function hslToHex(h, s, l, alpha = '') {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}${alpha}`;
}

/** Translate a light-theme colour into its dark-theme counterpart. */
function toDark(hex) {
  const { r, g, b, alpha } = parseHex(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  if (s < 0.2) {
    // Neutrals: very light surfaces become dark surfaces (cards stay lighter
    // than the page behind them); text greys become light greys.
    if (l >= 0.88) return hslToHex(h, s * 0.3, 0.07 + (l - 0.88) * 0.55, alpha);
    return hslToHex(h, s * 0.3, Math.min(0.92, 1 - l * 0.85), alpha);
  }
  // Pale tinted backgrounds (status boxes, chips) become deep tints
  if (l >= 0.85) return hslToHex(h, Math.min(s, 0.45), 0.17, alpha);
  // Very dark brand colours would vanish on dark backgrounds: lift them
  if (l < 0.3) return hslToHex(h, s, 0.55, alpha);
  return hex; // brand / status colours read fine on dark
}

const cache = new Map();
/** Themed colour: returns `hex` in light mode and its dark counterpart in dark mode. */
export function tc(hex) {
  if (scheme === 'light' || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  let v = cache.get(hex);
  if (!v) {
    v = toDark(hex);
    cache.set(hex, v);
  }
  return v;
}

const textCache = new Map();
/**
 * Themed colour for TEXT/ICONS. Like tc(), but in dark mode coloured text is
 * lightened so it stays readable on dark and tinted backgrounds.
 */
export function tct(hex) {
  if (scheme === 'light' || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  let v = textCache.get(hex);
  if (!v) {
    const { r, g, b, alpha } = parseHex(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    v = s >= 0.2 && l < 0.68 ? hslToHex(h, Math.min(s, 0.85), 0.68, alpha) : tc(hex);
    textCache.set(hex, v);
  }
  return v;
}

/**
 * A stylesheet that is (re)built for the current scheme on first access.
 * Usage: const styles = themedStyles(() => StyleSheet.create({...tc('#FFF')...}));
 */
export function themedStyles(factory) {
  const built = {};
  return new Proxy(
    {},
    {
      get(_t, key) {
        if (!built[scheme]) built[scheme] = factory();
        return built[scheme][key];
      },
    }
  );
}

export { StyleSheet };
