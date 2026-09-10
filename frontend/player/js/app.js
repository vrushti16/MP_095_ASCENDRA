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
  }

  closeMobileNav() {
    if (this.sidebar) {
      this.sidebar.classList.remove('open');
    }
  }

  navigateTo(sectionId, contextParam = null) {
    if (!this.sections.includes(sectionId)) return;

    this.currentSection = sectionId;

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

    try {
      const data = await window.playerApi.getProfile();
      const u = data?.user || window.playerApi.getUser() || {};
      const p = data?.profile || {};

      if (nameInput) nameInput.value = u.name || '';
      if (emailDisplay) emailDisplay.textContent = u.email || 'N/A';
      if (roleDisplay) roleDisplay.textContent = (u.role || 'player').toUpperCase();
      if (createdDisplay) createdDisplay.textContent = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
      if (levelDisplay) levelDisplay.textContent = `Level ${p.level || 1}`;
      if (scoreDisplay) scoreDisplay.textContent = `${(p.score || 0).toLocaleString()} pts`;
      if (xpDisplay) xpDisplay.textContent = `${(p.experience || 0).toLocaleString()} XP`;
    } catch {
      // Fallback
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
      // Update header
      const headerName = document.getElementById('headerPlayerName');
      if (headerName) headerName.textContent = newName;
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
});
