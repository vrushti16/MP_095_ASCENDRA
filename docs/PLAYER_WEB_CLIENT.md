# ASCENDRA — Player Web Client & Unity WebGL Hosting Shell

This document details the architecture, design specifications, API integrations, and operator workflows for the **ASCENDRA Player Web Client** implemented in Phase 17.

---

## 1. Architectural Overview & System Separation

ASCENDRA provides two completely independent, visually and functionally separated web frontends:

```text
                                ASCENDRA PLATFORM
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
       PLAYER WEB CLIENT                              ADMIN CONSOLE
            (/play/)                                     (/admin/)
                 │                                             │
      ⚔️ Cinematic Fantasy RPG                        🛡️ Modern Light SaaS
      • Canvas: #090d16 (Midnight Navy)             • Canvas: #f8fafc (Light Canvas)
      • Cards: #16223b (Deep Slate)                 • Cards: #ffffff (Pure White)
      • Accents: #38bdf8 (Glowing Cyan)             • Primary: #4f46e5 (Indigo)
      • Relics: #f59e0b (Ancient Gold)              • Tables, KPIs, Telemetry
                 │                                             │
      🏰 Player Experience                           📊 Operational Console
      • Gaming Splash Screen                        • Platform Overview
      • Player Hub & Hero Card                      • User Audits & Role RBAC
      • Adventure WebGL Shell                       • Curriculum Analytics
      • Inventory & Relic Vault                     • Multi-Service Health Probes
      • Archaeological Clue Journal                 • AI Telemetry Event Logs
      • Achievement Hall Shell                                 │
      • Character Profile Panel                                │
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        ▼
                           Authoritative Backend APIs
                                  (/api/v1/*)
                               Node.js / Express
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
          PostgreSQL / Neon        Redis Cache             FastAPI AI
```

---

## 2. Critical Unity World Protection Compliance

The existing Unity adventure game world, village environment, terrains, scenes, and character controllers are **strictly locked and protected**:
* **Zero Unity Files Modified**: `Assets/`, `ProjectSettings/`, and `Packages/` were completely untouched in Phase 17 (`0` Unity files modified).
* **Protected Assets**:
  * `Assets/Scenes/Gameplay/Stage_1_1_Village.unity`
  * `Assets/Scenes/SampleScene.unity`
  * `Assets/PlayerMovement.cs`
  * `Assets/RPGPP_LT/`
  * `Assets/miximo/`
* **WebGL Hosting Shell**: Phase 17 provides the web-side container ready to embed the existing Unity game once exported to WebGL in Developer A / CI workflow.

---

## 3. Directory Structure

```text
frontend/
├── admin/                     # PHASE 16 ADMIN CONSOLE (UNTOUCHED)
│   ├── index.html
│   ├── css/admin.css
│   └── js/ (api, auth, dashboard, users, analytics, health, app)
│
└── player/                    # PHASE 17 PLAYER GAMING CLIENT
    ├── index.html             # Semantic HTML5 markup, HUD, Splash, WebGL Shell
    ├── css/
    │   ├── player.css         # Cinematic fantasy RPG theme, glow, rune accents
    │   └── responsive.css     # Breakpoints for Desktop, Tablet, and Mobile
    └── js/
        ├── api.js             # Player API Client (Auth, Profile, Quests, Clues, Puzzles)
        ├── auth.js            # Sign In / Register controller with session storage
        ├── splash.js          # Gaming Splash with real initialization progress
        ├── dashboard.js       # Action-oriented Player Hub with "Continue Adventure" CTA
        ├── adventure.js       # Adventure view & Unity WebGL hosting container
        ├── inventory.js       # Relic Vault shell backed by authoritative clues
        ├── clues.js           # Archaeological discovery journal
        ├── achievements.js    # Visual progression milestone hall shell
        └── app.js             # Main player app router and HUD coordinator
```

---

## 4. Modules & User Flows

### 4.1 Gaming Splash Screen
* Fullscreen fantasy environment with ambient floating embers.
* **Realistic Initialization Stages**:
  * `20%`: Initializing Realm Interfaces (DOM & styling)
  * `45%`: Verifying Explorer Credentials (checks `sessionStorage`)
  * `70%`: Attuning Explorer Profile (`GET /api/v1/users/me/profile`)
  * `90%`: Loading Quest Log & Relics (`GET /api/v1/quests`)
  * `100%`: World Ready. Unlocks **"ENTER ASCENDRA"** (for guests) or **"CONTINUE ADVENTURE"** (for authenticated players).

### 4.2 Authentication Entry
* Tabbed Sign In / Register dialog with validation feedback.
* **Google OAuth**: Hooked to trigger `POST /api/v1/auth/google` with Google ID token.
* **Token Handling**: Stores `accessToken` and `refreshToken` in tab-scoped `sessionStorage` (`ascendra_player_token`).
* **Auto-Refresh**: API client automatically attempts token refresh using `POST /api/v1/auth/refresh` upon encountering `401 Unauthorized`.

### 4.3 Player Dashboard (The Adventure Hub)
* Answers the question: *"What should I do next?"*
* **Dominant Primary Call-to-Action**: Hero Card for the active quest with real objective progress percentage, difficulty badge, and a prominent **`⚔️ CONTINUE ADVENTURE`** button that routes directly to the Adventure View.
* **Progression Meters**:
  * Level Chip (`LVL 4`)
  * Experience Meter (`4,820 XP / 5,000 XP`)
  * Expedition Vitality (`❤️ 100 / 100 HP`)
  * Score Points (`3,200 pts`)
* **Recent Discoveries Strip**: Direct previews of unlocked archaeological clues.

### 4.4 Adventure View & Unity WebGL Hosting Shell
* Web-side container designed to host the existing Unity WebGL game:
  ```text
  ┌──────────────────────────────────────────────────┐
  │ ASCENDRA                         ← RETURN TO HUB │
  ├──────────────────────────────────────────────────┤
  │                                                  │
  │            ASCENDRA — ADVENTURE WORLD            │
  │                                                  │
  │        Existing Unity WebGL game will            │
  │        load here                                 │
  │                                                  │
  │             [ WEBGL BUILD PENDING ]              │
  │                                                  │
  ├──────────────────────────────────────────────────┤
  │ CURRENT EXPEDITION OBJECTIVE                     │
  │ Secrets of the Cipher Crypt                      │
  │ Progress: ████████████░░ 65%                     │
  └──────────────────────────────────────────────────┘
  ```
* Seamlessly mounts the Unity WebGL canvas when compiled to `frontend/player/unity/`.
* Displays current quest objective, progress percentage, and controls to embark or interact.
* Supports Fullscreen mode (`⛶ Fullscreen`).

### 4.5 Relic Vault / Inventory Shell
* Displays unearthed relics derived exclusively from verified discovered clues (`GET /api/v1/clues`).
* **Data Integrity Rule**: Does not invent fake persistent inventory items or fake inventory APIs.
* Unoccupied slots render clean empty socket rings.
* Interactive **Relic Inspector** examines selected relics, showing ancient inscriptions, quest origin, and discovery timestamps.

### 4.6 Clue Journal
* Chronological archaeological logbook of unlocked clues.
* Parchment card styling with sequence numbers (`#1`, `#2`), origin quest badges, transcribed contents, and verified inscription seals.

### 4.7 Achievement Hall Shell
* Visual progression milestone presentation layer reflecting live level, score, and discovery counts:
  * `✦ FIRST DISCOVERY`: Unlocked upon discovering first clue.
  * `✦ CRYPT EXPLORER`: Unlocked upon completing first quest.
  * `✦ CIPHER ADEPT`: Unlocked upon reaching Level 3.
  * `✦ EXPEDITION VETERAN`: Unlocked upon reaching 2,500 score points.
  * `🔒 MYSTERY OF THE ANCIENTS`: Locked milestone for future exploration.
* **Architecture Notice**: Explicitly documented and displayed as a visual milestone shell, not a persistent backend database.

### 4.8 Character Profile Panel
* Identity management allowing players to update their explorer call-sign (`PATCH /api/v1/users/me/profile`).
* Displays account authority (`PLAYER`), join date, level, and cumulative experience.

---

## 5. Security & Isolation

1. **Strict Admin Isolation**:
   * Admin dashboard remains at `/admin/`, loading only `frontend/admin/*` assets.
   * Player client operates at `/play/`, loading only `frontend/player/*` assets.
   * Player tokens (`ascendra_player_token`) and admin tokens (`ascendra_admin_token`) are strictly isolated in `sessionStorage`.
2. **Zero Hardcoded Secrets**: Verified with `scripts/check-secrets.js` (0 secrets detected).
3. **XSS Mitigation**: All server data (names, emails, titles, contents) is safely escaped via `escapeHtml()` or inserted via `textContent`.
4. **Server-Authoritative Progression**: Levels, XP awards, quest completions, and puzzle scores are computed exclusively by PostgreSQL database triggers and backend services.

---

## 6. Verification Commands

```bash
# Run backend test suite including playerClient.test.js (163/163 passing)
cd backend && npm test

# Run AI service test suite (12/12 passing)
cd ../ai-service && pytest

# Run repository secret scanner (0 secrets detected)
cd .. && node scripts/check-secrets.js

# Verify Unity files remain untouched
git status Assets/ ProjectSettings/
```
