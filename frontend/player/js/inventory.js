/**
 * ASCENDRA Player Inventory & Relic Vault Module
 * Renders archaeological artifacts and discovered relics derived exclusively from
 * authoritative clue records. Displays honest empty states without fake persistent items.
 */

const playerInventory = {
  selectedRelic: null,

  async render() {
    const container = document.getElementById('inventoryContent');
    if (!container) return;

    this.showLoading(container);

    try {
      const clues = await window.playerApi.getClues();
      this.renderInventory(container, clues);
    } catch (err) {
      this.showError(container, err.message);
    }
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="player-loading-state">
        <div class="player-spinner"></div>
        <p>Accessing expedition relic vault...</p>
      </div>
    `;
  },

  showError(container, message) {
    container.innerHTML = `
      <div class="player-error-state">
        <div class="error-rune">⚠️</div>
        <h3>Relic vault currently inaccessible</h3>
        <p>${this.escapeHtml(message)}</p>
        <button class="game-btn game-btn-primary" onclick="playerInventory.render()">Retry</button>
      </div>
    `;
  },

  renderInventory(container, cluesList) {
    const relics = cluesList || [];
    const totalSlots = Math.max(16, Math.ceil((relics.length + 4) / 4) * 4);

    container.innerHTML = `
      <div class="inventory-layout">
        <!-- Main Inventory Grid Area -->
        <div class="inventory-main-panel">
          <div class="panel-header-row">
            <div>
              <h3>EXPEDITION RELIC VAULT</h3>
              <p class="panel-subtitle">Unearthed archaeological fragments, ancient scripts, and mystery tokens.</p>
            </div>
            <div class="inventory-counter">
              <span>${relics.length} Relics Unlocked</span>
            </div>
          </div>

          ${relics.length === 0 ? `
            <div class="empty-relic-vault">
              <div class="empty-relic-icon">🗝️</div>
              <h4>YOUR RELIC VAULT</h4>
              <p>No relics or discoverable artifacts have been recorded yet.</p>
              <p class="empty-subtext">Explore the adventure world and interact with ancient mechanisms to unearth them.</p>
              <button class="game-btn game-btn-primary" onclick="playerApp.navigateTo('adventure')">Enter Adventure World</button>
            </div>
          ` : `
            <div class="inventory-grid">
              ${Array.from({ length: totalSlots }).map((_, idx) => {
                const relic = relics[idx];
                if (relic) {
                  return `
                    <div class="inventory-slot occupied" onclick="playerInventory.selectRelic('${this.escapeHtml(relic.id)}')">
                      <div class="slot-icon">🔮</div>
                      <span class="slot-name">${this.escapeHtml(relic.title)}</span>
                    </div>
                  `;
                } else {
                  return `
                    <div class="inventory-slot empty">
                      <div class="slot-empty-ring"></div>
                    </div>
                  `;
                }
              }).join('')}
            </div>
          `}
        </div>

        <!-- Right Side Relic Inspector Drawer -->
        <div id="relicInspectorPanel" class="relic-inspector-panel">
          ${relics.length > 0 && relics[0] ? this.getInspectorHtml(relics[0]) : `
            <div class="empty-inspector">
              <div class="inspector-rune">🔍</div>
              <h4>Relic Inspector</h4>
              <p>Select any unearthed relic from your vault to examine its ancient inscriptions.</p>
            </div>
          `}
        </div>
      </div>
    `;
  },

  async selectRelic(relicId) {
    const inspector = document.getElementById('relicInspectorPanel');
    if (!inspector) return;

    try {
      const relic = await window.playerApi.getClueDetails(relicId);
      inspector.innerHTML = this.getInspectorHtml(relic);
    } catch (err) {
      inspector.innerHTML = `<p class="text-danger">Unable to examine relic: ${this.escapeHtml(err.message)}</p>`;
    }
  },

  getInspectorHtml(relic) {
    const discoveredStr = relic.discoveredAt ? new Date(relic.discoveredAt).toLocaleDateString() : 'Discovered in field';

    return `
      <div class="inspector-card">
        <div class="inspector-badge">RELIC ARTIFACT</div>
        <div class="inspector-icon">📜</div>
        <h3 class="inspector-title">${this.escapeHtml(relic.title)}</h3>
        <span class="inspector-quest-tag">Origin: ${this.escapeHtml(relic.questTitle || 'Forgotten Expedition')}</span>

        <div class="inspector-parchment">
          <div class="parchment-quote">“</div>
          <p class="parchment-text">${this.escapeHtml(relic.content)}</p>
        </div>

        <div class="inspector-meta-list">
          <div class="meta-row">
            <span>Sequence:</span>
            <strong>#${relic.sequenceNumber || 1}</strong>
          </div>
          <div class="meta-row">
            <span>Unearthed:</span>
            <strong>${discoveredStr}</strong>
          </div>
          <div class="meta-row">
            <span>Classification:</span>
            <strong class="text-cyan">Ancient Script</strong>
          </div>
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

window.playerInventory = playerInventory;
