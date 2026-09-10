/**
 * ASCENDRA Admin Authentication Module
 * Manages admin login, session state, logout, and access guardrails.
 */

const auth = {
  init() {
    this.loginModal = document.getElementById('loginModal');
    this.loginForm = document.getElementById('loginForm');
    this.loginEmail = document.getElementById('loginEmail');
    this.loginPassword = document.getElementById('loginPassword');
    this.loginError = document.getElementById('loginError');
    this.loginButton = document.getElementById('loginSubmitBtn');
    this.adminUserDisplay = document.getElementById('currentAdminName');
    this.logoutBtn = document.getElementById('logoutBtn');
    this.appContainer = document.getElementById('appContainer');

    // Event listeners
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => this.logout());
    }

    // Handle session expirations or unauthorized triggers from API client
    window.addEventListener('admin:unauthorized', () => {
      this.showLogin('Your session has expired. Please sign in again.');
    });

    window.addEventListener('admin:forbidden', () => {
      this.showLogin('Access denied: You must be an administrator to access this portal.');
    });

    // Verify initial session
    this.checkSession();
  },

  checkSession() {
    const token = window.api.getToken();
    const user = window.api.getUser();

    if (!token || !user) {
      this.showLogin();
      return;
    }

    if (user.role !== 'admin') {
      window.api.clearSession();
      this.showLogin('Access restricted to administrators.');
      return;
    }

    this.showDashboard(user);
  },

  showLogin(errorMessage = null) {
    if (this.loginModal) this.loginModal.classList.remove('hidden');
    if (this.appContainer) this.appContainer.classList.add('hidden');

    if (errorMessage && this.loginError) {
      this.loginError.textContent = errorMessage;
      this.loginError.classList.remove('hidden');
    } else if (this.loginError) {
      this.loginError.classList.add('hidden');
    }
  },

  showDashboard(user) {
    if (this.loginModal) this.loginModal.classList.add('hidden');
    if (this.appContainer) this.appContainer.classList.remove('hidden');

    if (this.adminUserDisplay && user) {
      this.adminUserDisplay.textContent = user.name || user.email;
    }

    // Trigger dashboard initial data load
    if (window.app && typeof window.app.loadCurrentSection === 'function') {
      window.app.loadCurrentSection();
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    if (!this.loginEmail || !this.loginPassword) return;

    const email = this.loginEmail.value.trim();
    const password = this.loginPassword.value;

    if (!email || !password) {
      this.showError('Please enter both email and password.');
      return;
    }

    this.setLoading(true);
    this.hideError();

    try {
      const data = await window.api.login(email, password);

      if (!data || !data.user || data.user.role !== 'admin') {
        window.api.clearSession();
        throw new Error('Access denied: This portal requires administrator privileges.');
      }

      window.api.setSession(data.accessToken, data.user);
      this.showDashboard(data.user);
    } catch (err) {
      this.showError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      this.setLoading(false);
    }
  },

  logout() {
    window.api.clearSession();
    this.showLogin('You have been signed out.');
  },

  setLoading(isLoading) {
    if (this.loginButton) {
      this.loginButton.disabled = isLoading;
      this.loginButton.textContent = isLoading ? 'Authenticating...' : 'Sign In to Dashboard';
    }
  },

  showError(msg) {
    if (this.loginError) {
      this.loginError.textContent = msg;
      this.loginError.classList.remove('hidden');
    }
  },

  hideError() {
    if (this.loginError) {
      this.loginError.textContent = '';
      this.loginError.classList.add('hidden');
    }
  }
};

window.auth = auth;
