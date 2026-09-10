/**
 * ASCENDRA Admin Game Analytics Module
 * Visualizes quest progression, puzzle accuracy rates, topic breakdowns, and player tier distributions.
 */

const analytics = {
  async render() {
    const container = document.getElementById('analyticsContent');
    if (!container) return;

    this.showLoading(container);

    try {
      const data = await window.api.getGameAnalytics();
      this.renderAnalytics(container, data);
    } catch (err) {
      this.showError(container, err.message);
    }
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Analyzing game progression telemetry...</p>
      </div>
    `;
  },

  showError(container, message) {
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Failed to load game analytics</h3>
        <p>${this.escapeHtml(message)}</p>
        <button class="btn btn-primary" onclick="analytics.render()">Retry</button>
      </div>
    `;
  },

  renderAnalytics(container, data) {
    const quests = data?.quests || {};
    const puzzles = data?.puzzles || {};
    const progression = data?.progression || {};
    const topicBreakdown = puzzles.topicBreakdown || [];
    const levelDistribution = progression.levelDistribution || [];
    const topPlayers = progression.topPlayers || [];

    container.innerHTML = `
      <!-- Top Row KPI Stats -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Quest Completion Rate</span>
            <span class="kpi-icon">🎯</span>
          </div>
          <div class="kpi-value text-primary">${quests.completionRate || 0}%</div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${Math.min(100, quests.completionRate || 0)}%;"></div>
          </div>
          <div class="kpi-meta text-muted">
            ${quests.completedQuests || 0} completed / ${quests.startedQuests || 0} started
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Overall Puzzle Accuracy</span>
            <span class="kpi-icon">🧠</span>
          </div>
          <div class="kpi-value text-success">${puzzles.accuracyRate || 0}%</div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill fill-success" style="width: ${Math.min(100, puzzles.accuracyRate || 0)}%;"></div>
          </div>
          <div class="kpi-meta text-muted">
            ${(puzzles.correctAttempts || 0).toLocaleString()} correct / ${(puzzles.totalAttempts || 0).toLocaleString()} attempts
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Average Time per Puzzle</span>
            <span class="kpi-icon">⏱️</span>
          </div>
          <div class="kpi-value">${puzzles.averageTimeSeconds || 0}s</div>
          <div class="kpi-meta text-muted">Active calculation & deduction time</div>
        </div>
      </div>

      <!-- Main Analytics Panels Grid -->
      <div class="analytics-grid">
        <!-- Topic Accuracy Breakdown -->
        <div class="panel-card">
          <div class="panel-header">
            <h3>Knowledge Domain Accuracy Breakdown</h3>
            <span class="text-muted small">Anti-coding educational challenge domains</span>
          </div>
          <div class="panel-body">
            ${topicBreakdown.length === 0 ? '<p class="text-muted">No topic attempts logged yet.</p>' : `
              <div class="topic-bars-list">
                ${topicBreakdown.map(t => {
                  const topicTitle = this.formatTopic(t.topic);
                  return `
                    <div class="topic-bar-row">
                      <div class="topic-row-header">
                        <span class="topic-title">${this.escapeHtml(topicTitle)}</span>
                        <span class="topic-meta">
                          <strong>${t.accuracy}%</strong> (${t.correct}/${t.attempts} correct)
                        </span>
                      </div>
                      <div class="progress-bar-container">
                        <div class="progress-bar-fill fill-indigo" style="width: ${Math.min(100, t.accuracy)}%;"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Level Distribution & Top Players -->
        <div class="panel-card">
          <div class="panel-header">
            <h3>Top Player Standings</h3>
            <span class="text-muted small">Leaderboard based on cumulative score</span>
          </div>
          <div class="panel-body">
            ${topPlayers.length === 0 ? '<p class="text-muted">No players ranked yet.</p>' : `
              <ul class="leaderboard-list">
                ${topPlayers.map((p, idx) => `
                  <li class="leaderboard-item">
                    <span class="rank-badge rank-${idx + 1}">#${idx + 1}</span>
                    <div class="leaderboard-name">
                      <strong>${this.escapeHtml(p.name || 'Anonymous')}</strong>
                      <span class="text-muted small">Level ${p.level}</span>
                    </div>
                    <div class="leaderboard-score">
                      <strong>${(p.score || 0).toLocaleString()}</strong> pts
                    </div>
                  </li>
                `).join('')}
              </ul>
            `}

            <h4 style="margin-top: 1.5rem; margin-bottom: 0.75rem;">Player Tier Level Spread</h4>
            <div class="level-spread-container">
              ${levelDistribution.length === 0 ? '<p class="text-muted small">No profile distribution available.</p>' : `
                <div class="level-pills">
                  ${levelDistribution.map(lvl => `
                    <div class="level-pill">
                      <span class="lvl-label">Lvl ${lvl.level}</span>
                      <span class="lvl-count">${lvl.count} ${lvl.count === 1 ? 'player' : 'players'}</span>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  formatTopic(slug) {
    if (!slug) return 'General';
    return slug
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
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

window.analytics = analytics;
