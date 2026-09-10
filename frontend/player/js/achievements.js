/**
 * ASCENDRA Player Achievement Hall Shell Module
 * Frontend presentation layer displaying progression milestone badges derived
 * transparently from player level, score, and discovery counts.
 * Note: Does not claim persistent backend achievement storage.
 */

const playerAchievements = {
  async render() {
    const container = document.getElementById('achievementsContent');
    if (!container) return;

    this.showLoading(container);

    try {
      const [profileData, questsData, cluesData] = await Promise.all([
        window.playerApi.getProfile().catch(() => null),
        window.playerApi.getQuests().catch(() => []),
        window.playerApi.getClues().catch(() => [])
      ]);

      this.renderHall(container, profileData, questsData, cluesData);
    } catch (err) {
      this.showError(container, err.message);
    }
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="player-loading-state">
        <div class="player-spinner"></div>
        <p>Polishing trophy pedestals...</p>
      </div>
    `;
  },

  showError(container, message) {
    container.innerHTML = `
      <div class="player-error-state">
        <div class="error-rune">⚠️</div>
        <h3>Trophy hall currently closed</h3>
        <p>${this.escapeHtml(message)}</p>
        <button class="game-btn game-btn-primary" onclick="playerAchievements.render()">Retry</button>
      </div>
    `;
  },

  renderHall(container, profilePayload, questsList, cluesList) {
    const profile = profilePayload?.profile || {};
    const level = profile.level || 1;
    const score = profile.score || 0;
    const cluesCount = (cluesList || []).length;
    const completedQuests = (questsList || []).filter(q => q.playerProgress?.status === 'completed').length;

    // Progression Milestones defined visually against verified stats
    const milestones = [
      {
        id: 'first_discovery',
        title: '✦ FIRST DISCOVERY',
        description: 'Uncover your first ancient inscription in the ruins.',
        icon: '📜',
        unlocked: cluesCount > 0,
        progressText: `${cluesCount}/1 Inscriptions`
      },
      {
        id: 'crypt_explorer',
        title: '✦ CRYPT EXPLORER',
        description: 'Complete at least one major expedition quest.',
        icon: '🗺️',
        unlocked: completedQuests > 0,
        progressText: `${completedQuests}/1 Quests Completed`
      },
      {
        id: 'cipher_adept',
        title: '✦ CIPHER ADEPT',
        description: 'Reach Explorer Level 3 through problem-solving.',
        icon: '⭐',
        unlocked: level >= 3,
        progressText: `Level ${level}/3`
      },
      {
        id: 'relic_veteran',
        title: '✦ EXPEDITION VETERAN',
        description: 'Accumulate over 2,500 cumulative exploration points.',
        icon: '🏆',
        unlocked: score >= 2500,
        progressText: `${score.toLocaleString()} / 2,500 pts`
      },
      {
        id: 'mystery_1',
        title: '🔒 MYSTERY OF THE ANCIENTS',
        description: 'Continue exploring the lost realms to reveal this achievement.',
        icon: '❓',
        unlocked: false,
        progressText: 'Locked'
      },
      {
        id: 'mystery_2',
        title: '🔒 CELESTIAL SCHOLAR',
        description: 'Master the high-level celestial mechanisms in later stages.',
        icon: '❓',
        unlocked: false,
        progressText: 'Locked'
      }
    ];

    const unlockedCount = milestones.filter(m => m.unlocked).length;

    container.innerHTML = `
      <div class="achievement-header-row">
        <div>
          <h2>HALL OF EXPEDITION ACHIEVEMENTS</h2>
          <p class="panel-subtitle">Milestones commemorated from verified player progression and world discoveries.</p>
        </div>
        <div class="achievement-stats-badge">
          <span>${unlockedCount} of ${milestones.length} Milestones Achieved</span>
        </div>
      </div>

      <!-- Honest Architecture Notice -->
      <div class="milestone-notice-card">
        <span class="notice-icon">ℹ️</span>
        <p>The Achievement Hall is a visual progression presentation layer reflecting your live level, score, and unlocked clues. Dedicated persistent achievement databases will be integrated in future phases.</p>
      </div>

      <!-- Milestone Cards Grid -->
      <div class="achievements-grid">
        ${milestones.map(m => `
          <div class="achievement-card ${m.unlocked ? 'unlocked' : 'locked'}">
            <div class="achievement-icon-wrap">
              ${m.icon}
            </div>
            <div class="achievement-body">
              <div class="achievement-top-meta">
                <h4 class="achievement-title">${this.escapeHtml(m.title)}</h4>
                <span class="achievement-state-pill ${m.unlocked ? 'unlocked' : 'locked'}">
                  ${m.unlocked ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>
              <p class="achievement-desc">${this.escapeHtml(m.description)}</p>
              <div class="achievement-progress-label">
                ${this.escapeHtml(m.progressText)}
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
