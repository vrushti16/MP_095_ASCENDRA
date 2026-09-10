/**
 * ASCENDRA Admin Dashboard Overview Module
 * Fetches and renders high-level KPI metrics from GET /api/v1/admin/overview
 */

const dashboard = {
  async render() {
    const container = document.getElementById('overviewContent');
    if (!container) return;

    this.showLoading(container);

    try {
      const data = await window.api.getOverview();
      this.renderOverview(container, data);
    } catch (err) {
      this.showError(container, err.message);
    }
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading dashboard metrics...</p>
      </div>
    `;
  },

  showError(container, message) {
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Failed to load overview</h3>
        <p>${this.escapeHtml(message)}</p>
        <button class="btn btn-primary" onclick="dashboard.render()">Retry</button>
      </div>
    `;
  },

  renderOverview(container, data) {
    const users = data?.users || {};
    const quests = data?.quests || {};
    const puzzles = data?.puzzles || {};
    const progression = data?.progression || {};
    const health = data?.systemHealth || {};

    container.innerHTML = `
      <!-- Service Health Quick Strip -->
      <div class="service-strip-card">
        <div class="strip-header">
          <span class="strip-title">Platform Infrastructure Status</span>
          <span class="status-pill status-${health.status || 'unknown'}">
            ● ${health.status ? health.status.toUpperCase() : 'UNKNOWN'}
          </span>
        </div>
        <div class="service-strip-items">
          <div class="strip-item">
            <span class="strip-label">PostgreSQL</span>
            <span class="badge badge-${health.services?.postgresql === 'healthy' ? 'success' : 'danger'}">
              ${health.services?.postgresql || 'unknown'}
            </span>
          </div>
          <div class="strip-item">
            <span class="strip-label">Redis Cache</span>
            <span class="badge badge-${health.services?.redis === 'healthy' ? 'success' : 'warning'}">
              ${health.services?.redis || 'unavailable'}
            </span>
          </div>
          <div class="strip-item">
            <span class="strip-label">FastAPI AI</span>
            <span class="badge badge-${health.services?.fastapi === 'healthy' ? 'success' : 'warning'}">
              ${health.services?.fastapi || 'unavailable'}
            </span>
          </div>
        </div>
      </div>

      <!-- KPI Stat Cards Grid -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Total Registered Users</span>
            <span class="kpi-icon">👥</span>
          </div>
          <div class="kpi-value">${(users.total || 0).toLocaleString()}</div>
          <div class="kpi-meta">
            <span class="meta-tag player">${(users.players || 0).toLocaleString()} Players</span>
            <span class="meta-tag admin">${users.admins || 0} Admins</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Active Game Sessions</span>
            <span class="kpi-icon">🎮</span>
          </div>
          <div class="kpi-value">${(users.activeSessions || 0).toLocaleString()}</div>
          <div class="kpi-meta text-muted">Currently active explorer sessions</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Quest Engagements</span>
            <span class="kpi-icon">🗺️</span>
          </div>
          <div class="kpi-value">${(quests.completedQuests || 0).toLocaleString()}</div>
          <div class="kpi-meta">
            <span>${quests.inProgressQuests || 0} In Progress</span> •
            <span>${quests.activeQuests || 0} Catalog Quests</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Puzzle Accuracy Rate</span>
            <span class="kpi-icon">🧩</span>
          </div>
          <div class="kpi-value text-primary">${puzzles.accuracyRate || 0}%</div>
          <div class="kpi-meta">
            <span>${(puzzles.correctAttempts || 0).toLocaleString()} solved / ${(puzzles.totalAttempts || 0).toLocaleString()} attempts</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Average Explorer Level</span>
            <span class="kpi-icon">⭐</span>
          </div>
          <div class="kpi-value">${progression.averageLevel || 1.0}</div>
          <div class="kpi-meta text-muted">Across all registered player profiles</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Average Player Score</span>
            <span class="kpi-icon">🏆</span>
          </div>
          <div class="kpi-value">${(progression.averageScore || 0).toLocaleString()} pts</div>
          <div class="kpi-meta text-muted">Average XP: ${(progression.averageXp || 0).toLocaleString()} XP</div>
        </div>
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

window.dashboard = dashboard;
