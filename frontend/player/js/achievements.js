/**
 * ASCENDRA Player Achievement Hall Module
 * Real-time progression milestones earned exclusively through verified Unity Game Engine events.
 * 100% Server-Authoritative: Fetches progression and achievements directly from backend APIs.
 */

const playerAchievements = {
  syncIntervalId: null,
  previousUnlockedIds: new Set(),
  lastSyncTime: null,
  isSyncing: false,
  hasInitialized: false,

  async render(showLoadingSpinner = true) {
    const container = document.getElementById('achievementsContent');
    if (!container) return;

    if (showLoadingSpinner && !this.hasInitialized) {
      this.showLoading(container);
    }

    try {
      const progressionData = await window.playerApi.getProgression();
      this.lastSyncTime = new Date();
      this.renderHall(container, progressionData);
      this.hasInitialized = true;
      this.startAutoSync();
    } catch (err) {
      this.showError(container, err.message);
    }
  },

  startAutoSync() {
    this.stopAutoSync();
    // Poll every 3 seconds while on the Achievements tab to reflect live Unity progress
    this.syncIntervalId = setInterval(() => {
      this.syncLiveProgress();
    }, 3000);
  },

  stopAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  },

  async syncLiveProgress() {
    const container = document.getElementById('achievementsContent');
    if (!container) return;

    // Only sync if user is currently viewing the achievements section
    const section = document.getElementById('player-section-achievements');
    if (section && section.classList.contains('hidden')) {
      this.stopAutoSync();
      return;
    }

    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const progressionData = await window.playerApi.getProgression();
      this.lastSyncTime = new Date();
      this.renderHall(container, progressionData);
    } catch (err) {
      console.warn('[Achievements] Auto-sync check warning:', err.message);
    } finally {
      this.isSyncing = false;
    }
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="player-loading-state">
        <div class="player-spinner"></div>
        <p>Connecting with authoritative ASCENDRA server...</p>
      </div>
    `;
  },

  showError(container, message) {
    container.innerHTML = `
      <div class="player-error-state">
        <div class="error-rune">⚠️</div>
        <h3>Trophy hall connection lost</h3>
        <p>${this.escapeHtml(message)}</p>
        <button class="game-btn game-btn-primary" onclick="playerAchievements.render(true)">Retry</button>
      </div>
    `;
  },

  formatProgressLabel(item) {
    const curr = item.currentProgress || 0;
    const target = item.targetProgress || 1;

    switch (item.requirementType) {
      case 'DISCOVERY_COUNT':
        return `${Math.min(curr, target)} / ${target} Inscriptions Discovered`;
      case 'QUEST_COUNT':
        return `${Math.min(curr, target)} / ${target} Quests Completed`;
      case 'LEVEL':
        return `Level ${curr} / ${target} Reached`;
      case 'XP':
        return `${Number(curr).toLocaleString()} / ${Number(target).toLocaleString()} Exploration XP`;
      case 'PUZZLE_COUNT':
        return `${Math.min(curr, target)} / ${target} Puzzles Solved`;
      case 'PUZZLE_CATEGORY_COUNT':
        return `${Math.min(curr, target)} / ${target} Reasoning Puzzles Solved`;
      default:
        return `${curr} / ${target}`;
    }
  },

  renderHall(container, progressionPayload) {
    const player = progressionPayload?.player || {};
    const gameProgress = progressionPayload?.gameProgress || {};
    const achievementsData = progressionPayload?.achievements || {};
    const items = achievementsData.items || [];
    const unlockedCount = achievementsData.unlocked || 0;
    const totalCount = achievementsData.total || items.length;

    // Detect newly unlocked milestones to fire toasts
    items.forEach(m => {
      if (m.unlocked && !this.previousUnlockedIds.has(m.id)) {
        if (this.hasInitialized && window.AscendraUnityBridge) {
          window.AscendraUnityBridge.showAchievementToast(m.name, m.description);
        }
        this.previousUnlockedIds.add(m.id);
      }
    });

    const syncTimeStr = this.lastSyncTime ? this.lastSyncTime.toLocaleTimeString() : 'Active';

    container.innerHTML = `
      <div class="achievement-header-row">
        <div>
          <h2>HALL OF EXPEDITION ACHIEVEMENTS</h2>
          <p class="panel-subtitle">Milestones commemorated from verified Unity player progression and world discoveries.</p>
        </div>
        <div class="achievement-header-meta">
          <div class="achievement-stats-badge">
            <span>${unlockedCount} of ${totalCount} Milestones Achieved (${achievementsData.percentage || 0}%)</span>
          </div>
        </div>
      </div>

      <!-- Live Unity Game Engine Synchronization Card -->
      <div class="unity-sync-live-card">
        <div class="sync-status-indicator">
          <span class="sync-pulse-dot"></span>
          <span class="sync-title">AUTO-UPDATED THROUGH UNITY GAME ONLY</span>
          <span class="sync-badge">Authoritative Sync (${syncTimeStr})</span>
        </div>
        <p class="sync-desc">
          Achievements in the Hall of Expedition are awarded exclusively through verified in-game Unity events. As you uncover ancient ruins, decipher rune tablets, and solve dynamic aptitude puzzles in Unity, the authoritative game server validates each accomplishment and updates your trophies automatically.
        </p>
      </div>

      <!-- ASCENDRA Game Progress Authoritative Summary -->
      <div class="game-progress-panel">
        <div class="game-progress-header">
          <div class="game-progress-title">
            <span>⚔️ ASCENDRA GAME PROGRESS</span>
          </div>
          <div class="game-progress-big-val">${gameProgress.overallPercentage || 0}%</div>
        </div>
        <div class="game-progress-bar">
          <div class="game-progress-fill glow-cyan" style="width: ${gameProgress.overallPercentage || 0}%;"></div>
        </div>
        <div class="game-progress-metric-grid">
          <div class="game-progress-metric-item">
            <span class="metric-label">Quests</span>
            <span class="metric-value">${gameProgress.completedQuests || 0} / ${gameProgress.totalQuests || 3}</span>
            <span class="metric-sub">${gameProgress.inProgressQuests || 0} in progress</span>
          </div>
          <div class="game-progress-metric-item">
            <span class="metric-label">Dynamic Puzzles</span>
            <span class="metric-value">${gameProgress.completedPuzzles || 0} / ${gameProgress.totalRequiredPuzzles || 10}</span>
            <span class="metric-sub">Authoritative Solves</span>
          </div>
          <div class="game-progress-metric-item">
            <span class="metric-label">Stages</span>
            <span class="metric-value">${gameProgress.completedStages || 0} / ${gameProgress.totalStages || 3}</span>
            <span class="metric-sub">Campaign Stages</span>
          </div>
          <div class="game-progress-metric-item">
            <span class="metric-label">Discoveries</span>
            <span class="metric-value">${gameProgress.discoveredInscriptions || 0} / ${gameProgress.totalInscriptions || 5}</span>
            <span class="metric-sub">Ancient Inscriptions</span>
          </div>
          <div class="game-progress-metric-item">
            <span class="metric-label">Realms</span>
            <span class="metric-value">${gameProgress.unlockedRealms || 1} / ${gameProgress.totalRealms || 3}</span>
            <span class="metric-sub">Explored Realms</span>
          </div>
        </div>
      </div>

      <!-- Milestone Cards Grid -->
      <div class="achievements-grid">
        ${items.map(m => `
          <div class="achievement-card ${m.unlocked ? 'unlocked' : 'locked'}">
            <div class="achievement-icon-wrap">
              ${m.icon || '🏆'}
            </div>
            <div class="achievement-body">
              <div class="achievement-top-meta">
                <h4 class="achievement-title">${this.escapeHtml(m.name)}</h4>
                <span class="achievement-state-pill ${m.unlocked ? 'unlocked' : 'locked'}">
                  ${m.unlocked ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>
              <p class="achievement-desc">${this.escapeHtml(m.description)}</p>
              
              <div class="achievement-card-progress-wrap">
                <div class="achievement-progress-label">
                  ${this.escapeHtml(this.formatProgressLabel(m))}
                </div>
                <div class="achievement-card-progress-bar">
                  <div class="achievement-card-progress-fill" style="width: ${m.progressPercentage || 0}%;"></div>
                </div>
              </div>

              <div class="achievement-footer-meta">
                <span class="achievement-reward-tag">+${m.xpReward || 50} XP</span>
                <span class="achievement-unlock-date">
                  ${m.unlocked && m.unlockedAt ? `Unlocked ${new Date(m.unlockedAt).toLocaleDateString()}` : 'Awaiting gameplay trigger'}
                </span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.playerAchievements = playerAchievements;
