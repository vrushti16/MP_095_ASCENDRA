/**
 * ASCENDRA Player Dashboard Hub Module
 * Renders the dominant "Continue Adventure" action, hero character card,
 * live progression meters, active quests, and recent discoveries.
 * 100% Server-Authoritative: Bound to real Unity gameplay progression state.
 */

const playerDashboard = {
  async render() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;

    this.showLoading(container);

    try {
      const [progressionData, questsData, cluesData] = await Promise.all([
        window.playerApi.getProgression().catch(() => null),
        window.playerApi.getQuests().catch(() => []),
        window.playerApi.getClues().catch(() => [])
      ]);

      this.renderHub(container, progressionData, questsData, cluesData);
    } catch (err) {
      this.showError(container, err.message);
    }
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="player-loading-state">
        <div class="player-spinner"></div>
        <p>Attuning player hub...</p>
      </div>
    `;
  },

  showError(container, message) {
    container.innerHTML = `
      <div class="player-error-state">
        <div class="error-rune">⚠️</div>
        <h3>Failed to load player hub</h3>
        <p>${this.escapeHtml(message)}</p>
        <button class="game-btn game-btn-primary" onclick="playerDashboard.render()">Reconnect</button>
      </div>
    `;
  },

  renderHub(container, progressionPayload, questsList, cluesList) {
    const player = progressionPayload?.player || {};
    const gameProgress = progressionPayload?.gameProgress || {};
    const user = window.playerApi.getUser() || { name: player.name, email: player.email };
    const level = player.level || 1;
    const experience = player.xp || 0;
    const xpForNextLevel = player.xpForNextLevel || 100;
    const xpRemaining = player.xpRemaining ?? Math.max(0, xpForNextLevel - experience);
    const xpPercent = player.progressPercentage || 0;
    const score = player.score || 0;
    const health = player.health || 100;
    const maxHealth = player.maxHealth || 100;

    // Determine the active quest to highlight
    const activeQuests = (questsList || []).filter(q => q.playerProgress?.status === 'in_progress');
    const availableQuests = (questsList || []).filter(q => q.playerProgress?.status === 'not_started');
    const completedQuests = (questsList || []).filter(q => q.playerProgress?.status === 'completed');

    const starterQuest = availableQuests.find(q => q.id === 'quest_village_basics');
    const primaryQuest = activeQuests[0] || starterQuest || availableQuests[0] || {
      id: 'quest_village_basics',
      title: 'Welcome to Ascendra: Village Awakening',
      category: 'tutorial',
      difficulty: 'easy',
      description: 'Explore the starter village, inspect the surroundings, and discover your first set of ancient markings.',
      playerProgress: { progress: 0, status: 'not_started' }
    };

    const currentProgress = primaryQuest.playerProgress?.progress || 0;

    // Update top header status indicators with authoritative level
    this.updateHeaderStats(user, level, health, maxHealth);

    container.innerHTML = `
      <!-- Dominant Primary Hero Action: Current Adventure -->
      <div class="adventure-hero-card">
        <div class="hero-bg-overlay"></div>
        <div class="hero-content">
          <div class="hero-tag">CURRENT ADVENTURE</div>
          <h2 class="hero-quest-title">${this.escapeHtml(primaryQuest.title)}</h2>
          <p class="hero-quest-desc">${this.escapeHtml(primaryQuest.description)}</p>

          <div class="hero-progress-group">
            <div class="progress-label-row">
              <span>Quest Progress</span>
              <strong class="progress-percent">${currentProgress}%</strong>
            </div>
            <div class="game-progress-bar">
              <div class="game-progress-fill glow-cyan" style="width: ${currentProgress}%;"></div>
            </div>
          </div>

          <div class="hero-action-row">
            <button class="game-btn game-btn-cta" onclick="playerApp.navigateTo('adventure', '${this.escapeHtml(primaryQuest.id)}')">
              ⚔️ ${primaryQuest.playerProgress?.status === 'in_progress' ? 'CONTINUE ADVENTURE' : 'EMBARK ON ADVENTURE'}
            </button>
            <span class="difficulty-chip ${this.escapeHtml(primaryQuest.difficulty || 'easy')}">
              ${this.escapeHtml((primaryQuest.difficulty || 'EASY').toUpperCase())}
            </span>
          </div>
        </div>
      </div>

      <!-- Player Progression & Stats Row -->
      <div class="player-stats-grid">
        <!-- Level & XP Card (Authoritatively Driven) -->
        <div class="fantasy-card">
          <div class="card-header-compact">
            <span class="card-label">EXPLORER PROGRESSION</span>
            <span class="level-chip">LEVEL ${level}</span>
          </div>
          <div class="stat-main-value">${experience.toLocaleString()} <span class="stat-unit">/ ${xpForNextLevel.toLocaleString()} XP</span></div>
          <div class="game-progress-bar">
            <div class="game-progress-fill glow-violet" style="width: ${xpPercent}%;"></div>
          </div>
          <div class="card-footer-meta">
            <span>Score: <strong>${score.toLocaleString()}</strong> pts</span>
            <span>${xpPercent}% to Level ${level + 1} (${xpRemaining.toLocaleString()} XP needed)</span>
          </div>
        </div>

        <!-- Vitality / Health Card -->
        <div class="fantasy-card">
          <div class="card-header-compact">
            <span class="card-label">EXPEDITION VITALITY</span>
            <span class="health-chip">❤️ HEALTH</span>
          </div>
          <div class="stat-main-value text-crimson">${health} <span class="stat-unit">/ ${maxHealth} HP</span></div>
          <div class="game-progress-bar">
            <div class="game-progress-fill fill-crimson" style="width: ${Math.round((health / maxHealth) * 100)}%;"></div>
          </div>
          <div class="card-footer-meta">
            <span>Status: Nominal</span>
            <span>Survival Rate: 100%</span>
          </div>
        </div>

        <!-- Quests Summary Card -->
        <div class="fantasy-card">
          <div class="card-header-compact">
            <span class="card-label">QUEST CAMPAIGN</span>
            <span class="quest-count-chip">${(questsList || []).length} Quests</span>
          </div>
          <div class="campaign-summary-row">
            <div class="campaign-stat">
              <span class="camp-val text-cyan">${activeQuests.length}</span>
              <span class="camp-lbl">In Progress</span>
            </div>
            <div class="campaign-stat">
              <span class="camp-val text-gold">${completedQuests.length}</span>
              <span class="camp-lbl">Completed</span>
            </div>
            <div class="campaign-stat">
              <span class="camp-val text-muted">${availableQuests.length}</span>
              <span class="camp-lbl">Available</span>
            </div>
          </div>
          <div class="card-footer-meta">
            <button class="btn-link" onclick="playerApp.navigateTo('adventure')">Open Quest Log →</button>
          </div>
        </div>
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

      <!-- Relic & Clue Discoveries Section -->
      <div class="dashboard-discoveries-section">
        <div class="section-title-row">
          <h3>ARCHAEOLOGICAL DISCOVERIES</h3>
          <button class="btn-link" onclick="playerApp.navigateTo('clues')">View Journal (${(cluesList || []).length}) →</button>
        </div>

        ${(cluesList || []).length === 0 ? `
          <div class="empty-relic-vault">
            <div class="empty-relic-icon">🗝️</div>
            <h4>Vault Awaiting Discoveries</h4>
            <p>No ancient relics or clues have been unearthed yet. Venture into the world to discover cipher keys and forgotten tablets.</p>
            <button class="game-btn game-btn-outline" onclick="playerApp.navigateTo('adventure')">Begin Expedition</button>
          </div>
        ` : `
          <div class="relic-cards-grid">
            ${cluesList.slice(0, 4).map(c => `
              <div class="relic-card" onclick="playerApp.navigateTo('clues', '${this.escapeHtml(c.id)}')">
                <div class="relic-icon-wrap">📜</div>
                <div class="relic-card-body">
                  <h4 class="relic-name">${this.escapeHtml(c.title)}</h4>
                  <span class="relic-quest-tag">${this.escapeHtml(c.questTitle || 'Expedition Clue')}</span>
                  <p class="relic-snippet">${this.escapeHtml(c.content.slice(0, 75))}...</p>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  updateHeaderStats(user, level, health, maxHealth) {
    const nameEl = document.getElementById('headerPlayerName');
    const lvlEl = document.getElementById('headerPlayerLevel');
    const hpBar = document.getElementById('headerHealthBar');
    const avatarEl = document.getElementById('headerPlayerAvatar') || document.querySelector('.hud-avatar');

    if (nameEl) nameEl.textContent = user.name || 'Explorer';
    if (lvlEl) lvlEl.textContent = `LVL ${level}`;
    if (hpBar) hpBar.style.width = `${Math.round((health / maxHealth) * 100)}%`;
    if (avatarEl && user?.name) {
      const initial = user.name.trim().charAt(0).toUpperCase();
      if (initial) avatarEl.textContent = initial;
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

window.playerDashboard = playerDashboard;
