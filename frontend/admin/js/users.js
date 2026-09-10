/**
 * ASCENDRA Admin User Management Module
 * Manages user search, pagination, role filtering, deep inspection, and role promotion/demotion.
 */

const users = {
  currentPage: 1,
  currentLimit: 15,
  currentSearch: '',
  currentRole: '',
  searchTimeout: null,
  activeSelectedUserId: null,

  init() {
    this.tableContainer = document.getElementById('usersTableContainer');
    this.searchInput = document.getElementById('userSearchInput');
    this.roleFilter = document.getElementById('userRoleFilter');
    this.paginationContainer = document.getElementById('userPagination');
    this.userModal = document.getElementById('userDetailModal');

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.currentSearch = e.target.value.trim();
          this.currentPage = 1;
          this.loadUsers();
        }, 350);
      });
    }

    if (this.roleFilter) {
      this.roleFilter.addEventListener('change', (e) => {
        this.currentRole = e.target.value;
        this.currentPage = 1;
        this.loadUsers();
      });
    }
  },

  async render() {
    this.init();
    await this.loadUsers();
  },

  async loadUsers() {
    if (!this.tableContainer) return;
    this.showLoading(this.tableContainer);

    try {
      const data = await window.api.getUsers({
        page: this.currentPage,
        limit: this.currentLimit,
        search: this.currentSearch,
        role: this.currentRole
      });

      this.renderTable(data);
    } catch (err) {
      this.showError(this.tableContainer, err.message);
    }
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading user accounts...</p>
      </div>
    `;
  },

  showError(container, message) {
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Failed to load users</h3>
        <p>${this.escapeHtml(message)}</p>
        <button class="btn btn-primary" onclick="users.loadUsers()">Retry</button>
      </div>
    `;
  },

  renderTable(data) {
    const userList = data?.users || [];
    const pagination = data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };

    if (userList.length === 0) {
      this.tableContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>No users found</h3>
          <p>Try adjusting your search query or role filter.</p>
        </div>
      `;
      this.renderPagination(pagination);
      return;
    }

    let rowsHtml = '';
    for (const u of userList) {
      const roleClass = u.role === 'admin' ? 'badge-admin' : 'badge-player';
      const createdStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
      const lastLoginStr = u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never';

      rowsHtml += `
        <tr>
          <td>
            <div class="user-cell">
              <div class="user-avatar">${this.getAvatarLetter(u.name || u.email)}</div>
              <div class="user-info">
                <span class="user-name">${this.escapeHtml(u.name || 'Anonymous Explorer')}</span>
                <span class="user-email">${this.escapeHtml(u.email)}</span>
              </div>
            </div>
          </td>
          <td><span class="role-badge ${roleClass}">${this.escapeHtml(u.role)}</span></td>
          <td><span class="level-badge">Lvl ${u.level || 1}</span></td>
          <td><strong>${(u.score || 0).toLocaleString()}</strong></td>
          <td>${createdStr}</td>
          <td>${lastLoginStr}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="users.openInspectModal('${this.escapeHtml(u.id)}')">
              Inspect
            </button>
          </td>
        </tr>
      `;
    }

    this.tableContainer.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Level</th>
              <th>Score</th>
              <th>Registered</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    this.renderPagination(pagination);
  },

  renderPagination(pagination) {
    if (!this.paginationContainer) return;

    const { page, totalPages, total } = pagination;

    this.paginationContainer.innerHTML = `
      <div class="pagination-info">
        Showing page <strong>${page}</strong> of <strong>${totalPages}</strong> (${total} total accounts)
      </div>
      <div class="pagination-buttons">
        <button class="btn btn-sm btn-outline" ${page <= 1 ? 'disabled' : ''} onclick="users.goToPage(${page - 1})">
          Previous
        </button>
        <button class="btn btn-sm btn-outline" ${page >= totalPages ? 'disabled' : ''} onclick="users.goToPage(${page + 1})">
          Next
        </button>
      </div>
    `;
  },

  goToPage(newPage) {
    this.currentPage = newPage;
    this.loadUsers();
  },

  async openInspectModal(userId) {
    this.activeSelectedUserId = userId;
    const modal = document.getElementById('userDetailModal');
    const content = document.getElementById('userDetailContent');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    content.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading user profile details...</p>
      </div>
    `;

    try {
      const data = await window.api.getUserById(userId);
      this.renderInspectModal(content, data);
    } catch (err) {
      content.innerHTML = `
        <div class="error-state">
          <p>${this.escapeHtml(err.message)}</p>
          <button class="btn btn-sm btn-outline" onclick="users.closeInspectModal()">Close</button>
        </div>
      `;
    }
  },

  renderInspectModal(container, data) {
    const u = data.user || {};
    const p = data.profile || {};
    const questsList = data.quests || [];
    const puzzleAttempts = data.recentPuzzleAttempts || [];
    const cluesList = data.discoveredClues || [];

    const isCurrentAdmin = u.role === 'admin';
    const targetRole = isCurrentAdmin ? 'player' : 'admin';
    const actionText = isCurrentAdmin ? 'Demote to Player' : 'Promote to Administrator';
    const actionClass = isCurrentAdmin ? 'btn-danger' : 'btn-primary';

    container.innerHTML = `
      <!-- User Overview Header -->
      <div class="modal-user-header">
        <div class="user-avatar lg">${this.getAvatarLetter(u.name || u.email)}</div>
        <div class="modal-user-title">
          <h3>${this.escapeHtml(u.name || 'Anonymous')}</h3>
          <p class="text-muted">${this.escapeHtml(u.email)}</p>
          <div class="modal-meta-row">
            <span class="role-badge ${isCurrentAdmin ? 'badge-admin' : 'badge-player'}">${this.escapeHtml(u.role)}</span>
            <span class="meta-tag">ID: ${this.escapeHtml(u.id)}</span>
            <span class="meta-tag">Joined: ${new Date(u.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <!-- Role Management Action Card -->
      <div class="role-management-panel">
        <div>
          <h4>Account Role Status: <span class="capitalize">${this.escapeHtml(u.role)}</span></h4>
          <p class="text-muted small">Administrators have unrestricted access to all player data, system telemetry, and analytics.</p>
        </div>
        <div>
          <button class="btn ${actionClass}" onclick="users.confirmRoleChange('${this.escapeHtml(u.id)}', '${targetRole}')">
            ${actionText}
          </button>
        </div>
      </div>

      <!-- Player Progression Stats -->
      <div class="modal-stats-grid">
        <div class="stat-box">
          <span class="stat-label">Level</span>
          <span class="stat-val">${p.level || 1}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Experience</span>
          <span class="stat-val">${(p.experience || 0).toLocaleString()} XP</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Total Score</span>
          <span class="stat-val">${(p.score || 0).toLocaleString()} pts</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Health Status</span>
          <span class="stat-val">${p.health || 100} / ${p.maxHealth || 100} HP</span>
        </div>
      </div>

      <!-- Tabs or Accordion Content -->
      <div class="modal-section">
        <h4>Quests Active & Completed (${questsList.length})</h4>
        ${questsList.length === 0 ? '<p class="text-muted small">No quest progress recorded yet.</p>' : `
          <ul class="detail-list">
            ${questsList.map(q => `
              <li class="detail-item">
                <div class="item-main">
                  <strong>${this.escapeHtml(q.title)}</strong>
                  <span class="text-muted small">(${this.escapeHtml(q.difficulty)} • ${this.escapeHtml(q.category)})</span>
                </div>
                <div class="item-status">
                  <span class="status-pill status-${q.status}">${this.escapeHtml(q.status)}</span>
                  <span class="small">${q.progress}%</span>
                </div>
              </li>
            `).join('')}
          </ul>
        `}
      </div>

      <div class="modal-section">
        <h4>Recent Puzzle Submissions (${puzzleAttempts.length})</h4>
        ${puzzleAttempts.length === 0 ? '<p class="text-muted small">No puzzle attempts recorded yet.</p>' : `
          <ul class="detail-list">
            ${puzzleAttempts.map(pa => `
              <li class="detail-item">
                <div class="item-main">
                  <strong>Topic: ${this.escapeHtml(pa.topic || 'General')}</strong>
                  <span class="text-muted small">Answer: "${this.escapeHtml(pa.submittedAnswer)}" (${pa.timeTakenSeconds || 0}s)</span>
                </div>
                <div class="item-status">
                  <span class="badge badge-${pa.isCorrect ? 'success' : 'danger'}">
                    ${pa.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                  <span class="small text-muted">+${pa.xpEarned || 0} XP</span>
                </div>
              </li>
            `).join('')}
          </ul>
        `}
      </div>

      <div class="modal-section">
        <h4>Discovered Clues (${cluesList.length})</h4>
        ${cluesList.length === 0 ? '<p class="text-muted small">No clues discovered yet.</p>' : `
          <ul class="detail-list">
            ${cluesList.map(c => `
              <li class="detail-item">
                <span>🔍 ${this.escapeHtml(c.title)}</span>
                <span class="text-muted small">${new Date(c.discoveredAt).toLocaleDateString()}</span>
              </li>
            `).join('')}
          </ul>
        `}
      </div>
    `;
  },

  async confirmRoleChange(userId, newRole) {
    const confirmMessage = newRole === 'admin'
      ? 'Are you sure you want to promote this user to Administrator? They will have full administrative access.'
      : 'Are you sure you want to demote this user to Player? They will immediately lose administrative access.';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await window.api.updateUserRole(userId, newRole);
      window.alert(`Role successfully updated to '${newRole}'.`);
      // Reload modal and user list
      await this.openInspectModal(userId);
      await this.loadUsers();
    } catch (err) {
      if (err.status === 409 || err.code === 'LAST_ADMIN_DEMOTION_FORBIDDEN') {
        window.alert('Action Blocked: Cannot demote the last remaining administrator in the system.');
      } else {
        window.alert(`Role update failed: ${err.message}`);
      }
    }
  },

  closeInspectModal() {
    const modal = document.getElementById('userDetailModal');
    if (modal) modal.classList.add('hidden');
    this.activeSelectedUserId = null;
  },

  getAvatarLetter(str) {
    return str ? str.charAt(0).toUpperCase() : 'U';
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

window.users = users;
