# ASCENDRA — Admin Backend API Specification

This document details the administrative REST APIs for the **ASCENDRA** platform mounted at `/api/v1/admin`.

---

## 1. Security & Authorization

All Admin endpoints strictly enforce server-side authentication and role-based access control (RBAC):

1. **`authenticateJWT` Middleware**:
   * Expects standard HTTP header: `Authorization: Bearer <access-token>`
   * Decodes cryptographically signed JWT access tokens (15-minute default validity).
   * Rejects missing, expired, or tampered tokens with HTTP `401 Unauthorized`.
2. **`requireRole('admin')` Middleware**:
   * Inspects verified token claims (`req.user.role`).
   * If `role !== 'admin'`, immediately rejects with HTTP `403 Forbidden`.
   * Never relies on frontend visibility or client-side role assertions.
3. **Sensitive Field Exclusion**:
   * User password hashes (`password_hash`), refresh token hashes, OAuth secrets, and internal keys are structurally excluded from all responses.

---

## 2. API Endpoints Overview

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/overview` | Admin JWT | High-level summary of users, quests, puzzles, progression, and services. |
| `GET` | `/api/v1/admin/users` | Admin JWT | Searchable, paginated, and role-filtered player and admin accounts. |
| `GET` | `/api/v1/admin/users/:id` | Admin JWT | Detailed player inspection (profile, quests, puzzle attempts, clues, sessions). |
| `PATCH` | `/api/v1/admin/users/:id/role` | Admin JWT | Update user role (`admin` or `player`) with last-admin protection. |
| `GET` | `/api/v1/admin/game/analytics` | Admin JWT | Aggregate quest completion, puzzle accuracy, topic breakdown, and progression. |
| `GET` | `/api/v1/admin/ai/telemetry` | Admin JWT | AI microservice latency, validation failure stats, and recent request history. |
| `GET` | `/api/v1/admin/system/health` | Admin JWT | Deep multi-service health diagnostic (Node.js, PostgreSQL, Redis, FastAPI). |

---

## 3. Endpoint Specifications

### 3.1 Platform Overview
* **Route**: `GET /api/v1/admin/overview`
* **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 42,
      "players": 40,
      "admins": 2,
      "activeSessions": 5
    },
    "quests": {
      "activeQuests": 8,
      "inProgressQuests": 14,
      "completedQuests": 22
    },
    "puzzles": {
      "totalAttempts": 150,
      "correctAttempts": 112,
      "accuracyRate": 75
    },
    "progression": {
      "averageLevel": 3.4,
      "averageScore": 420,
      "averageXp": 850
    },
    "systemHealth": {
      "status": "healthy",
      "services": {
        "postgresql": "healthy",
        "redis": "healthy",
        "fastapi": "healthy"
      }
    }
  },
  "message": "Admin dashboard overview retrieved successfully"
}
```

---

### 3.2 User Management List
* **Route**: `GET /api/v1/admin/users`
* **Query Parameters**:
  * `page` (optional, default: `1`, min: `1`): Current page.
  * `limit` (optional, default: `20`, range: `1`–`100`): Results per page.
  * `search` (optional): Case-insensitive string search matching `name` or `email`.
  * `role` (optional): Filter by `'player'` or `'admin'`.
* **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "b0000000-0000-4000-b000-000000000002",
        "email": "hero@ascendra.test",
        "name": "Player Explorer",
        "avatarUrl": null,
        "role": "player",
        "createdAt": "2026-09-10T14:00:00.000Z",
        "updatedAt": "2026-09-10T14:00:00.000Z",
        "lastLogin": "2026-09-10T14:30:00.000Z",
        "level": 5,
        "experience": 250,
        "score": 500
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### 3.3 User Details Inspection
* **Route**: `GET /api/v1/admin/users/:id`
* **Path Parameters**:
  * `id`: Standard UUID of the user.
* **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "b0000000-0000-4000-b000-000000000002",
      "email": "hero@ascendra.test",
      "name": "Player Explorer",
      "role": "player",
      "createdAt": "2026-09-10T14:00:00.000Z"
    },
    "profile": {
      "level": 5,
      "experience": 250,
      "score": 500,
      "health": 100,
      "maxHealth": 100
    },
    "quests": [
      {
        "questId": "quest_001_intro",
        "title": "Welcome to Ascendra",
        "category": "tutorial",
        "difficulty": "easy",
        "status": "completed",
        "progress": 100
      }
    ],
    "recentPuzzleAttempts": [],
    "discoveredClues": [],
    "recentSessions": []
  }
}
```

---

### 3.4 Role Management
* **Route**: `PATCH /api/v1/admin/users/:id/role`
* **Request Body**:
```json
{
  "role": "admin"
}
```
* **Guardrails**:
  * Prevents demoting the last remaining administrator in the system, returning HTTP `409 Conflict` (`LAST_ADMIN_DEMOTION_FORBIDDEN`).

---

### 3.5 Game Progression Analytics
* **Route**: `GET /api/v1/admin/game/analytics`
* **Response (200 OK)**:
  * Quest completion rates, puzzle accuracy rates, topic accuracy breakdown (e.g. `cloud_computing`, `cyber_security`, `mathematics`), and player level distribution.

---

### 3.6 AI Telemetry & Quality Monitoring
* **Route**: `GET /api/v1/admin/ai/telemetry`
* **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRequests": 45,
      "successfulRequests": 43,
      "validationFailures": 2,
      "serviceErrors": 0,
      "fallbackUsage": 0,
      "averageLatencyMs": 138
    },
    "recentRequests": [
      {
        "questId": "quest_001",
        "topic": "cloud_computing",
        "difficulty": "easy",
        "status": "success",
        "latencyMs": 142,
        "isFallback": false,
        "createdAt": "2026-09-10T14:45:00.000Z"
      }
    ]
  }
}
```

---

### 3.7 System Health Diagnostic
* **Route**: `GET /api/v1/admin/system/health`
* **Response (200 OK)**:
  * Full diagnostic status including round-trip latencies for PostgreSQL, Redis, and FastAPI.
  * HTTP 503 if primary database connection fails.
