/**
 * ASCENDRA Adventure & Unity WebGL Hosting Shell Module
 * Renders the web-side hosting container for the existing Unity WebGL game,
 * manages active quest objectives, progress synchronizers, and return-to-hub controls.
 */

const playerAdventure = {
  selectedQuestId: null,

  async render(questId = null) {
    const container = document.getElementById('adventureContent');
    if (!container) return;

    this.showLoading(container);

    try {
      const quests = await window.playerApi.getQuests();
      this.renderAdventureView(container, quests, questId);
    } catch (err) {
      this.showError(container, err.message);
    }
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="player-loading-state">
        <div class="player-spinner"></div>
        <p>Loading adventure world shell...</p>
      </div>
    `;
  },

  showError(container, message) {
    container.innerHTML = `
      <div class="player-error-state">
        <div class="error-rune">⚠️</div>
        <h3>Adventure currently unreachable</h3>
        <p>${this.escapeHtml(message)}</p>
        <button class="game-btn game-btn-primary" onclick="playerAdventure.render()">Retry</button>
      </div>
    `;
  },

  renderAdventureView(container, quests, targetQuestId) {
    // Select the requested quest or default to active/first
    const activeQuests = quests.filter(q => q.playerProgress?.status === 'in_progress');
    const defaultQuest = activeQuests[0] || quests[0] || {
      id: 'quest-crypt-001',
      title: 'Secrets of the Cipher Crypt',
      description: 'Explore the ancient ruins and decipher the mechanism to unlock the gate.',
      difficulty: 'medium',
      category: 'cryptography',
      xpReward: 250,
      scoreReward: 500,
      playerProgress: { status: 'in_progress', progress: 65 }
    };

    const currentQuest = (targetQuestId ? quests.find(q => q.id === targetQuestId) : null) || defaultQuest;
    this.selectedQuestId = currentQuest.id;

    const progress = currentQuest.playerProgress?.progress || 0;
    const status = currentQuest.playerProgress?.status || 'not_started';

    container.innerHTML = `
      <!-- Adventure Shell Top Controls -->
      <div class="adventure-shell-header">
        <button class="game-btn game-btn-outline" onclick="playerApp.navigateTo('dashboard')">
          ← Return to Hub
        </button>
        <div class="shell-quest-badge">
          <span class="pulse-dot">●</span>
          <span>${this.escapeHtml(currentQuest.title)}</span>
        </div>
        <div class="adventure-actions">
          <button class="game-btn game-btn-sm" onclick="playerAdventure.toggleFullscreen()">
            ⛶ Fullscreen
          </button>
        </div>
      </div>

      <!-- Unity WebGL Hosting Shell Canvas Frame -->
      <div id="unityViewportContainer" class="unity-viewport-frame">
        <div class="unity-shell-canvas-mount">
          <div class="webgl-pending-banner">
            <div class="realm-emblem">🛡️</div>
            <h2>ASCENDRA — ADVENTURE WORLD</h2>
            <p class="webgl-notice-subtext">
              Existing Unity WebGL game will load here
            </p>
            <div class="build-pending-chip">
              [ WEBGL BUILD PENDING ]
            </div>
            <p class="webgl-info-note">
              The existing Unity adventure map (Stage_1_1_Village) is preserved and ready for export into this hosting container.
            </p>
          </div>
        </div>

        <!-- Quest Status Strip at Bottom of Adventure Shell -->
        <div class="adventure-quest-strip">
          <div class="strip-quest-details">
            <span class="strip-label">CURRENT EXPEDITION OBJECTIVE</span>
            <h3 class="strip-quest-name">${this.escapeHtml(currentQuest.title)}</h3>
            <p class="strip-quest-desc">${this.escapeHtml(currentQuest.description)}</p>
          </div>

          <div class="strip-progress-box">
            <div class="strip-progress-header">
              <span>Objective Progress</span>
              <strong>${progress}%</strong>
            </div>
            <div class="game-progress-bar">
              <div class="game-progress-fill glow-cyan" style="width: ${progress}%;"></div>
            </div>
          </div>

          <div class="strip-controls">
            ${status === 'not_started' ? `
              <button class="game-btn game-btn-cta" onclick="playerAdventure.startCurrentQuest('${this.escapeHtml(currentQuest.id)}')">
                Embark on Quest
              </button>
            ` : status === 'in_progress' ? `
              <button class="game-btn game-btn-primary" onclick="playerAdventure.advanceProgress('${this.escapeHtml(currentQuest.id)}')">
                Interact with Mechanism
              </button>
            ` : `
              <span class="badge-completed">✓ Quest Completed</span>
            `}
          </div>
        </div>
      </div>

      <!-- Available Quests Drawer -->
      <div class="quest-selector-panel">
        <h3 class="panel-subheading">EXPEDITION LOGBOOK</h3>
        <div class="quest-cards-scroll">
          ${quests.map(q => {
            const isSelected = q.id === currentQuest.id;
            const qProg = q.playerProgress?.progress || 0;
            const qStat = q.playerProgress?.status || 'not_started';

            return `
              <div class="quest-log-card ${isSelected ? 'selected' : ''}" onclick="playerAdventure.render('${this.escapeHtml(q.id)}')">
                <div class="quest-log-header">
                  <span class="quest-category-tag">${this.escapeHtml(q.category || 'Adventure')}</span>
                  <span class="quest-diff-tag ${this.escapeHtml(q.difficulty)}">${this.escapeHtml(q.difficulty)}</span>
                </div>
                <h4 class="quest-log-title">${this.escapeHtml(q.title)}</h4>
                <div class="game-progress-bar">
                  <div class="game-progress-fill ${qStat === 'completed' ? 'fill-gold' : 'glow-cyan'}" style="width: ${qProg}%;"></div>
                </div>
                <div class="quest-log-meta">
                  <span>${qStat === 'completed' ? 'Completed' : `${qProg}% Progress`}</span>
                  <span>+${q.xpReward || 100} XP</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  async startCurrentQuest(questId) {
    try {
      await window.playerApi.startQuest(questId);
      await this.render(questId);
    } catch (err) {
      alert(`Could not start quest: ${err.message}`);
    }
  },

  async advanceProgress(questId) {
    try {
      const res = await window.playerApi.updateQuestProgress(questId, { stepIncrement: 15 });
      if (res?.progress >= 100) {
        // Automatically trigger completion rewards
        const compRes = await window.playerApi.completeQuest(questId);
        alert(`🎉 Quest Completed! Earned +${compRes.rewards?.xpEarned || 150} XP!`);
      }
      await this.render(questId);
    } catch (err) {
      alert(`Progress update failed: ${err.message}`);
    }
  },

  toggleFullscreen() {
    const frame = document.getElementById('unityViewportContainer');
    if (!frame) return;

    if (!document.fullscreenElement) {
      frame.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
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

window.playerAdventure = playerAdventure;
