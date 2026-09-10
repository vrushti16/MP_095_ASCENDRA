# ASCENDRA — DevOps & Engineering Workflow Guide

This document outlines the standard engineering workflow, continuous integration (CI) pipeline, branching strategy, testing protocols, and secret security policies for the **ASCENDRA** project.

---

## 1. Branching Strategy

ASCENDRA uses a structured Git feature-branch workflow:

* **`main`**: Production-ready code. Directly protected. All code merged into `main` must pass all CI checks and code reviews.
* **`develop`**: Integration branch for upcoming releases.
* **`feature/<name>`**: New features, e.g., `feature/admin-dashboard`, `feature/quest-clues`.
* **`fix/<issue>`**: Bug fixes, e.g., `fix/jwt-expiration`.
* **`test/<scope>`**: Test suite additions, e.g., `test/e2e-game-flow`.

### Commit Convention
Use conventional commits:
* `feat(...)`: A new feature
* `fix(...)`: A bug fix
* `test(...)`: Adding or correcting tests
* `docs(...)`: Documentation changes
* `chore(...)`: Maintenance or configuration

---

## 2. Environment Variables & Secrets Management

ASCENDRA strictly enforces **Zero Hardcoded Secrets**:

1. **Root `.env.example`**: Documents every configuration variable across all services. Always keep this file up to date with placeholders only.
2. **Local Development**:
   * Node.js backend: Copy `.env.example` to `backend/.env`.
   * FastAPI AI service: Copy `ai-service/.env.example` to `ai-service/.env`.
3. **Repository Protection**:
   * Root `.gitignore` ignores all `.env` files (`.env`, `.env.*`, `backend/.env`, `ai-service/.env`), except explicit `.env.example` templates.
   * `scripts/check-secrets.js` runs automatically on CI to block accidental commits of OpenAI keys (`sk-...`), Gemini keys (`AIza...`), private keys, or cleartext database passwords.

---

## 3. Local Development & Testing

Developers must verify their changes locally prior to pushing code to GitHub.

### Secret Check
```bash
node scripts/check-secrets.js
```

### Backend (Node.js 20+)
```bash
cd backend
npm install
npm test
```
* Runs Jest unit and integration tests across auth, quests, puzzles, clues, and AI validation.

### AI Service (Python 3.11)
```bash
cd ai-service
pip install -r requirements.txt
pytest
```
* Runs pytest validating puzzle generators, fallback catalogs, and schema validation.

---

## 4. Continuous Integration (GitHub Actions)

Workflow file: `.github/workflows/ci.yml`

The CI pipeline runs automatically on:
* Any push to `main` or `develop`
* Any Pull Request targeting `main` or `develop`

### CI Pipeline Jobs (Native GitHub Runners — No Docker):
1. **`secret-scan`**: Runs `scripts/check-secrets.js` to verify zero credential exposure.
2. **`backend-ci`**: Sets up Node.js 20.x, installs dependencies with `npm ci`, and executes the 110+ Jest test suite.
3. **`ai-service-ci`**: Sets up Python 3.11, installs requirements, and executes the Pytest test suite.

---

## 5. Pull Request & Merge Workflow

1. Create a branch from `develop` or `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make minimal, focused commits.
3. Run local tests:
   ```bash
   node scripts/check-secrets.js
   cd backend && npm test
   cd ../ai-service && pytest
   ```
4. Push your branch and open a Pull Request against `develop` or `main`.
5. Verify that all GitHub Actions jobs pass (green checkmarks).
6. Request review from teammates before merging.

---

## 6. Redis Caching & System Health Observability

### Architecture
ASCENDRA utilizes Redis as a high-performance, non-blocking caching layer:
* **Primary Authoritative Store**: PostgreSQL (Neon in production).
* **Caching Layer**: Redis (`redis` client v6.x, connection URL specified via `REDIS_URL`).
* **Cached Entities**: Static and catalog data (e.g. `quests:catalog:public`, 300s TTL). Sensitive authentication tokens and user passwords are **strictly excluded** from caching.

### Resilience & Failure Fallback
Redis is an **optimization**, not a single point of failure:
* If Redis is available: Keys are stored and retrieved with automatic TTL expiration.
* If Redis becomes unreachable or times out: The backend logs a throttled warning, switches to `cache_bypass` mode, and queries PostgreSQL directly without throwing errors or crashing.
* When Redis reconnects: The client automatically recovers without requiring an application restart.

### Multi-Service System Health Check
The backend provides both lightweight and deep diagnostic health endpoints:
* **Lightweight Probe (`GET /api/v1/health`)**: Returns status, uptime, environment, and version (ideal for load balancers / cloud platform keep-alive pings).
* **Detailed Probe (`GET /api/v1/health?detailed=true`)**: Concurrently polls and measures response latency for:
  - **Node.js Runtime**: Process uptime, heap and RSS memory usage, version.
  - **PostgreSQL**: Connectivity verification and round-trip query latency.
  - **Redis**: Connection state, ping latency, and fallback state (`none` vs `cache_bypass`).
  - **FastAPI AI Service**: HTTP ping probe to `${AI_SERVICE_URL}/api/v1/health` measuring microservice latency.
* **Status Semantics**:
  - `healthy` (HTTP 200): All services operational.
  - `degraded` (HTTP 200): Core game and PostgreSQL operational; Redis or FastAPI degraded/unavailable (fallbacks active).
  - `unhealthy` (HTTP 503): PostgreSQL is offline.

---

## 7. Troubleshooting Common Issues

| Problem | Cause | Solution |
|---|---|---|
| **Secret Scan Fails in CI** | A private key, API token, or real password was detected in code. | Inspect the CI log, remove the credential from the file, reference `process.env` or `os.environ` instead, and re-commit. |
| **Backend Tests Timeout** | Missing database mock or open network handle. | Ensure tests use Jest `--detectOpenHandles --forceExit` and properly mock external network calls. |
| **FastAPI `ModuleNotFoundError`** | Python environment path mismatch. | Ensure `pytest` is run inside `ai-service/` or `PYTHONPATH=. pytest` is used. |
| **Untracked `__pycache__`** | Git cache still tracking deleted pyc files. | Run `git rm -r --cached ai-service/**/__pycache__` to clear tracked bytecode. |
| **Redis Offline Locally** | Local Redis daemon is not running on port 6379. | No action required for standard development; the backend will automatically run in `cache_bypass` mode. To run locally: `redis-server` or configure cloud Upstash URL in `.env`. |

