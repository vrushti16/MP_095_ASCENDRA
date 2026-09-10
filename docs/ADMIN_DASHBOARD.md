# ASCENDRA — Light-Theme Admin Dashboard Guide

This document details the architecture, setup, operator workflows, and security specifications for the **ASCENDRA Light-Theme Admin Dashboard** implemented in Phase 16.

---

## 1. Overview & Architecture

The ASCENDRA Admin Dashboard is a lightweight, responsive, single-page administrative console built with **HTML5, CSS3, and Vanilla JavaScript**. It consumes the Phase 15 Admin REST APIs mounted at `/api/v1/admin/*`.

```text
Admin Browser (Desktop / Tablet / Mobile)
      ↓
Static Admin Dashboard (/admin/)
HTML5 + CSS3 + Vanilla JavaScript
      ↓
JWT Bearer Authentication
      ↓
Express Gateway (Node.js)
      ↓
/api/v1/admin/* Routes & RBAC Middleware
      ↓
PostgreSQL / Neon  |  Redis Cache  |  FastAPI AI Microservice
```

### Key Technical Characteristics
* **Zero Heavy Frontend Frameworks**: Pure standard browser primitives (Fetch API, DOM APIs, CSS Grid/Flexbox).
* **Strict Light Theme Only**: Modern light color scheme with `#f8fafc` canvas, `#ffffff` cards, and `#4f46e5` primary accents. No dark mode or dark styling.
* **Direct Backend Static Hosting**: Served directly by Express at `/admin/` via `express.static('frontend/admin')`.
* **Zero Secret Exposure**: Tokens are handled in ephemeral `sessionStorage`. Server secrets, database URLs, and API keys are strictly forbidden in client scripts.

---

## 2. Directory Structure

```text
frontend/
└── admin/
    ├── index.html        # Semantic HTML5 markup, header, sidebar, panels, modals
    ├── css/
    │   └── admin.css     # Responsive styles, strict light-theme tokens, layout
    └── js/
        ├── api.js        # Centralized ApiClient with auth header injection & 401/403 dispatch
        ├── auth.js       # Admin authentication handler, login modal, session persistence
        ├── dashboard.js  # Overview KPI metrics & platform infrastructure quick strip
        ├── users.js      # User management, search debounce, role filter, pagination, inspect modal
        ├── analytics.js  # Quest completion rates, puzzle accuracy, topic breakdown, leaderboard
        ├── health.js     # Multi-service health diagnostics & AI prompt generation telemetry
        └── app.js        # Application controller, tab routing, refresh triggers, mobile drawer
```

---

## 3. Design System & Theme Specification

The dashboard strictly adheres to the Phase 16 light-theme color palette:

| Token | Hex Value | Usage |
|---|---|---|
| Canvas Background | `#f8fafc` | Page body and content canvas |
| Card Background | `#ffffff` | KPI cards, data tables, modal dialogs |
| Primary Accent | `#4f46e5` | Active nav items, primary buttons, progress bars |
| Success | `#10b981` | Positive indicators, high accuracy, healthy states |
| Warning | `#f59e0b` | Degraded service alerts, validation warnings |
| Danger | `#ef4444` | Errors, offline services, demotion actions |
| Primary Text | `#1e293b` | Headings, high-contrast values, table headers |
| Secondary Text | `#64748b` | Descriptions, metadata, timestamps |
| Border | `#e2e8f0` | Dividers, card borders, table cell lines |

---

## 4. Setup & Running Locally

### 4.1 Prerequisites
1. Node.js v20.x
2. PostgreSQL (or configured Neon connection in `.env`)
3. Redis (optional; falls back gracefully to in-memory bypass)
4. Python 3.11 with FastAPI AI microservice (optional; falls back to dev catalog)

### 4.2 Start Backend Server
```bash
cd backend
npm start
# Server listens on port 5000 by default
```

### 4.3 Access the Admin Dashboard
Open a Chromium-based browser to:
```text
http://localhost:5000/admin/
```

---

## 5. Authentication & Operator Workflow

### 5.1 Admin Sign-In
1. Navigate to `http://localhost:5000/admin/`.
2. If no valid admin token exists in `sessionStorage`, the **Sign In to Dashboard** dialog appears.
3. Enter administrator credentials:
   * **Email**: Admin user email (e.g., `admin@ascendra.edu`)
   * **Password**: User password
4. The client executes `POST /api/v1/auth/login`.
5. If the user possesses the `admin` role, the access token is saved in `sessionStorage` and the dashboard view unlocks.
6. If the user possesses the `player` role, access is rejected with a `403 Forbidden` alert.

### 5.2 Navigation & Modules

#### 1. Dashboard (Platform Overview)
* **Endpoint**: `GET /api/v1/admin/overview`
* **Features**:
  * Infrastructure status quick strip (PostgreSQL, Redis, FastAPI).
  * KPI cards: Total Registered Users (Player/Admin breakdown), Active Sessions, Quest Engagements, Puzzle Accuracy Rate, Average Explorer Level, and Average Player Score.

#### 2. Users Management
* **Endpoints**:
  * `GET /api/v1/admin/users?page=1&limit=15&search=&role=`
  * `GET /api/v1/admin/users/:id`
  * `PATCH /api/v1/admin/users/:id/role`
* **Features**:
  * Debounced search (350ms delay) searching by name or email.
  * Role filter dropdown (`All`, `Players`, `Administrators`).
  * Server-side pagination with previous/next controls.
  * Deep inspection modal displaying progression stats, active/completed quests, puzzle attempts, and discovered clues.
  * Role promotion/demotion actions with confirmation prompts.
  * **Last-Admin Safeguard**: If an admin attempts to demote the sole remaining administrator, the backend returns `409 Conflict` (`LAST_ADMIN_DEMOTION_FORBIDDEN`), and the UI alerts the user without breaking state.

#### 3. Game Analytics
* **Endpoint**: `GET /api/v1/admin/game/analytics`
* **Features**:
  * Overall quest completion rate meter.
  * Aggregate puzzle accuracy percentage.
  * Average solve time per educational puzzle.
  * Topic accuracy breakdown across curriculum domains (Aptitude, Logical Reasoning, Mathematics, Cloud Computing, Cyber Security, etc.).
  * Top player leaderboard ranked by cumulative XP/score.
  * Explorer level distribution spread.

#### 4. AI & System Health
* **Endpoints**:
  * `GET /api/v1/admin/system/health`
  * `GET /api/v1/admin/ai/telemetry`
* **Features**:
  * High-visibility system status banner (`Healthy`, `Degraded`, `Unavailable`).
  * Multi-service cards for Node.js Express runtime, PostgreSQL / Neon, Redis Cache, and FastAPI AI Microservice.
  * AI generation metrics: Total requests, valid generation pass rate, anti-cheat validation failures, and average LLM round-trip latency.
  * Live event table showing recent AI puzzle generation prompts, topics, latencies, and fallback indicators.

---

## 6. Security Considerations

1. **Authorization Authority**: Frontend role checks exist solely for UX routing. Every request sends `Authorization: Bearer <token>`, and the backend is the sole authority enforcing RBAC via `requireRole('admin')`.
2. **Session Storage Isolation**: Tokens and cached user info are stored exclusively in `sessionStorage` (tab-scoped and cleared on tab closure).
3. **Cross-Site Scripting (XSS) Mitigation**: All dynamic user-supplied strings (names, emails, topic slugs, submitted answers, and puzzle prompts) are HTML-escaped using `escapeHtml()` or inserted via `textContent`.
4. **Secret Scanning**: Tested against 190+ tracked files with `node scripts/check-secrets.js` to ensure zero exposed credentials.
5. **Sanitized Error Messaging**: Stack traces, SQL diagnostics, and connection URIs are stripped from API error handlers and never displayed in dashboard error states.

---

## 7. Troubleshooting & Verification

### Common Scenarios

| Issue | Cause | Resolution |
|---|---|---|
| `401 Unauthorized` | Expired or missing JWT token | Session clears automatically and returns to the sign-in screen. Sign in again. |
| `403 Forbidden` | Authenticated user has `player` role | Log in with an account having `admin` role privileges. |
| `409 Conflict` | Attempted to demote the last remaining admin | Backend blocks the demotion to prevent lockout. Promote another admin first before demoting. |
| Redis shows `unavailable` | Local Redis service is not running | Normal behavior; backend gracefully switches to cache-bypass mode without crashing. |
| FastAPI shows `unavailable` | Python AI service is stopped | Backend falls back to the deterministic developer puzzle catalog. |

### Verification Commands
```bash
# Run backend tests including dashboard static route tests (156/156)
cd backend && npm test

# Run AI service test suite (12/12)
cd ../ai-service && pytest

# Run repository secret scanner (0 secrets detected)
cd .. && node scripts/check-secrets.js
```
