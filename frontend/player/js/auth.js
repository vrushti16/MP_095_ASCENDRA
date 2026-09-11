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

    // Initialize Authentication Providers
    this.initFirebaseAuth();
    this.initGoogleIdentityServices();
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

  async initFirebaseAuth() {
    if (typeof firebase === 'undefined') return;
    const config = window.ASCENDRA_PLAYER_CONFIG?.FIREBASE_CONFIG;
    if (!config || !config.apiKey) return;

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
    } catch (err) {
      console.warn('Firebase initialization notice:', err.message);
    }
  },

  initGoogleIdentityServices() {
    const clientId = window.ASCENDRA_PLAYER_CONFIG?.GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const setupGis = () => {
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        return false;
      }

      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => this.handleGoogleCredentialResponse(response),
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true
        });

        const container = document.getElementById('googleButtonContainer');
        if (container) {
          google.accounts.id.renderButton(container, {
            type: 'standard',
            shape: 'rectangular',
            theme: 'filled_blue',
            text: 'continue_with',
            size: 'large',
            logo_alignment: 'left',
            width: 320
          });

          // Official GIS button rendered; hide fallback button to avoid redundant buttons
          if (this.googleLoginBtn) {
            this.googleLoginBtn.classList.add('hidden');
          }
        }
        return true;
      } catch (err) {
        console.warn('GIS initialization error:', err);
        return false;
      }
    };

    if (!setupGis()) {
      setTimeout(setupGis, 300);
      setTimeout(setupGis, 1200);
    }
  },

  async handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
      this.showAlert('Google Sign-In did not return an identity token.', 'danger');
      return;
    }

    this.showAlert('Attuning explorer credentials with Google...', 'info');

    try {
      // Optional Firebase state sync if Firebase SDK loaded
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
        try {
          const cred = firebase.auth.GoogleAuthProvider.credential(response.credential);
          await firebase.auth().signInWithCredential(cred);
        } catch (fbErr) {
          console.warn('Firebase state sync notice:', fbErr.message);
        }
      }

      // Verify Google ID token with backend API and issue game session
      const data = await window.playerApi.loginWithGoogle(response.credential);
      window.playerApi.setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      }, data.user);

      this.hideModal();
      if (window.playerApp) {
        window.playerApp.onAuthenticated(data.user);
      }
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      this.showAlert(err.message || 'Google authentication could not be completed.', 'danger');
    }
  },

  async handleGoogleLogin() {
    // 1. If Google Identity Services is available, prompt One Tap / GIS
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          this.triggerFirebasePopupLogin();
        }
      });
      return;
    }

    // 2. Fall back to Firebase popup authentication
    await this.triggerFirebasePopupLogin();
  },

  async triggerFirebasePopupLogin() {
    if (typeof firebase === 'undefined') {
      this.showAlert('Authentication service is loading. Please check network connectivity.', 'warning');
      return;
    }

    const config = window.ASCENDRA_PLAYER_CONFIG?.FIREBASE_CONFIG;
    if (!config || !config.apiKey) {
      this.showAlert('Firebase Web API Key is pending in frontend/player/config.js.', 'warning');
      return;
    }

    this.setButtonLoading(this.googleLoginBtn, true, 'Opening Google...');
    this.hideAlert();

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');

      const result = await firebase.auth().signInWithPopup(provider);

      this.setButtonLoading(this.googleLoginBtn, true, 'Attuning explorer credentials...');

      // Extract verified Google ID token
      const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
      const idToken = credential?.idToken || (await result.user.getIdToken());

      const data = await window.playerApi.loginWithGoogle(idToken);
      window.playerApi.setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      }, data.user);

      this.hideModal();
      if (window.playerApp) {
        window.playerApp.onAuthenticated(data.user);
      }
    } catch (err) {
      console.error('Firebase Google Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        this.showAlert('Google Sign-In was closed. If the popup was blank, click the 👁️ (eye icon) in the popup address bar to allow cookies, or use the Google Sign-In button.', 'warning');
      } else if (err.code === 'auth/unauthorized-domain') {
        this.showAlert('This domain is not authorized in Firebase Console -> Authentication -> Authorised domains.', 'danger');
      } else {
        this.showAlert(err.message || 'Google authentication could not be completed.', 'danger');
      }
    } finally {
      this.setButtonLoading(this.googleLoginBtn, false, 'Continue with Google');
    }
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
