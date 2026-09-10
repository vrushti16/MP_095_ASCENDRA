/**
 * ASCENDRA Player Authentication Controller
 * Manages player sign in, registration, session persistence, and auth modal states.
 */

const playerAuth = {
  currentTab: 'signin',

  init() {
    this.authModal = document.getElementById('playerAuthModal');
    this.authAlert = document.getElementById('authAlert');
    this.signinForm = document.getElementById('signinForm');
    this.registerForm = document.getElementById('registerForm');
    this.tabSigninBtn = document.getElementById('tabSigninBtn');
    this.tabRegisterBtn = document.getElementById('tabRegisterBtn');
    this.googleLoginBtn = document.getElementById('googleLoginBtn');
    this.logoutBtn = document.getElementById('playerLogoutBtn');

    // Tab switching
    if (this.tabSigninBtn) {
      this.tabSigninBtn.addEventListener('click', () => this.switchTab('signin'));
    }
    if (this.tabRegisterBtn) {
      this.tabRegisterBtn.addEventListener('click', () => this.switchTab('register'));
    }

    // Form submissions
    if (this.signinForm) {
      this.signinForm.addEventListener('submit', (e) => this.handleSignin(e));
    }
    if (this.registerForm) {
      this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // Google Sign-In hook
    if (this.googleLoginBtn) {
      this.googleLoginBtn.addEventListener('click', () => this.handleGoogleLogin());
    }

    // Logout
    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => this.logout());
    }

    // Session expiration listener
    window.addEventListener('player:unauthorized', () => {
      this.showModal('Your session has ended. Please sign in to resume your adventure.');
    });
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.hideAlert();

    if (tab === 'signin') {
      if (this.signinForm) this.signinForm.classList.remove('hidden');
      if (this.registerForm) this.registerForm.classList.add('hidden');
      if (this.tabSigninBtn) this.tabSigninBtn.classList.add('active');
      if (this.tabRegisterBtn) this.tabRegisterBtn.classList.remove('active');
    } else {
      if (this.signinForm) this.signinForm.classList.add('hidden');
      if (this.registerForm) this.registerForm.classList.remove('hidden');
      if (this.tabSigninBtn) this.tabSigninBtn.classList.remove('active');
      if (this.tabRegisterBtn) this.tabRegisterBtn.classList.add('active');
    }
  },

  showModal(message = null) {
    if (this.authModal) {
      this.authModal.classList.remove('hidden');
    }
    if (message) {
      this.showAlert(message, 'warning');
    }
  },

  hideModal() {
    if (this.authModal) {
      this.authModal.classList.add('hidden');
    }
    this.hideAlert();
  },

  showAlert(message, type = 'danger') {
    if (this.authAlert) {
      this.authAlert.textContent = message;
      this.authAlert.className = `player-alert alert-${type}`;
      this.authAlert.classList.remove('hidden');
    }
  },

  hideAlert() {
    if (this.authAlert) {
      this.authAlert.textContent = '';
      this.authAlert.classList.add('hidden');
    }
  },

  async handleSignin(e) {
    e.preventDefault();
    const email = document.getElementById('signinEmail')?.value.trim();
    const password = document.getElementById('signinPassword')?.value;
    const submitBtn = document.getElementById('signinSubmitBtn');

    if (!email || !password) {
      this.showAlert('Please provide both email and password.');
      return;
    }

    this.setButtonLoading(submitBtn, true, 'Signing In...');
    this.hideAlert();

    try {
      const data = await window.playerApi.login(email, password);
      window.playerApi.setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      }, data.user);

      this.hideModal();
      // Initialize player hub
      if (window.playerApp) {
        window.playerApp.onAuthenticated(data.user);
      }
    } catch (err) {
      this.showAlert(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      this.setButtonLoading(submitBtn, false, 'Enter ASCENDRA');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName')?.value.trim();
    const email = document.getElementById('registerEmail')?.value.trim();
    const password = document.getElementById('registerPassword')?.value;
    const submitBtn = document.getElementById('registerSubmitBtn');

    if (!name || !email || !password) {
      this.showAlert('All fields are required to begin your journey.');
      return;
    }

    if (password.length < 6) {
      this.showAlert('Password must be at least 6 characters.');
      return;
    }

    this.setButtonLoading(submitBtn, true, 'Creating Explorer...');
    this.hideAlert();

    try {
      const data = await window.playerApi.register(email, password, name);
      window.playerApi.setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      }, data.user);

      this.hideModal();
      if (window.playerApp) {
        window.playerApp.onAuthenticated(data.user);
      }
    } catch (err) {
      this.showAlert(err.message || 'Registration could not be completed.');
    } finally {
      this.setButtonLoading(submitBtn, false, 'Begin Adventure');
    }
  },

  async handleGoogleLogin() {
    this.showAlert('Google Sign-In integration ready. When Google Client SDK token is present, it will verify with /auth/google.', 'info');
  },

  async logout() {
    await window.playerApi.logout();
    if (window.playerSplash) {
      window.playerSplash.showSplash();
    } else {
      window.location.reload();
    }
  },

  setButtonLoading(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = text;
  }
};

window.playerAuth = playerAuth;
