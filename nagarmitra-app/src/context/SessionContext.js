import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { userAPI, metaAPI } from '../api/client';
import { CATEGORIES } from '../constants';
import { placeLabel } from '../data/india';

// Fallback so screens work before /meta has loaded (or when offline)
const DEFAULT_META = {
  departments: {},
  categoryToDepartment: {},
  sla: {},
  roleLabels: {
    super_admin: 'Super Admin (India)',
    state_admin: 'State Master Admin',
    district_admin: 'District Admin',
    officer: 'Department Officer',
    citizen: 'Citizen',
  },
  reopenWindowDays: 7,
  nudgeIntervalHours: 24,
  categories: CATEGORIES,
};

const SessionContext = createContext({
  me: null,
  role: 'citizen',
  meta: DEFAULT_META,
  unreadCount: 0,
  refreshMe: async () => {},
  refreshUnread: async () => {},
});

/**
 * Holds the logged-in user's server profile (role, department, wards), the
 * civic metadata (wards, departments, SLAs) and the unread notification count.
 */
export function SessionProvider({ firebaseUser, onNewNotifications, children }) {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState(DEFAULT_META);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastUnread = useRef(null);

  const refreshMe = useCallback(async () => {
    try {
      const res = await userAPI.getProfile();
      setMe(res.user || null);
    } catch {
      // keep the previous value; screens fall back to citizen behaviour
    } finally {
      setReady(true);
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await userAPI.getNotifications({ unreadOnly: 'true', limit: 5 });
      const count = res.unreadCount || 0;
      if (lastUnread.current !== null && count > lastUnread.current && res.notifications?.length) {
        onNewNotifications?.(res.notifications[0], count - lastUnread.current);
      }
      lastUnread.current = count;
      setUnreadCount(count);
    } catch {
      // offline: try again on the next tick
    }
  }, [onNewNotifications]);

  useEffect(() => {
    if (!firebaseUser) {
      setMe(null);
      setReady(false);
      setUnreadCount(0);
      lastUnread.current = null;
      return;
    }
    refreshMe();
    refreshUnread();
    metaAPI
      .get()
      .then((m) => setMeta({ ...DEFAULT_META, ...m }))
      .catch(() => {});

    // Poll for new notifications while the app is open, and on return to foreground
    const timer = setInterval(refreshUnread, 60 * 1000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshUnread();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [firebaseUser, refreshMe, refreshUnread]);

  const role = me?.role || 'citizen';
  const value = {
    me,
    ready,
    role,
    isAdmin: ['super_admin', 'state_admin', 'district_admin'].includes(role),
    isStaff: role !== 'citizen',
    meta,
    unreadCount,
    refreshMe,
    refreshUnread,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

export function roleLabel(meta, role) {
  return meta.roleLabels?.[role] || role || '';
}

/** Human description of a staff member's jurisdiction, e.g. "Roads & Potholes · Anand, Gujarat". */
export function jurisdictionLabel(meta, me) {
  if (!me) return '';
  if (me.role === 'super_admin') return 'All of India';
  const place = placeLabel(me.state, me.role === 'state_admin' ? undefined : me.district);
  if (me.role === 'officer') return `${departmentName(meta, me.department)} · ${place}`;
  return place;
}

export function departmentName(meta, key) {
  return meta.departments?.[key]?.name || key || '';
}
