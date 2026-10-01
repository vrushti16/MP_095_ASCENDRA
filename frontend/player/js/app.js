/**
 * ASCENDRA Player Application Controller
 * Manages HUD navigation, section view transitions, character profile updates,
 * mobile drawer controls, and lifecycle events.
 */

class PlayerApp {
  constructor() {
    this.currentSection = 'dashboard';
    this.sections = ['dashboard', 'adventure', 'inventory', 'clues', 'achievements', 'profile'];
    this.navItems = {};
    this.sectionContainers = {};
  }

  init() {
    // Cache section elements
    this.sections.forEach(id => {
      this.navItems[id] = document.getElementById(`player-nav-${id}`);
      this.sectionContainers[id] = document.getElementById(`player-section-${id}`);

      if (this.navItems[id]) {
        this.navItems[id].addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateTo(id);
          this.closeMobileNav();
        });
      }
    });

    // Hash-based direct link routing
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (this.sections.includes(hash)) {
        this.navigateTo(hash);
      }
    });

    const initialHash = window.location.hash.replace('#', '').trim();
    if (this.sections.includes(initialHash)) {
      this.currentSection = initialHash;
    }

    // Mobile nav toggle
    this.sidebar = document.getElementById('playerSidebar');
    this.mobileToggle = document.getElementById('playerMobileToggle');
    if (this.mobileToggle && this.sidebar) {
      this.mobileToggle.addEventListener('click', () => {
        this.sidebar.classList.toggle('open');
      });
    }

    // Mobile backdrop
    this.backdrop = document.getElementById('playerBackdrop');
    if (this.backdrop) {
      this.backdrop.addEventListener('click', () => {
        this.closeMobileNav();
      });
    }

    // Profile form submit
    const profileForm = document.getElementById('playerProfileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
    }

    // Top-right HUD profile chip (opens Character page)
    this.headerProfileChip = document.getElementById('headerProfileChip') || document.querySelector('.hud-player-chip');
    if (this.headerProfileChip) {
      this.headerProfileChip.style.cursor = 'pointer';
      this.headerProfileChip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.navigateTo('profile');
        this.closeMobileNav();
      });
      this.headerProfileChip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.navigateTo('profile');
          this.closeMobileNav();
        }
      });
    }
  }

  closeMobileNav() {
    if (this.sidebar) {
      this.sidebar.classList.remove('open');
    }
  }

  navigateTo(sectionId, contextParam = null) {
    if (!this.sections.includes(sectionId)) return;

    this.currentSection = sectionId;

    if (window.location.hash !== `#${sectionId}`) {
      window.history.replaceState(null, '', `#${sectionId}`);
    }

    // Update active nav states
    this.sections.forEach(id => {
      if (this.navItems[id]) {
        if (id === sectionId) {
          this.navItems[id].classList.add('active');
          this.navItems[id].setAttribute('aria-current', 'page');
        } else {
          this.navItems[id].classList.remove('active');
          this.navItems[id].removeAttribute('aria-current');
        }
      }

      if (this.sectionContainers[id]) {
        if (id === sectionId) {
          this.sectionContainers[id].classList.remove('hidden');
        } else {
          this.sectionContainers[id].classList.add('hidden');
        }
      }
    });

    // Render section content
    this.loadCurrentSection(contextParam);
  }

  loadCurrentSection(contextParam = null) {
    if (this.currentSection !== 'achievements' && window.playerAchievements) {
      window.playerAchievements.stopAutoSync();
    }

    switch (this.currentSection) {
      case 'dashboard':
        if (window.playerDashboard) window.playerDashboard.render();
        break;
      case 'adventure':
        if (window.playerAdventure) window.playerAdventure.render(contextParam);
        break;
      case 'inventory':
        if (window.playerInventory) window.playerInventory.render();
        break;
      case 'clues':
        if (window.playerClues) window.playerClues.render(contextParam);
        break;
      case 'achievements':
        if (window.playerAchievements) window.playerAchievements.render();
        break;
      case 'profile':
        this.renderProfile();
        break;
    }
  }

  onAuthenticated(user) {
    if (window.playerSplash) {
      window.playerSplash.hideSplash();
    }
    this.navigateTo('dashboard');
  }

  async renderProfile() {
    const nameInput = document.getElementById('profileDisplayName');
    const emailDisplay = document.getElementById('profileEmailDisplay');
    const roleDisplay = document.getElementById('profileRoleDisplay');
    const createdDisplay = document.getElementById('profileCreatedDisplay');
    const levelDisplay = document.getElementById('profileLevelDisplay');
    const scoreDisplay = document.getElementById('profileScoreDisplay');
    const xpDisplay = document.getElementById('profileXpDisplay');

    // Unity Game Progression elements
    const completedBadge = document.getElementById('profileCompletedGamesBadge');
    const gamerLevelText = document.getElementById('profileGamerLevelText');
    const completedGamesText = document.getElementById('profileCompletedGamesText');
    const completionRateText = document.getElementById('profileCompletionRateText');
    const completionBar = document.getElementById('profileCompletionBar');

    try {
      const [data, progressionData] = await Promise.all([
        window.playerApi.getProfile().catch(() => null),
        window.playerApi.getProgression().catch(() => null)
      ]);
      const u = data?.user || window.playerApi.getUser() || {};
      const p = data?.profile || {};
      const progPlayer = progressionData?.player || {};
      const gameProgress = progressionData?.gameProgress || {};

      const level = progPlayer.level || p.level || 1;
      const experience = progPlayer.xp ?? (p.experience || 0);
      const score = progPlayer.score ?? (p.score || 0);
      const completed = gameProgress.completedQuests || 0;
      const total = gameProgress.totalQuests || 3;
      const rate = gameProgress.overallPercentage !== undefined ? gameProgress.overallPercentage : Math.round((completed / Math.max(1, total)) * 100);

      if (nameInput) nameInput.value = u.name || '';
      if (emailDisplay) emailDisplay.textContent = u.email || 'N/A';
      if (roleDisplay) roleDisplay.textContent = (u.role || 'player').toUpperCase();
      if (createdDisplay) createdDisplay.textContent = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
      if (levelDisplay) levelDisplay.textContent = `Level ${level}`;
      if (scoreDisplay) scoreDisplay.textContent = `${score.toLocaleString()} pts`;
      if (xpDisplay) xpDisplay.textContent = `${experience.toLocaleString()} XP`;

      if (completedBadge) completedBadge.textContent = `${completed} Completed`;
      if (gamerLevelText) gamerLevelText.textContent = `Level ${level}`;
      if (completedGamesText) completedGamesText.textContent = `${completed} / ${total} Quests`;
      if (completionRateText) completionRateText.textContent = `${rate}%`;
      if (completionBar) completionBar.style.width = `${rate}%`;

      // Update header avatar, name, and level
      this.updateHeaderStats(u, level);
    } catch (err) {
      console.warn('Failed to load profile:', err);
    }
  }

  updateHeaderStats(user, level) {
    const nameEl = document.getElementById('headerPlayerName');
    const lvlEl = document.getElementById('headerPlayerLevel');
    const avatarEl = document.getElementById('headerPlayerAvatar') || document.querySelector('.hud-avatar');

    if (nameEl && user?.name) nameEl.textContent = user.name;
    if (lvlEl && level) lvlEl.textContent = `LVL ${level}`;
    if (avatarEl && user?.name) {
      const initial = user.name.trim().charAt(0).toUpperCase();
      if (initial) avatarEl.textContent = initial;
    }
  }

  async handleProfileUpdate(e) {
    e.preventDefault();
    const nameInput = document.getElementById('profileDisplayName');
    const statusMsg = document.getElementById('profileStatusMsg');

    if (!nameInput) return;
    const newName = nameInput.value.trim();

    if (!newName) {
      if (statusMsg) statusMsg.textContent = 'Name cannot be blank.';
      return;
    }

    try {
      await window.playerApi.updateProfile({ name: newName });
      if (statusMsg) {
        statusMsg.textContent = 'Explorer identity successfully updated.';
        statusMsg.className = 'text-success small';
      }
      // Update header stats with new name
      this.updateHeaderStats({ name: newName }, null);
    } catch (err) {
      if (statusMsg) {
        statusMsg.textContent = `Update failed: ${err.message}`;
        statusMsg.className = 'text-danger small';
      }
    }
  }
}

// Global player app instance
window.playerApp = new PlayerApp();

// Initialization lifecycle
document.addEventListener('DOMContentLoaded', () => {
  window.playerApp.init();
  if (window.playerAuth) {
    window.playerAuth.init();
  }
  if (window.playerSplash) {
    window.playerSplash.init();
  }
  if (window.playerAuth && typeof window.playerAuth.handleInitialRoute === 'function') {
    window.playerAuth.handleInitialRoute();
  }
});
