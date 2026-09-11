# ASCENDRA — Frontend Environment Configuration Guide
Phase 19 Preparation

> [!CAUTION]
> **STRICT SECURITY NOTICE**: Frontend environment variables are public and must never contain secrets. Anything deployed or bundled into browser frontend code can be inspected by users. Never place database passwords, connection strings, Redis credentials, JWT secrets, AI API keys, or private keys in any frontend file.

---

## 1. Architectural Context & Static Hosting Model

ASCENDRA hosts two independent client applications directly via Node.js / Express static file routing:

1. **Player Web Client**: Accessible at `/play/` (served from `frontend/player/`)
2. **Admin Web Client**: Accessible at `/admin/` (served from `frontend/admin/`)

Because both frontends are constructed with modern Vanilla HTML5, CSS3, and JavaScript (ES6 Modules) without a node-based bundler or build step (such as Vite, Webpack, or Next.js), **browser JavaScript cannot directly read `.env` files from the filesystem**.

To maintain a clean separation of concerns, portability between local development and cloud hosting, and compliance with container/CI pipelines, ASCENDRA uses a dual-configuration approach:

- **Runtime Browser Layer**: `config.js` (`window.ASCENDRA_PLAYER_CONFIG` and `window.ASCENDRA_ADMIN_CONFIG`) loaded before API client modules.
- **Environment Reference Layer**: `.env.example` templates and `.env` local files providing standard environment definitions for CI/CD and deployment scripts.

---

## 2. Public vs. Private Variable Matrix

| Variable Name | Layer | Security Classification | Allowed in Frontend? | Purpose |
|---|---|---|---|---|
| `PLAYER_API_BASE_URL` | Player Client | Public | ✅ **YES** | REST endpoint base URL for player gameplay APIs |
| `PLAYER_APP_ENV` | Player Client | Public | ✅ **YES** | Application runtime mode (`development`, `production`, `staging`) |
| `ADMIN_API_BASE_URL` | Admin Console | Public | ✅ **YES** | REST endpoint base URL for administrative APIs |
| `ADMIN_APP_ENV` | Admin Console | Public | ✅ **YES** | Application runtime mode (`development`, `production`, `staging`) |
| `GOOGLE_CLIENT_ID` | Player Client | Public | ✅ **YES** | Public Google OAuth 2.0 Web Client identifier |
| `GOOGLE_CLIENT_SECRET` | Backend Gateway | **CONFIDENTIAL** | ❌ **FORBIDDEN** | Private server secret for Google OAuth authorization |
| `JWT_SECRET` | Backend Gateway | **CONFIDENTIAL** | ❌ **FORBIDDEN** | Key used to sign and verify JWT authentication tokens |
| `DATABASE_URL` | Backend Gateway | **CONFIDENTIAL** | ❌ **FORBIDDEN** | PostgreSQL connection URI including user credentials |
| `REDIS_URL` | Backend Gateway | **CONFIDENTIAL** | ❌ **FORBIDDEN** | Redis cache connection string |
| `GEMINI_API_KEY` | AI Microservice | **CONFIDENTIAL** | ❌ **FORBIDDEN** | Google Gemini LLM API key for puzzle generation |
| `OPENAI_API_KEY` | AI Microservice | **CONFIDENTIAL** | ❌ **FORBIDDEN** | OpenAI API key for puzzle generation |

---

## 3. Player Web Client Configuration

### 3.1 Local Development Values
```bash
# frontend/player/.env (and frontend/player/config.js)
PLAYER_API_BASE_URL=http://localhost:5000/api/v1
PLAYER_APP_ENV=development
GOOGLE_CLIENT_ID=957763188151-3a5dlqjcofh1v4vhjccndrqr8kqh8j7e.apps.googleusercontent.com
```

### 3.2 Production Placeholders
```bash
# frontend/player/.env.example
PLAYER_API_BASE_URL=https://<BACKEND_DOMAIN>/api/v1
PLAYER_APP_ENV=production
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
```

### 3.3 Implementation Details
`frontend/player/config.js` executes immediately upon page load:
```javascript
window.ASCENDRA_PLAYER_CONFIG = Object.freeze({
  API_BASE_URL: window.__ASCENDRA_PLAYER_API_URL__ || '/api/v1',
  APP_ENV: 'development',
  GOOGLE_CLIENT_ID: '957763188151-3a5dlqjcofh1v4vhjccndrqr8kqh8j7e.apps.googleusercontent.com'
});
```
`frontend/player/js/api.js` queries `ASCENDRA_PLAYER_CONFIG.API_BASE_URL`, falling back to the relative `/api/v1` path for same-origin Express static hosting.

---

## 4. Admin Web Client Configuration

### 4.1 Local Development Values
```bash
# frontend/admin/.env (and frontend/admin/config.js)
ADMIN_API_BASE_URL=http://localhost:5000/api/v1
ADMIN_APP_ENV=development
```

### 4.2 Production Placeholders
```bash
# frontend/admin/.env.example
ADMIN_API_BASE_URL=https://<BACKEND_DOMAIN>/api/v1
ADMIN_APP_ENV=production
```

### 4.3 Implementation Details
`frontend/admin/config.js` executes before administrative modules:
```javascript
window.ASCENDRA_ADMIN_CONFIG = Object.freeze({
  API_BASE_URL: window.__ASCENDRA_ADMIN_API_URL__ || '/api/v1',
  APP_ENV: 'development'
});
```
`frontend/admin/js/api.js` automatically consumes `ASCENDRA_ADMIN_CONFIG.API_BASE_URL`.

---

## 5. Deployment & Production Value Injection

When deploying the frontend to production environments (e.g. Firebase Hosting, Cloudflare Pages, S3/CloudFront, or dedicated static servers):

1. **Option A (Reverse Proxy / Same-Origin)**:
   If the frontend is served behind a reverse proxy (e.g. Nginx, Cloudflare) routing `/api/v1` to the backend cluster, leave `API_BASE_URL` as `/api/v1`. This avoids cross-origin requests entirely.

2. **Option B (Separate Domains / Cross-Origin)**:
   If the frontend is hosted on a separate domain (e.g., `https://play.ascendra.game`) and the backend is on `https://api.ascendra.game`:
   - Supply `PLAYER_API_BASE_URL=https://api.ascendra.game/api/v1`
   - Ensure the Express backend's `FRONTEND_URL` environment variable permits this origin in CORS settings.

3. **Runtime Injection via CI/CD**:
   During the release pipeline, deployment scripts can generate or substitute `config.js`:
   ```bash
   sed -i "s|/api/v1|https://${BACKEND_DOMAIN}/api/v1|g" frontend/player/config.js
   sed -i "s|/api/v1|https://${BACKEND_DOMAIN}/api/v1|g" frontend/admin/config.js
   ```

---

## 6. Verification and Security Validation Commands

```bash
# 1. Run repository secrets scanner (verifies 0 exposed credentials)
node scripts/check-secrets.js

# 2. Run backend test suite (includes static route tests and auth checks)
cd backend && npm test

# 3. Run AI service test suite
cd ai-service && pytest

# 4. Verify Unity files remain untouched
git status --short Assets/ ProjectSettings/ Packages/
```
