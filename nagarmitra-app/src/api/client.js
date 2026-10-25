import { BASE_URL } from '../config';
import { auth } from '../lib/firebase';

export async function apiGet(path) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost(path, body) {
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await safeRead(res);
    throw new Error(`POST ${path} failed: ${res.status} ${msg}`);
  }
  return res.json();
}

export async function apiPut(path, body) {
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await safeRead(res);
    throw new Error(`PUT ${path} failed: ${res.status} ${msg}`);
  }
  return res.json();
}

export async function apiDelete(path) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const msg = await safeRead(res);
    throw new Error(`DELETE ${path} failed: ${res.status} ${msg}`);
  }
  return res.json();
}

async function safeRead(res) {
  try {
    const t = await res.text();
    return t;
  } catch (e) {
    return '';
  }
}

async function authHeaders(base = {}) {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return { ...base, Authorization: `Bearer ${token}` };
    }
  } catch {}
  return base;
}

// User API functions
export const userAPI = {
  getProfile: () => apiGet('/api/v1/users/me'),
  updateProfile: (data) => apiPut('/api/v1/users/me', data),
  updatePreferences: (data) => apiPut('/api/v1/users/me/preferences', data),
  getStats: () => apiGet('/api/v1/users/me/stats'),
  getComplaints: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/users/me/complaints${query ? '?' + query : ''}`);
  },
  getPosts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/users/me/posts${query ? '?' + query : ''}`);
  },
  getNotifications: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/users/me/notifications${query ? '?' + query : ''}`);
  },
  markNotificationRead: (id) => apiPut(`/api/v1/users/me/notifications/${id}/read`),
  markAllNotificationsRead: () => apiPut('/api/v1/users/me/notifications/read-all'),
};

// Community API functions
export const communityAPI = {
  getPosts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/community/posts${query ? '?' + query : ''}`);
  },
  getTrendingPosts: (limit = 10) => apiGet(`/api/v1/community/posts/trending?limit=${limit}`),
  getPost: (id) => apiGet(`/api/v1/community/posts/${id}`),
  createPost: (data) => apiPost('/api/v1/community/posts', data),
  likePost: (id) => apiPost(`/api/v1/community/posts/${id}/like`),
  votePost: (id, type) => apiPost(`/api/v1/community/posts/${id}/vote`, { type }),
  sharePost: (id) => apiPost(`/api/v1/community/posts/${id}/share`),
  reportPost: (id, reason) => apiPost(`/api/v1/community/posts/${id}/report`, { reason }),
  deletePost: (id) => apiDelete(`/api/v1/community/posts/${id}`),
  getStats: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/community/stats${query ? '?' + query : ''}`);
  },
};

// Analytics API functions
export const analyticsAPI = {
  getDashboard: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/analytics/dashboard${query ? '?' + query : ''}`);
  },
  getTrends: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/analytics/trends${query ? '?' + query : ''}`);
  },
  getWards: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/analytics/wards${query ? '?' + query : ''}`);
  },
  getPerformance: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/analytics/performance${query ? '?' + query : ''}`);
  },
  getHeatmap: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/analytics/heatmap${query ? '?' + query : ''}`);
  },
  export: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/analytics/export${query ? '?' + query : ''}`);
  },
};

// Enhanced complaint API functions
export const complaintAPI = {
  create: (data) => apiPost('/api/v1/complaints', data),
  getById: (id) => apiGet(`/api/v1/complaints/${id}`),
  getByReportId: (reportId) => apiGet(`/api/v1/complaints/report/${reportId}`),
  getList: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/api/v1/complaints${query ? '?' + query : ''}`);
  },
  vote: (id, type) => apiPost(`/api/v1/complaints/${id}/vote`, { type }),
  addNote: (id, note) => apiPost(`/api/v1/complaints/${id}/notes`, { note }),
  updateStatus: (id, status, reason, notes) => 
    apiPut(`/api/v1/complaints/${id}/status`, { status, reason, notes }),
};

// AI Detection API functions
export const detectAPI = {
  detectImage: async (imageUri) => {
    const formData = new FormData();
    const filename = imageUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image`;

    formData.append('image', { uri: imageUri, name: filename, type });

    // Use safeRead and authHeaders inline (manually using fetch because we need multipart/form-data)
    let headers = { 'Content-Type': 'multipart/form-data' };
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {}

    const res = await fetch(`${BASE_URL}/api/v1/detect`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      let msg = '';
      try { msg = await res.text(); } catch (e) {}
      throw new Error(`Detection failed: ${res.status} ${msg}`);
    }
    return res.json();
  }
};
