/**
 * ASCENDRA Player API Client Module
 * Centralized fetch client for player game APIs with Bearer token injection,
 * session management, error normalization, and reactive unauthorized dispatch.
 */

const API_BASE_URL = (typeof window !== 'undefined' && window.ASCENDRA_PLAYER_CONFIG && window.ASCENDRA_PLAYER_CONFIG.API_BASE_URL)
  || (typeof window !== 'undefined' && window.ASCENDRA_CONFIG && window.ASCENDRA_CONFIG.API_BASE_URL)
  || '/api/v1';

class PlayerApiClient {
  constructor() {
    this.tokenKey = 'ascendra_player_token';
    this.refreshTokenKey = 'ascendra_player_refresh_token';
    this.userKey = 'ascendra_player_user';
  }

  getToken() {
    return sessionStorage.getItem(this.tokenKey) || localStorage.getItem(this.tokenKey);
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  getRefreshToken() {
    return sessionStorage.getItem(this.refreshTokenKey) || localStorage.getItem(this.refreshTokenKey);
  }

  getUser() {
    try {
      const raw = sessionStorage.getItem(this.userKey) || localStorage.getItem(this.userKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setSession(tokens, user) {
    if (tokens?.accessToken) {
      sessionStorage.setItem(this.tokenKey, tokens.accessToken);
      localStorage.setItem(this.tokenKey, tokens.accessToken);
    }
    if (tokens?.refreshToken) {
      sessionStorage.setItem(this.refreshTokenKey, tokens.refreshToken);
      localStorage.setItem(this.refreshTokenKey, tokens.refreshToken);
    }
    if (user) {
      const uStr = JSON.stringify(user);
      sessionStorage.setItem(this.userKey, uStr);
      localStorage.setItem(this.userKey, uStr);
    }
  }

  clearSession() {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.refreshTokenKey);
    sessionStorage.removeItem(this.userKey);
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
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

      // Handle 401 Unauthorized (Expired or invalid token)
      if (response.status === 401) {
        // Attempt automatic refresh if refresh token is available
        const currentRefreshToken = this.getRefreshToken();
        if (currentRefreshToken && !options._isRetry) {
          try {
            const refreshData = await this.refreshToken(currentRefreshToken);
            if (refreshData?.accessToken) {
              this.setSession(refreshData, this.getUser());
              // Retry original request once with fresh token
              return this.request(endpoint, { ...options, _isRetry: true });
            }
          } catch {
            // Refresh failed; clear session
          }
        }

        this.clearSession();
        window.dispatchEvent(new CustomEvent('player:unauthorized'));
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || errData.message || 'Session expired. Please sign in again.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || `Request failed with status ${response.status}`;
        const error = new Error(errorMsg);
        error.status = response.status;
        error.code = data.error?.code || 'API_ERROR';
        error.waitSeconds = data.error?.waitSeconds;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Realm connection lost: Unable to reach ASCENDRA servers.');
      }
      throw err;
    }
  }

  // --- Authentication APIs ---
  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    return res.data;
  }

  async register(email, password, name) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: { email, password, name }
    });
    return res.data;
  }

  async requestRegistrationOtp(email, password, name) {
    const res = await this.request('/auth/register/send-verification', {
      method: 'POST',
      body: { email, password, name }
    });
    return res.data;
  }

  async sendEmailVerification(email, password, name, confirmPassword) {
    const res = await this.request('/auth/register/send-verification', {
      method: 'POST',
      body: { email, password, name, confirmPassword }
    });
    return res.data;
  }

  async verifyRegistrationOtp(email, otp) {
    const res = await this.request('/auth/register/verify-email', {
      method: 'POST',
      body: { email, otp }
    });
    return res.data;
  }

  async verifyEmail(email, otp) {
    const res = await this.request('/auth/register/verify-email', {
      method: 'POST',
      body: { email, otp }
    });
    return res.data;
  }

  async resendRegistrationOtp(email) {
    const res = await this.request('/auth/register/resend-verification', {
      method: 'POST',
      body: { email }
    });
    return res.data;
  }

  async resendEmailVerification(email) {
    const res = await this.request('/auth/register/resend-verification', {
      method: 'POST',
      body: { email }
    });
    return res.data;
  }

  async loginWithGoogle(idToken) {
    const res = await this.request('/auth/google', {
      method: 'POST',
      body: { idToken }
    });
    return res.data;
  }

  async refreshToken(refreshToken) {
    const res = await this.request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken }
    });
    return res.data;
  }

  async getAuthConfig() {
    const res = await this.request('/auth/config');
    return res.data;
  }

  async logout() {
    const refreshToken = this.getRefreshToken();
    try {
      if (refreshToken) {
        await this.request('/auth/logout', {
          method: 'POST',
          body: { refreshToken }
        });
      }
    } finally {
      this.clearSession();
    }
  }

  // --- Password Reset APIs (Gmail OTP Flow) ---
  async requestPasswordResetOtp(email) {
    const res = await this.request('/auth/forgot-password/request-otp', {
      method: 'POST',
      body: { email }
    });
    return res;
  }

  async verifyPasswordResetOtp(email, otp) {
    const res = await this.request('/auth/forgot-password/verify-otp', {
      method: 'POST',
      body: { email, otp }
    });
    return res;
  }

  async resetPassword(resetToken, newPassword, confirmPassword) {
    const res = await this.request('/auth/forgot-password/reset', {
      method: 'POST',
      body: { resetToken, newPassword, confirmPassword }
    });
    return res;
  }


  // --- Profile APIs ---
  async getProfile() {
    const res = await this.request('/users/me/profile');
    return res.data;
  }

  async updateProfile(updates) {
    const res = await this.request('/users/me/profile', {
      method: 'PATCH',
      body: updates
    });
    return res.data;
  }

  // --- Quest APIs ---
  async getQuests() {
    const res = await this.request('/quests');
    return res.data;
  }

  async getQuestDetails(questId) {
    const res = await this.request(`/quests/${encodeURIComponent(questId)}`);
    return res.data;
  }

  async startQuest(questId) {
    const res = await this.request(`/quests/${encodeURIComponent(questId)}/start`, {
      method: 'POST'
    });
    return res.data;
  }

  async updateQuestProgress(questId, progressData) {
    const res = await this.request(`/quests/${encodeURIComponent(questId)}/progress`, {
      method: 'PATCH',
      body: progressData
    });
    return res.data;
  }

  async completeQuest(questId) {
    const res = await this.request(`/quests/${encodeURIComponent(questId)}/complete`, {
      method: 'POST'
    });
    return res.data;
  }

  // --- Clue APIs ---
  async getClues() {
    const res = await this.request('/clues');
    return res.data;
  }

  async getClueDetails(clueId) {
    const res = await this.request(`/clues/${encodeURIComponent(clueId)}`);
    return res.data;
  }

  async unlockClue(clueId) {
    const res = await this.request(`/clues/${encodeURIComponent(clueId)}/unlock`, {
      method: 'POST'
    });
    return res.data;
  }

  // --- Puzzle & Mechanism APIs ---
  async attemptPuzzle(puzzleId, answer, timeTakenSeconds = 0) {
    const res = await this.request(`/puzzles/${encodeURIComponent(puzzleId)}/attempt`, {
      method: 'POST',
      body: { answer, timeTakenSeconds }
    });
    return res.data;
  }

  // --- Authoritative Progression & Achievement APIs ---
  async getProgression() {
    const res = await this.request('/progression');
    return res.data;
  }

  async getAchievements() {
    const res = await this.request('/achievements');
    return res.data;
  }

  async postGameplayEvent(payload) {
    const res = await this.request('/progression/events', {
      method: 'POST',
      body: payload
    });
    return res.data;
  }
}

// Global API instance for player web client
window.playerApi = new PlayerApiClient();
