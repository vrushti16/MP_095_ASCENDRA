<div align="center">

# ⚔️ ASCENDRA
### AI-Powered Educational RPG Platform & Authoritative Game Backend

[![CI Pipeline](https://github.com/vrushti16/MP_095_ASCENDRA/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vrushti16/MP_095_ASCENDRA/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/vrushti16/MP_095_ASCENDRA?color=blue&label=release)](https://github.com/vrushti16/MP_095_ASCENDRA/releases)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=nodedotjs)](https://nodejs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis)](https://redis.io)
[![Unity](https://img.shields.io/badge/Unity-2022.3_LTS-000000?logo=unity)](https://unity.com)

<p align="center">
  <b>ASCENDRA</b> is a modern educational adventure RPG platform that transforms professional curriculum mastery into an engaging 3D fantasy world exploration. Players uncover ancient lore, complete quests, and advance character progression by solving procedural, domain-specific AI challenges.
</p>

</div>

---

## 📑 Table of Contents
- [Project Overview](#-project-overview)
- [System Architecture](#-system-architecture)
- [Core Features](#-core-features)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Database Migration & Seeding](#3-database-migration--seeding)
  - [4. Starting the Services](#4-starting-the-services)
- [Web Portals & Endpoints](#-web-portals--endpoints)
- [Testing & Quality Verification](#-testing--quality-verification)
- [Security & Anti-Cheat Guarantees](#-security--anti-cheat-guarantees)
- [Documentation Index](#-documentation-index)
- [License](#-license)

---

## 🌟 Project Overview

Unlike conventional educational platforms that rely on repetitive multiple-choice quizzes or coding syntax exercises, **ASCENDRA** offers:

1. **Rich Multi-Domain Curriculum**: AI-crafted challenges across 15+ professional disciplines including Aptitude, Artificial Intelligence, Cybersecurity, Cloud Computing, Data Science, Logical Reasoning, Critical Thinking, and Communication Skills.
2. **Strict Non-Coding Policy**: Educational challenges emphasize conceptual mastery, architecture trade-offs, and critical decision-making rather than programming trivia or debugging snippets.
3. **Multi-Modal Puzzle Formats**: Puzzles include step sequences, scenario decisions, concept matching, chronological sorting, and relational deductions.
4. **Authoritative Anti-Cheat Game Engine**: Client attempts to tamper with XP rewards, skip intermediate quest objectives, or forge completed statuses are detected and rejected server-side.
5. **Decoupled 3D & Web Presentation**: Unity 3D engine world builds seamlessly into a WebGL shell served alongside dedicated player and administrative interfaces.

---

## 🏛️ System Architecture

```text
                                  ASCENDRA PLATFORM
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
         PLAYER WEB CLIENT                                  ADMIN CONSOLE
        (http://localhost:5000/play)                      (http://localhost:5000/admin)
                  │                                               │
       ⚔️ Cinematic Fantasy RPG UI                      🛡️ Modern Operational SaaS
       • Hero Card & Live HUD                            • System KPIs & Metrics
       • Unity WebGL Game Shell                          • User Audits & Role RBAC
       • Clue Journal & Relic Vault                      • AI Telemetry Analytics
       • Quest & Puzzle Modals                           • Multi-Service Health Monitor
                  │                                               │
                  └───────────────────────┬───────────────────────┘
                                          ▼
                             AUTHORITATIVE API GATEWAY
                           (http://localhost:5000/api/v1)
                                  Node.js 22 + Express
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
          POSTGRESQL 15              REDIS 7 CACHE          FASTAPI AI SERVICE
         Database Engine             Session Store       (http://localhost:8000)
       • Users & RBAC Roles        • Quest/Clue Cache      • LLM Prompt Orchestration
       • Player Profiles & Stats   • Rate Limit Buckets    • Domain Validation Engine
       • Quests, Clues & Solves    • Ephemeral Tokens      • Multi-Modal Schemas
       • AI Telemetry Event Logs   • High-Speed Latency    • Fallback Cache & Retry
```

---

## 🚀 Core Features

### 1. Authoritative Backend Game Engine (Node.js 22 + Express)
* **JWT Token Rotation**: 15-minute access tokens paired with 7-day single-use rotating refresh tokens stored securely with revocation tracking.
* **Dual Google & Firebase Auth**: Server-side Google OAuth2 and Firebase Web Auth token verification against Google Public X509 certificates.
* **Idempotent Rewards**: Concurrent or duplicate quest completion submissions are deduplicated atomically; rewards are only granted once.
* **Clue Unlocking Pipeline**: Progressive clues unlock strictly upon passing previous narrative requirements.

### 2. Procedural AI Puzzle Microservice (FastAPI + Python 3.11)
* **Domain Guardrails**: Enforces canonical learning topics and rejects invalid or coding-focused prompts.
* **Dual Validation**: FastAPI validates schema compliance before output, and Node.js performs a second authoritative contract validation before storing the puzzle in PostgreSQL.
* **Telemetry & Failure Recovery**: Failed validation attempts trigger automatic retries and log structured telemetry events for administrative analysis.

### 3. Dual Web Frontend Portals
* **Player Gaming Client (`/play`)**: Built with responsive vanilla JavaScript and CSS, featuring a fantasy-themed UI, real-time inventory relics, quest journal, and WebGL hosting shell.
* **Admin Operations Dashboard (`/admin`)**: SaaS dashboard for user management, role elevation, quest analytics, real-time telemetry inspection, and service health monitoring.

---

## 📂 Repository Structure

```text
MP_095_ASCENDRA/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Automated Quality & CI Pipeline
├── ai-service/                    # FastAPI AI Microservice (Python 3.11)
│   ├── app/
│   │   ├── routers/               # Puzzle generation & health endpoints
│   │   ├── services/              # LLM integration & prompt builders
│   │   └── models/                # Pydantic schemas for multi-modal puzzles
│   ├── tests/                     # Pytest automated test suite
│   ├── requirements.txt           # Python dependencies
│   └── .env.example               # AI service environment template
├── backend/                       # Core Game Backend (Node.js 22.x)
│   ├── src/
│   │   ├── config/                # Database (pg pool), Redis, and JWT setup
│   │   ├── middleware/            # Auth JWT, Role RBAC, Rate Limiting, Error handling
│   │   ├── routes/                # Auth, Quests, Clues, Puzzles, Admin, Health
│   │   ├── services/              # Auth, Cache, AI Gateway, Puzzle Validator
│   │   ├── app.js                 # Express application & static routing
│   │   └── server.js              # Server entry point
│   ├── tests/                     # Jest comprehensive test suite (13 suites, 204 tests)
│   └── package.json               # Backend dependencies & npm scripts
├── database/                      # PostgreSQL Schemas, Migrations & Seeds
│   ├── migrations/                # SQL migration scripts (001_initial, 002_telemetry)
│   ├── seeds/                     # Starter quests, clues, and demo fixtures
│   └── scripts/                   # Migration & seed runners (migrate.js, seed.js)
├── frontend/                      # Web Frontends
│   ├── player/                    # Player Web Client & WebGL Hosting Shell (/play)
│   └── admin/                     # Operational Admin Management Console (/admin)
├── docs/                          # Comprehensive Architecture & Engineering Documentation
│   ├── ADMIN_API.md               # Administrative API contracts
│   ├── ADMIN_DASHBOARD.md         # Admin console specifications
│   ├── AI_PUZZLE_SPECIFICATION.md # Multi-modal puzzle schemas & non-coding policies
│   ├── DEVOPS_WORKFLOW.md         # CI/CD, Git branching, and testing standards
│   ├── FRONTEND_ENVIRONMENT.md    # Frontend configuration & auth guide
│   ├── PLAYER_WEB_CLIENT.md       # Player client design & WebGL integration
│   └── SECURITY_AUDIT.md          # Full-stack security audit report
├── scripts/                       # DevOps & repository tooling
│   └── check-secrets.js           # Pre-commit & CI lightweight credential scanner
├── .env.example                   # Unified environment configuration template
└── README.md                      # Repository root documentation
```

---

## ⚙️ Prerequisites

Ensure the following runtimes and services are installed on your workstation:

| Runtime / Service | Minimum Version | Recommended | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v20.x` | `v22.x` or `v24.x` | Backend runtime & npm |
| **Python** | `3.10` | `3.11+` | FastAPI AI microservice |
| **PostgreSQL** | `14` | `15+` or Neon Cloud | Core relational database |
| **Redis** | `6.2` | `7.x` or Upstash | Cache, session & rate-limit store |
| **Unity** *(Optional)* | `2022.3 LTS` | Latest LTS | For Unity 3D client builds |

---

## 🚀 Getting Started

### 1. Clone Repository
```bash
git clone https://github.com/vrushti16/MP_095_ASCENDRA.git
cd MP_095_ASCENDRA
```

### 2. Environment Configuration
Copy the unified template into the respective service directories:

```bash
# Backend configuration
cp .env.example backend/.env

# AI Microservice configuration
cp ai-service/.env.example ai-service/.env
```

Update `backend/.env` with your PostgreSQL database credentials, Redis URL, and JWT secrets:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/ascendra_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_min_32_characters_long!
JWT_REFRESH_SECRET=your_refresh_secret_min_32_characters_long!
AI_SERVICE_URL=http://localhost:8000
```

### 3. Database Migration & Seeding
Initialize the database tables and seed starter quests:

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
```

> **Tip:** To populate full demo gameplay profiles, run:
> ```bash
> npm run db:seed:demo
> ```

### 4. Starting the Services

#### A. Launch the Node.js Backend & Web Servers
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
```

#### B. Launch the FastAPI AI Microservice
In a separate terminal:
```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Microservice running at http://localhost:8000
```

---

## 🌐 Web Portals & Endpoints

Once the backend is started, all interfaces and APIs are accessible via `http://localhost:5000`:

| Endpoint / URL | Service / Feature | Description |
| :--- | :--- | :--- |
| `http://localhost:5000/play` | **Player Web Client** | 3D WebGL game hosting shell, hero HUD, relic inventory, and clue journal. |
| `http://localhost:5000/admin` | **Admin Dashboard** | Operations console, role assignment, telemetry event logs, and service health. |
| `http://localhost:5000/api/v1/health` | **Health Probes** | Multi-service health monitoring (PostgreSQL, Redis, AI service). |
| `http://localhost:5000/api/v1/auth/*` | **Authentication API** | Register, login, Google/Firebase OAuth, token refresh, and logout. |
| `http://localhost:5000/api/v1/quests/*` | **Quests API** | Fetch active quests, start quests, and claim authoritative completion rewards. |
| `http://localhost:5000/api/v1/clues/*` | **Clues API** | Progressive archaeological clue discovery. |
| `http://localhost:5000/api/v1/puzzles/*`| **Puzzles API** | Generate and submit procedural educational puzzles. |
| `http://localhost:8000/docs` | **AI Swagger Docs** | Interactive OpenAPI documentation for the FastAPI microservice. |

---

## 🧪 Testing & Quality Verification

ASCENDRA incorporates end-to-end automated testing across all microservices:

### 1. Secret Scanning Verification
Ensure no API keys, private keys, or passwords are inadvertently tracked:
```bash
node scripts/check-secrets.js
```

### 2. Backend Test Suite (Jest)
Runs 13 test suites covering 204 unit and integration test cases:
```bash
cd backend
npm test
```

### 3. AI Service Test Suite (Pytest)
Validates puzzle generation schemas, prompt sanitization, and error handling:
```bash
cd ai-service
pytest -v --tb=short
```

---

## 🛡️ Security & Anti-Cheat Guarantees

* **Zero Hardcoded Secrets**: Scanned continuously on push by lightweight security tooling.
* **Server-Side Token Verification**: Google ID tokens and Firebase Web tokens are cryptographically verified using Google public cert endpoints.
* **Anti-Cheat Quest Validation**: Clients cannot supply custom XP/score increments; the backend references only database-persisted reward values upon objective completion.
* **DDoS & Abuse Prevention**: Configurable Redis-backed rate limiters on auth, puzzle generation, and admin endpoints.
* **Strict SQL Binding**: Parameterized queries across all database access layers to prevent SQL injection.

---

## 📚 Documentation Index

For detailed architectural specifications, refer to the documentation in [`docs/`](docs/):

* 📘 [AI Puzzle Specification & Generation Contract](docs/AI_PUZZLE_SPECIFICATION.md)
* 🛡️ [Full-Stack Security Audit & Vulnerability Report](docs/SECURITY_AUDIT.md)
* 🚀 [DevOps & Engineering Workflow Guide](docs/DEVOPS_WORKFLOW.md)
* 🎮 [Player Web Client & WebGL Shell](docs/PLAYER_WEB_CLIENT.md)
* 📊 [Admin Operations Dashboard Specifications](docs/ADMIN_DASHBOARD.md)
* 🔑 [Frontend Environment & Dual Google Authentication](docs/FRONTEND_ENVIRONMENT.md)
* 📡 [Admin Management API Documentation](docs/ADMIN_API.md)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).  
All rights reserved © 2026 ASCENDRA Project Team.
