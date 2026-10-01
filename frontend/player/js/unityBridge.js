/**
 * ASCENDRA Unity Engine Real-Time Bridge
 * Receives gameplay milestones and progression events directly from the Unity Game Engine
 * (WebGL canvas iframe or local standalone game) and automatically persists them to the backend,
 * triggering instant live updates in the Hall of Expedition Achievements and Player HUD.
 */

const AscendraUnityBridge = {
  unlockedToastHistory: new Set(),

  init() {
    // Listen for postMessage from WebGL iframe
    window.addEventListener('message', (event) => {
      if (!event.data) return;

      // Direct Ascendra Unity event format
      if (event.data.type === 'ASCENDRA_UNITY_EVENT') {
        this.onUnityEvent(event.data.action, event.data.payload || event.data.data);
      }

      // Handshake from Unity WebGL requesting auth token
      if (event.data.type === 'ASCENDRA_REQUEST_TOKEN') {
        this.sendTokenToUnity();
      }
    });

    console.log('⚔️ [ASCENDRA] Unity Game Bridge initialized.');
  },

  sendTokenToUnity() {
    const iframe = document.getElementById('unityGameIframe');
    const token = window.playerApi?.getToken();
    const apiUrl = window.ASCENDRA_CONFIG?.API_BASE_URL || '/api/v1';
    const fullApiUrl = apiUrl.startsWith('http') ? apiUrl : `${window.location.origin}${apiUrl}`;
    if (iframe && iframe.contentWindow && token) {
      iframe.contentWindow.postMessage({
        type: 'ASCENDRA_SET_TOKEN',
        token: token,
        apiUrl: fullApiUrl
      }, '*');
      console.log('[ASCENDRA] Dispatched active session token and API URL to Unity WebGL frame.');
    }
  },

  /**
   * Primary receiver for Unity Game Engine events
   * @param {string} action - 'QUEST_STARTED' | 'CLUE_DISCOVERED' | 'PUZZLE_SOLVED' | 'QUEST_COMPLETED' | 'SCORE_GAINED'
   * @param {any} payload - questId, clueId, puzzleId, score, etc.
   */
  async onUnityEvent(action, payload) {
    console.log(`🎮 [ASCENDRA UNITY EVENT]: ${action}`, payload);

    if (!window.playerApi || !window.playerApi.isAuthenticated()) {
      console.warn('[ASCENDRA] No active player session; skipping backend persistence');
      return;
    }

    try {
      switch (action) {
        case 'QUEST_STARTED': {
          const questId = typeof payload === 'string' ? payload : (payload?.questId || 'quest_village_basics');
          await window.playerApi.startQuest(questId).catch(err => {
            console.log(`[UnityBridge] Quest start notification: ${err.message}`);
          });
          break;
        }

        case 'CLUE_DISCOVERED': {
          const clueId = typeof payload === 'string' ? payload : (payload?.clueId || 'clue_village_inscription_1');
          
          // Submit verified solution for starter inscription puzzle PZ-001 to unlock the clue
          const attemptRes = await window.playerApi.attemptPuzzle('PZ-001', '36').catch(err => {
            console.log(`[UnityBridge] Puzzle solve attempt info: ${err.message}`);
            return null;
          });

          if (attemptRes?.unlockedClue) {
            this.showAchievementToast(
              '✦ FIRST DISCOVERY',
              `Discovered Inscription: ${attemptRes.unlockedClue.title || 'Village Inscription'}!`
            );
          }
          break;
        }

        case 'PUZZLE_SOLVED': {
          const puzzleId = typeof payload === 'string' ? payload : (payload?.puzzleId || 'PZ-001');
          const answer = (typeof payload === 'object' && payload?.answer) ? payload.answer : '36';

          const attemptRes = await window.playerApi.attemptPuzzle(puzzleId, answer).catch(err => {
            console.log(`[UnityBridge] Dynamic puzzle attempt info: ${err.message}`);
            return null;
          });

          if (attemptRes?.unlockedClue) {
            this.showAchievementToast(
              '✦ FIRST DISCOVERY',
              `Inscription Unlocked: ${attemptRes.unlockedClue.title}!`
            );
          }
          break;
        }

        case 'QUEST_COMPLETED': {
          const questId = typeof payload === 'string' ? payload : (payload?.questId || 'quest_village_basics');
          const res = await window.playerApi.completeQuest(questId).catch(err => {
            console.log(`[UnityBridge] Quest completion note: ${err.message}`);
            return null;
          });

          if (res?.rewards) {
            this.showAchievementToast(
              '✦ VILLAGE AWAKENING',
              `Elder's Quest Completed in Unity! +${res.rewards.xpEarned || 50} XP`
            );
          }
          break;
        }

        default:
          console.log(`[UnityBridge] Unhandled action: ${action}`);
      }

      // Automatically refresh Achievements Hall if active
      if (window.playerAchievements) {
        window.playerAchievements.syncLiveProgress(true);
      }

      // Automatically refresh Hero HUD (Level, Score, XP, Health)
      if (window.playerDashboard && typeof window.playerDashboard.renderHUD === 'function') {
        window.playerDashboard.renderHUD();
      }

      // If Character profile tab is open, update stats
      if (window.playerApp && window.playerApp.currentSection === 'profile') {
        window.playerApp.renderProfile();
      }

      // Dispatch global DOM event for other listeners
      window.dispatchEvent(new CustomEvent('ascendra:unity-event', {
        detail: { action, payload }
      }));

    } catch (err) {
      console.error('[AscendraUnityBridge] Error handling Unity event:', err);
    }
  },

  showAchievementToast(title, subtitle) {
    const key = `${title}::${subtitle}`;
    if (this.unlockedToastHistory.has(key)) return;
    this.unlockedToastHistory.add(key);

    let container = document.getElementById('ascendraToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ascendraToastContainer';
      container.className = 'ascendra-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'ascendra-achievement-toast';
    toast.innerHTML = `
      <div class="toast-rune">🏆</div>
      <div class="toast-body">
        <div class="toast-tag">UNLOCKED IN UNITY GAME</div>
        <strong class="toast-title">${this.escapeHtml(title)}</strong>
        <div class="toast-subtitle">${this.escapeHtml(subtitle)}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
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

// Initialize on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AscendraUnityBridge.init());
} else {
  AscendraUnityBridge.init();
}

window.AscendraUnityBridge = AscendraUnityBridge;
