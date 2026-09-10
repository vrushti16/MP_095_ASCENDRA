# ASCENDRA AI Puzzle Generation Service (FastAPI)
Developer B — AI Service Implementation

## Overview
Authoritative AI microservice for the ASCENDRA educational adventure game. Conforms strictly to [`docs/AI_PUZZLE_SPECIFICATION.md`](../docs/AI_PUZZLE_SPECIFICATION.md).

## Features
- **15+ Learning Domains**: Aptitude, English, Artificial Intelligence, Mathematics, Interview Preparation, Cloud Computing, Cyber Security, Data Science, Logical Reasoning, Critical Thinking, etc.
- **Strict Non-Coding Guardrails**: 3-layer validation rejecting all programming syntax, code execution prediction, debugging, and task-intents.
- **Multi-Modal Interaction Models**: Ordering, matching, text-input, situational decision, true/false, and multiple-choice.
- **Dual LLM Provider & Fallback**: Supports Google Gemini and OpenAI with structured JSON prompting, plus an offline deterministic generator for reliable testability without paid API keys.
- **Spec Version 1.0**: Returns `specVersion: "1.0"` in response payloads.
- **No Docker Required**: Runs directly via standard Python tooling (`uv` / `pip` / `uvicorn`).

## Setup & Running

### 1. Install Dependencies
```bash
cd ai-service
pip install -r requirements.txt
```
Or with `uv`:
```bash
uv pip install -r requirements.txt
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Optionally configure `GEMINI_API_KEY` or `OPENAI_API_KEY` and set `LLM_PROVIDER=gemini` or `openai`. Defaults to `offline` for offline testing.

### 3. Run Development Server
```bash
uvicorn app.main:app --port 8000 --reload
```
API Documentation will be available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. Run Automated Tests
```bash
pytest
```

## API Endpoints
- `GET /api/v1/health` — Service health and provider info.
- `POST /api/v1/ai/puzzles/generate` — Authoritative puzzle generation endpoint consumed by the Node.js backend.
