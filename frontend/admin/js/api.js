/**
 * ASCENDRA Admin API Client Module
 * Centralized fetch client with token injection, error handling, and endpoint methods.
 */

const API_BASE_URL = '/api/v1';

class ApiClient {
  constructor() {
    this.tokenKey = 'ascendra_admin_token';
    this.userKey = 'ascendra_admin_user';
  }

  getToken() {
    return sessionStorage.getItem(this.tokenKey);
  }

  setSession(token, user) {
    if (token) sessionStorage.setItem(this.tokenKey, token);
    if (user) sessionStorage.setItem(this.userKey, JSON.stringify(user));
  }

  clearSession() {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
  }

  getUser() {
    try {
      const raw = sessionStorage.getItem(this.userKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Accept': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, { ...options, headers });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        this.clearSession();
        window.dispatchEvent(new CustomEvent('admin:unauthorized'));
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || errData.message || 'Authentication required');
      }

      // Handle 403 Forbidden
      if (response.status === 403) {
        window.dispatchEvent(new CustomEvent('admin:forbidden'));
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || errData.message || 'Access denied: Admin role required');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || `Request failed with status ${response.status}`;
        const error = new Error(errorMsg);
        error.status = response.status;
        error.code = data.error?.code || 'API_ERROR';
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Network error: Unable to reach ASCENDRA backend server.');
      }
      throw err;
    }
  }

  // --- Auth APIs ---
  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    return res.data;
  }

  // --- Admin APIs ---
  async getOverview() {
    const res = await this.request('/admin/overview');
    return res.data;
  }

  async getUsers({ page = 1, limit = 20, search = '', role = '' } = {}) {
    const query = new URLSearchParams();
    if (page) query.append('page', page);
    if (limit) query.append('limit', limit);
    if (search) query.append('search', search);
    if (role) query.append('role', role);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await this.request(`/admin/users${queryString}`);
    return res.data;
  }

  async getUserById(id) {
    const res = await this.request(`/admin/users/${encodeURIComponent(id)}`);
    return res.data;
  }

  async updateUserRole(id, role) {
    const res = await this.request(`/admin/users/${encodeURIComponent(id)}/role`, {
      method: 'PATCH',
      body: { role }
    });
    return res.data;
  }

  async getGameAnalytics() {
    const res = await this.request('/admin/game/analytics');
    return res.data;
  }

  async getAiTelemetry() {
    const res = await this.request('/admin/ai/telemetry');
    return res.data;
  }

  async getSystemHealth() {
    const res = await this.request('/admin/system/health');
    return res.data;
  }
}

// Global API instance for dashboard modules
window.api = new ApiClient();
