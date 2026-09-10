/**
 * ASCENDRA Admin Application Controller
 * Manages section navigation, active tab state, refresh cycles, and mobile sidebar toggle.
 */

class AdminApp {
  constructor() {
    this.currentSection = 'overview';
    this.sections = ['overview', 'users', 'analytics', 'health'];
    this.navItems = {};
    this.sectionContainers = {};
  }

  init() {
    // Cache nav items and section containers
    this.sections.forEach(id => {
      this.navItems[id] = document.getElementById(`nav-${id}`);
      this.sectionContainers[id] = document.getElementById(`section-${id}`);

      if (this.navItems[id]) {
        this.navItems[id].addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateTo(id);
          this.closeMobileNav();
        });
      }
    });

    // Mobile menu toggle
    this.sidebar = document.getElementById('sidebar');
    this.mobileToggle = document.getElementById('mobileMenuToggle');
    if (this.mobileToggle && this.sidebar) {
      this.mobileToggle.addEventListener('click', () => {
        this.sidebar.classList.toggle('sidebar-open');
      });
    }

    // Backdrop for mobile nav
    this.navBackdrop = document.getElementById('navBackdrop');
    if (this.navBackdrop) {
      this.navBackdrop.addEventListener('click', () => {
        this.closeMobileNav();
      });
    }

    // Global refresh button
    this.refreshBtn = document.getElementById('globalRefreshBtn');
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        this.loadCurrentSection();
      });
    }

    // Modal close button handlers
    const closeModalBtn = document.getElementById('closeUserModalBtn');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        if (window.users) window.users.closeInspectModal();
      });
    }

    // Close modal on backdrop click
    const userModal = document.getElementById('userDetailModal');
    if (userModal) {
      userModal.addEventListener('click', (e) => {
        if (e.target === userModal) {
          if (window.users) window.users.closeInspectModal();
        }
      });
    }

    // Listen for escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (window.users) window.users.closeInspectModal();
      }
    });
  }

  closeMobileNav() {
    if (this.sidebar) {
      this.sidebar.classList.remove('sidebar-open');
    }
  }

  navigateTo(sectionId) {
    if (!this.sections.includes(sectionId)) return;

    this.currentSection = sectionId;

    // Update nav active states
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

    // Load section data
    this.loadCurrentSection();
  }

  loadCurrentSection() {
    switch (this.currentSection) {
      case 'overview':
        if (window.dashboard) window.dashboard.render();
        break;
      case 'users':
        if (window.users) window.users.render();
        break;
      case 'analytics':
        if (window.analytics) window.analytics.render();
        break;
      case 'health':
        if (window.health) window.health.render();
        break;
    }
  }
}

// Global App Instance
window.app = new AdminApp();

// Initialization lifecycle
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
  if (window.auth) {
    window.auth.init();
  }
});
