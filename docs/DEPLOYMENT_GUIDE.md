# 🚀 ASCENDRA Cloud Deployment Guide (Zero-Docker)

This guide provides a step-by-step walkthrough to deploy the complete **ASCENDRA** platform to the cloud for free **without using Docker**.

---

## 🏛️ Deployment Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        RENDER CLOUD (Free Tier)                        │
│                                                                        │
│   ┌──────────────────────────────────┐  Internal / Public              │
│   │   ascendra-backend (Node 22)     │ ◄─────────────────┐             │
│   │   • Express API Gateway          │                   │             │
│   │   • Player Web Client (/play)    │                   │             │
│   │   • Admin Dashboard (/admin)     │                   │             │
│   └─────────────────┬────────────────┘                   │             │
│                     │                                    │             │
│                     │ AI_SERVICE_URL                     │             │
│                     ▼                                    │             │
│   ┌──────────────────────────────────┐                   │             │
│   │   ascendra-ai-service (Py 3.11)  │ ──────────────────┘             │
│   │   • FastAPI AI Engine            │                                 │
│   │   • Procedural Multi-Modal Puzzles                                 │
│   └──────────────────────────────────┘                                 │
└─────────────────────┬──────────────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌──────────────────┐       ┌──────────────────┐
│  NEON POSTGRES   │       │  UPSTASH REDIS   │
│  (Free Cloud DB) │       │  (Free Cloud KV) │
│  • Users & RBAC  │       │  • Cache Store   │
│  • Quests & Clues│       │  • Rate Limiting │
└──────────────────┘       └──────────────────┘
```

---

## 📋 Step 1: Create a Free PostgreSQL Database on Neon (1 Minute)

Neon provides a managed, serverless PostgreSQL database with full SSL support.

1. Go to [https://neon.tech](https://neon.tech) and click **Sign Up** (or log in with GitHub/Google).
2. Click **Create Project**:
   - **Project Name**: `ascendra-db`
   - **Postgres version**: `15` or `16` (default)
   - **Region**: Choose the region closest to you (e.g. `US East (Ohio)`).
3. Once created, your dashboard will display the **Connection Details**.
4. Select **Connection string** and copy the URI. It will look like:
   ```text
   postgresql://[user]:[password]@[endpoint].us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Save this URI — this is your `DATABASE_URL`.

---

## 📋 Step 2: (Optional) Create Free Redis on Upstash (1 Minute)

> **Note**: Redis is optional. If you do not want to set up Redis right now, simply set `REDIS_ENABLED=false` on Render, and ASCENDRA will run seamlessly in `cache_bypass` mode.

If you want Redis caching enabled:
1. Go to [https://upstash.com](https://upstash.com) and sign up with GitHub/Google.
2. Under the **Redis** tab, click **Create Database**:
   - **Name**: `ascendra-redis`
   - **Type**: Regional (select same region as Neon)
3. Under the **Connect** section, copy the **`rediss://...`** URL (Node.js / ioredis format).
4. Save this URL — this is your `REDIS_URL`.

---

## 📋 Step 3: Deploy to Render (Zero-Docker)

Render hosts both Node.js and Python web applications natively without needing any Docker containers or CLI tools.

### Option A: 1-Click Blueprint Deployment (Recommended)

ASCENDRA includes a pre-configured `render.yaml` Blueprint file in the repository root.

1. Push your code to your GitHub repository (if you have local changes):
   ```bash
   git add .
   git commit -m "chore: configure zero-docker cloud deployment"
   git push origin main
   ```
2. Log in to [https://dashboard.render.com](https://dashboard.render.com).
3. In the top-right header, click **New +** and select **Blueprint**.
4. Connect your GitHub account and select your **`MP_095_ASCENDRA`** repository.
5. Render will automatically scan `render.yaml` and discover two services:
   - `ascendra-ai-service` (Python Web Service)
   - `ascendra-backend` (Node Web Service)
6. Render will prompt you to fill in the required environment variables:
   - **`DATABASE_URL`**: Paste your Neon connection string from Step 1.
   - **`GEMINI_API_KEY`**: Paste your Google Gemini API Key (from [Google AI Studio](https://aistudio.google.com/)).
   - **`SMTP_USER`**: Your Gmail address (e.g. `yourname@gmail.com`).
   - **`SMTP_PASSWORD`**: Your 16-character Google App Password (see below).
   - **`SMTP_AUTH_USER`**: Your Gmail address.
   - **`EMAIL_FROM`**: `"ASCENDRA Expeditions" <yourname@gmail.com>`.
   - **`REDIS_URL`**: (Leave blank or paste Upstash URL).
   - **`REDIS_ENABLED`**: Set to `"true"` if using Upstash, or `"false"`.
7. Click **Apply Blueprint**.
8. Render will now automatically:
   - Build and start the Python FastAPI AI service.
   - Automatically link `AI_SERVICE_URL` to the backend.
   - Run database migrations (`npm run db:migrate`) and seed starter quests (`npm run db:seed`) against your Neon database.
   - Start the Node.js backend serving the API, Player Web Client, and Admin Console.

---

### Option B: Manual Service Creation in Render

If you prefer to configure each service manually via the Render web UI:

#### Service 1: Deploy AI Microservice (`ascendra-ai-service`)
1. On Render Dashboard, click **New +** -> **Web Service**.
2. Connect your GitHub repo.
3. Configure the service:
   - **Name**: `ascendra-ai-service`
   - **Region**: Same region as your Neon database (e.g. Oregon)
   - **Root Directory**: `ai-service`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free
4. Add **Environment Variables**:
   - `PYTHON_VERSION`: `3.11.9`
   - `ENVIRONMENT`: `production`
   - `LLM_PROVIDER`: `gemini`
   - `GEMINI_MODEL`: `gemini-1.5-flash`
   - `GEMINI_API_KEY`: `your_gemini_api_key_here`
5. Click **Create Web Service**.
6. Once deployed, copy your AI service's public URL (e.g. `https://ascendra-ai-service.onrender.com`).

#### Service 2: Deploy Backend & Web Clients (`ascendra-backend`)
1. Click **New +** -> **Web Service**.
2. Connect the same GitHub repo.
3. Configure the service:
   - **Name**: `ascendra-backend`
   - **Region**: Same region as your AI service
   - **Root Directory**: (Leave blank — root directory)
   - **Runtime**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Pre-deploy Command**: `cd backend && npm run db:migrate && npm run db:seed`
   - **Instance Type**: Free
4. Add **Environment Variables**:
   - `NODE_VERSION`: `22.12.0`
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: Your Neon PostgreSQL connection string
   - `REDIS_ENABLED`: `false` (or `true` if using Upstash)
   - `REDIS_URL`: Your Upstash Redis URL (if enabled)
   - `AI_SERVICE_URL`: URL of the AI service from Service 1 (e.g. `https://ascendra-ai-service.onrender.com`)
   - `JWT_SECRET`: Random 32+ character string (e.g. `ascendra_prod_super_secret_jwt_key_2026!`)
   - `JWT_REFRESH_SECRET`: Another random 32+ character string
   - `JWT_ACCESS_EXPIRES`: `15m`
   - `JWT_REFRESH_EXPIRES`: `7d`
   - `OTP_SECRET`: Random 32+ character string
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: `your_email@gmail.com`
   - `SMTP_PASSWORD`: `your_16_digit_gmail_app_password`
   - `SMTP_AUTH_USER`: `your_email@gmail.com`
   - `EMAIL_FROM`: `"ASCENDRA Expeditions" <your_email@gmail.com>`
5. Click **Create Web Service**.

---

## 🔑 How to Generate a Gmail App Password for OTP Emails

To enable the 6-digit email ownership verification OTPs in production:

1. Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is turned ON.
3. In the search bar at the top of your Google Account page, search for **App passwords**.
4. Select **App passwords**:
   - Name: `ASCENDRA Production`
   - Click **Create**.
5. Google will display a 16-character code (e.g. `abcd efgh ijkl mnop`).
6. Copy this 16-character code (remove spaces) and paste it as `SMTP_PASSWORD` in your Render environment variables.

---

## 🌐 Verifying Your Deployed Application

Once Render finishes building, you will receive a public URL (e.g. `https://ascendra-backend.onrender.com`).

| Destination | URL | What you should see |
| :--- | :--- | :--- |
| **Player Web Client** | `https://ascendra-backend.onrender.com/play` | Fantasy RPG UI, hero status, inventory relics, and quest journal |
| **Player Registration** | `https://ascendra-backend.onrender.com/register` | Embossed signup card with real Gmail OTP verification |
| **Player Sign In** | `https://ascendra-backend.onrender.com/login` | Embossed login portal with unverified account detection |
| **Admin Operations** | `https://ascendra-backend.onrender.com/admin` | Operational console with telemetry logs, quest KPI monitor, and RBAC |
| **Deep Health Probe** | `https://ascendra-backend.onrender.com/api/v1/health?detailed=true` | JSON showing PostgreSQL, Redis, and FastAPI health and latencies |
| **AI Swagger Docs** | `https://ascendra-ai-service.onrender.com/docs` | Interactive OpenAPI documentation for FastAPI microservice |

---

## 🛠️ Maintenance & Common Tips

### 1. Free Tier Inactivity (Spin-down)
* Render free web services automatically spin down after 15 minutes of inactivity to save resources.
* When a user visits the URL, it will take ~30–45 seconds to spin up on the first request. Subsequent requests are instant.
* *Tip*: Free uptime monitors like [UptimeRobot](https://uptimerobot.com) can ping `https://ascendra-backend.onrender.com/api/v1/health` every 10 minutes to keep your services warm 24/7.

### 2. Running Migrations Manually
If you add new migrations in the future:
* The `preDeployCommand` in `render.yaml` runs migrations automatically on every git push.
* You can also open the **Shell** tab inside your `ascendra-backend` service on Render and execute:
  ```bash
  cd backend && npm run db:migrate
  ```

### 3. Populating Demo Fixtures
To populate the database with full demo player profiles, achievements, and leaderboard entries:
* Open the **Shell** tab on Render and run:
  ```bash
  cd backend && npm run db:seed:demo
  ```
