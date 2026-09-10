/**
 * ASCENDRA Player Clue Journal Module
 * Renders the archaeological expedition logbook of unlocked clues, glyph records,
 * and decrypted texts discovered across game world quests.
 */

const playerClues = {
  async render(highlightClueId = null) {
    const container = document.getElementById('cluesContent');
    if (!container) return;

    this.showLoading(container);

    try {
      const clues = await window.playerApi.getClues();
      this.renderJournal(container, clues, highlightClueId);
    } catch (err) {
      this.showError(container, err.message);
    }
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="player-loading-state">
        <div class="player-spinner"></div>
        <p>Unrolling expedition parchment journal...</p>
      </div>
    `;
  },

  showError(container, message) {
    container.innerHTML = `
      <div class="player-error-state">
        <div class="error-rune">⚠️</div>
        <h3>Journal currently unreadable</h3>
        <p>${this.escapeHtml(message)}</p>
        <button class="game-btn game-btn-primary" onclick="playerClues.render()">Retry</button>
      </div>
    `;
  },

  renderJournal(container, cluesList, highlightClueId) {
    const clues = cluesList || [];

    container.innerHTML = `
      <div class="journal-header-row">
        <div>
          <h2>ARCHAEOLOGICAL DISCOVERY JOURNAL</h2>
          <p class="panel-subtitle">Authoritative transcripts of deciphered runes, ancient scripts, and hidden lore.</p>
        </div>
        <div class="journal-count-pill">
          📖 ${clues.length} Inscriptions Logged
        </div>
      </div>

      ${clues.length === 0 ? `
        <div class="empty-journal-state">
          <div class="empty-journal-icon">📜</div>
          <h3>The Journal Pages are Blank</h3>
          <p>No ancient markings or hidden clues have been discovered yet.</p>
          <p class="empty-subtext">Embark on quests in the adventure world to investigate ruins and decipher inscriptions.</p>
          <button class="game-btn game-btn-primary" onclick="playerApp.navigateTo('adventure')">Seek Your First Clue</button>
        </div>
      ` : `
        <div class="journal-entries-list">
          ${clues.map(c => {
            const isHighlighted = c.id === highlightClueId;
            const discoveredStr = c.discoveredAt ? new Date(c.discoveredAt).toLocaleDateString() : 'Discovered in field';

            return `
              <article class="journal-entry-card ${isHighlighted ? 'highlighted' : ''}" id="clue-entry-${this.escapeHtml(c.id)}">
                <div class="entry-spine">
                  <span class="entry-rune">✦</span>
                  <span class="entry-seq">#${c.sequenceNumber || 1}</span>
                </div>

                <div class="entry-body">
                  <div class="entry-header">
                    <div>
                      <h3 class="entry-title">${this.escapeHtml(c.title)}</h3>
                      <span class="entry-quest-source">Origin Quest: <strong>${this.escapeHtml(c.questTitle || 'Expedition Unknown')}</strong></span>
                    </div>
                    <span class="entry-date">${discoveredStr}</span>
                  </div>

                  <div class="entry-parchment-content">
                    <p>${this.escapeHtml(c.content)}</p>
                  </div>

                  <div class="entry-footer">
                    <span class="entry-tag verified">✓ Legitimate Inscription</span>
                    <span class="entry-id-code">Ref: ${this.escapeHtml(c.id.slice(0, 8))}</span>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      `}
    `;

    if (highlightClueId) {
      setTimeout(() => {
        const el = document.getElementById(`clue-entry-${highlightClueId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
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

window.playerClues = playerClues;
