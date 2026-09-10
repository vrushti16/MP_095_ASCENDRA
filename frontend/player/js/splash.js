/**
 * ASCENDRA Player Gaming Splash Screen Module
 * Manages full-screen fantasy atmosphere, realistic initialization steps,
 * particle animation setup, and the transition into the Player Hub.
 */

const playerSplash = {
  init() {
    this.splashOverlay = document.getElementById('playerSplashOverlay');
    this.enterBtn = document.getElementById('splashEnterBtn');
    this.statusText = document.getElementById('splashStatusText');
    this.progressBar = document.getElementById('splashProgressBar');
    this.progressContainer = document.getElementById('splashProgressContainer');
    this.particlesContainer = document.getElementById('splashParticles');

    if (this.enterBtn) {
      this.enterBtn.addEventListener('click', () => this.handleEnterRealm());
    }

    this.spawnEmbers();
    this.startInitialization();
  },

  showSplash() {
    if (this.splashOverlay) {
      this.splashOverlay.classList.remove('hidden', 'fade-out');
    }
    const appContainer = document.getElementById('playerAppContainer');
    if (appContainer) {
      appContainer.classList.add('hidden');
    }
    this.startInitialization();
  },

  hideSplash() {
    if (this.splashOverlay) {
      this.splashOverlay.classList.add('fade-out');
      setTimeout(() => {
        this.splashOverlay.classList.add('hidden');
      }, 500);
    }
    const appContainer = document.getElementById('playerAppContainer');
    if (appContainer) {
      appContainer.classList.remove('hidden');
    }
  },

  updateProgress(percent, statusMessage) {
    if (this.progressBar) {
      this.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (this.statusText) {
      this.statusText.textContent = statusMessage;
    }
  },

  async startInitialization() {
    // Reset buttons
    if (this.enterBtn) this.enterBtn.classList.add('hidden');
    if (this.progressContainer) this.progressContainer.classList.remove('hidden');

    // Step 1: Initialize client UI assets
    this.updateProgress(20, 'Initializing Realm Interfaces...');
    await new Promise(r => setTimeout(r, 150));

    // Step 2: Check existing session
    this.updateProgress(45, 'Verifying Explorer Credentials...');
    const token = window.playerApi.getToken();
    const user = window.playerApi.getUser();

    if (!token || !user) {
      // Unauthenticated state: Ready for player login/register
      this.updateProgress(100, 'Realm Ready. Enter to begin your journey.');
      if (this.enterBtn) {
        this.enterBtn.textContent = 'ENTER ASCENDRA';
        this.enterBtn.classList.remove('hidden');
      }
      return;
    }

    // Step 3: Fetch profile data
    try {
      this.updateProgress(70, 'Attuning Explorer Profile...');
      const profileData = await window.playerApi.getProfile();

      // Step 4: Fetch active quests
      this.updateProgress(90, 'Loading Quest Log & Relics...');
      const questData = await window.playerApi.getQuests();

      // Step 5: Ready
      this.updateProgress(100, 'World Ready. Your adventure awaits.');
      if (this.enterBtn) {
        this.enterBtn.textContent = 'CONTINUE ADVENTURE';
        this.enterBtn.classList.remove('hidden');
      }

      // Preload data into window cache for instant hub rendering
      window.__ASCENDRA_CACHE = {
        profile: profileData,
        quests: questData
      };
    } catch (err) {
      // Fallback if session expired or backend unreachable
      this.updateProgress(100, 'Authentication needed to continue journey.');
      if (this.enterBtn) {
        this.enterBtn.textContent = 'ENTER ASCENDRA';
        this.enterBtn.classList.remove('hidden');
      }
    }
  },

  handleEnterRealm() {
    const token = window.playerApi.getToken();
    if (!token) {
      // Trigger authentication modal
      if (window.playerAuth) {
        window.playerAuth.showModal();
      }
      return;
    }

    // Transition from Splash to Player Hub
    this.hideSplash();
    if (window.playerApp) {
      window.playerApp.loadCurrentSection();
    }
  },

  spawnEmbers() {
    if (!this.particlesContainer) return;
    this.particlesContainer.innerHTML = '';
    const particleCount = 28;

    for (let i = 0; i < particleCount; i++) {
      const ember = document.createElement('div');
      ember.className = 'ember-particle';
      const size = Math.random() * 3 + 2;
      const left = Math.random() * 100;
      const duration = Math.random() * 6 + 4;
      const delay = Math.random() * 5;

      ember.style.width = `${size}px`;
      ember.style.height = `${size}px`;
      ember.style.left = `${left}%`;
      ember.style.animationDuration = `${duration}s`;
      ember.style.animationDelay = `${delay}s`;

      this.particlesContainer.appendChild(ember);
    }
  }
};

window.playerSplash = playerSplash;
