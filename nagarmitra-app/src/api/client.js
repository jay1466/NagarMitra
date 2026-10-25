import { BASE_URL } from '../config';
import { auth } from '../lib/firebase';

// The free backend can take ~50s to wake up, so allow a generous timeout.
const TIMEOUT_MS = 45000;

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function friendlyStatusMessage(status) {
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return 'You are not allowed to do this.';
  if (status === 404) return 'Not found.';
  if (status === 413) return 'The photo is too large. Please choose a smaller one.';
  if (status === 429) return 'Too many requests. Please wait a minute and try again.';
  if (status >= 500) return 'The server had a problem. Please try again shortly.';
  return 'Request failed. Please try again.';
}

async function authHeaders(base = {}) {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return { ...base, Authorization: `Bearer ${token}` };
    }
  } catch {
    // Not logged in / token refresh failed: send the request without auth
  }
  return base;
}

async function request(method, path, body) {
  const headers = await authHeaders(body !== undefined ? { 'Content-Type': 'application/json' } : {});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new ApiError('The server is taking too long to respond. Please try again.');
    }
    throw new ApiError('No internet connection, or the server is unreachable.');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    // Prefer the server's own message when it sent one
    const serverMsg = typeof data?.error === 'string' ? data.error : null;
    throw new ApiError(serverMsg || friendlyStatusMessage(res.status), res.status);
  }
  return data ?? {};
}

export const apiGet = (path) => request('GET', path);
export const apiPost = (path, body = {}) => request('POST', path, body);
export const apiPut = (path, body = {}) => request('PUT', path, body);
export const apiDelete = (path) => request('DELETE', path);

// Turn any thrown value into text that is safe to show a user.
export function errorMessage(e, fallback = 'Something went wrong. Please try again.') {
  if (e instanceof ApiError) return e.message;
  return fallback;
}

const qs = (params = {}) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const query = new URLSearchParams(clean).toString();
  return query ? `?${query}` : '';
};

// User API functions
export const userAPI = {
  getProfile: () => apiGet('/api/v1/users/me'),
  updateProfile: (data) => apiPut('/api/v1/users/me', data),
  updatePreferences: (data) => apiPut('/api/v1/users/me/preferences', data),
  getStats: () => apiGet('/api/v1/users/me/stats'),
  getComplaints: (params) => apiGet(`/api/v1/users/me/complaints${qs(params)}`),
  getPosts: (params) => apiGet(`/api/v1/users/me/posts${qs(params)}`),
  getNotifications: (params) => apiGet(`/api/v1/users/me/notifications${qs(params)}`),
  markNotificationRead: (id) => apiPut(`/api/v1/users/me/notifications/${id}/read`),
  markAllNotificationsRead: () => apiPut('/api/v1/users/me/notifications/read-all'),
};

// Community API functions
export const communityAPI = {
  getPosts: (params) => apiGet(`/api/v1/community/posts${qs(params)}`),
  getStories: () => apiGet('/api/v1/community/stories'),
  getTrendingPosts: (limit = 10) => apiGet(`/api/v1/community/posts/trending?limit=${limit}`),
  getPost: (id) => apiGet(`/api/v1/community/posts/${id}`),
  createPost: (data) => apiPost('/api/v1/community/posts', data),
  likePost: (id) => apiPost(`/api/v1/community/posts/${id}/like`),
  votePost: (id, type) => apiPost(`/api/v1/community/posts/${id}/vote`, { type }),
  sharePost: (id) => apiPost(`/api/v1/community/posts/${id}/share`),
  reportPost: (id, reason) => apiPost(`/api/v1/community/posts/${id}/report`, { reason }),
  deletePost: (id) => apiDelete(`/api/v1/community/posts/${id}`),
  getStats: (params) => apiGet(`/api/v1/community/stats${qs(params)}`),
};

// Analytics API functions
export const analyticsAPI = {
  getDashboard: (params) => apiGet(`/api/v1/analytics/dashboard${qs(params)}`),
  getTrends: (params) => apiGet(`/api/v1/analytics/trends${qs(params)}`),
  getWards: (params) => apiGet(`/api/v1/analytics/wards${qs(params)}`),
  getPerformance: (params) => apiGet(`/api/v1/analytics/performance${qs(params)}`),
  getHeatmap: (params) => apiGet(`/api/v1/analytics/heatmap${qs(params)}`),
  export: (params) => apiGet(`/api/v1/analytics/export${qs(params)}`),
};

// Complaint API functions
export const complaintAPI = {
  create: (data) => apiPost('/api/v1/complaints', data),
  getById: (id) => apiGet(`/api/v1/complaints/${id}`),
  getByReportId: (reportId) => apiGet(`/api/v1/complaints/report/${encodeURIComponent(reportId.trim())}`),
  getList: (params) => apiGet(`/api/v1/complaints${qs(params)}`),
  vote: (id, type) => apiPost(`/api/v1/complaints/${id}/vote`, { type }),
  addNote: (id, note) => apiPost(`/api/v1/complaints/${id}/notes`, { note }),
  updateStatus: (id, status, reason, notes) =>
    apiPut(`/api/v1/complaints/${id}/status`, { status, reason, notes }),
};

export const feedbackAPI = {
  submit: (data) => apiPost('/api/v1/feedback', data),
};

// AI Detection API functions
export const detectAPI = {
  detectImage: async (imageUri) => {
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()}` : 'image/jpeg';
    formData.append('image', { uri: imageUri, name: filename, type });

    // Let fetch set the multipart boundary itself; only add auth
    const headers = await authHeaders();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/detect`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
      if (!res.ok) throw new ApiError(friendlyStatusMessage(res.status), res.status);
      return await res.json();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError('Could not analyse the photo right now.');
    } finally {
      clearTimeout(timer);
    }
  },
};
