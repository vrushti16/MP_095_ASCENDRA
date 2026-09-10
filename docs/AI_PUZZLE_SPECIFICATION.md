# ASCENDRA — AI Puzzle Specification & Generation Contract
**Version:** 1.0.0  
**Authors:** Developer B (AI / FastAPI Service) & Developer C (Node.js Backend)  
**Status:** Approved Architectural Contract  

---

## 1. Executive Summary & Vision
ASCENDRA is an educational adventure game where player progression, clues, and quest objectives are unlocked through solving AI-generated learning challenges.

Unlike traditional quiz platforms, ASCENDRA puzzles:
1. **Span diverse professional and cognitive domains** (Aptitude, English, Artificial Intelligence, Mathematics, Interview Preparation, Cloud Computing, Cyber Security, Data Science, Logical Reasoning, Critical Thinking, and more).
2. **Strictly prohibit coding/programming exercises** (no syntax trivia, writing code, debugging snippets, or predicting program execution).
3. **Support multi-modal interaction types beyond standard multiple-choice** (sequences, riddles, ordering steps, concept matching, situational decisions, true/false reasoning, fill-in-the-blank).
4. **Follow a dual-validation pipeline** where FastAPI validates AI generation, and Node.js performs authoritative contract & anti-cheat validation before persisting to PostgreSQL and delivering sanitized challenges to Unity WebGL.

---

## 2. Supported Learning Domains
Puzzles must be categorized under one of the following canonical domains (case-insensitive):

| Domain Identifier | Name | Scope & Focus Areas |
| :--- | :--- | :--- |
| `aptitude` | General Aptitude | Numerical series, spatial visualization, probability intuition, ratios, rates. |
| `english` | English & Verbal | Vocabulary, idioms, analogies, comprehension, rhetorical tone, grammar concepts. |
| `artificial_intelligence` | AI & Machine Learning | Conceptual ML/AI, supervised vs unsupervised, bias/ethics, neural intuition, LLM capabilities. |
| `mathematics` | Mathematics | Applied arithmetic, mental math, sequence patterns, geometrical logic, algebraic concepts. |
| `interview_preparation` | Interview Preparation | Behavioral situational judgment, STAR technique, workplace communication, dilemma resolution. |
| `cloud_computing` | Cloud Architecture | Scalability, high availability, disaster recovery, cloud security models, cost vs performance. |
| `cyber_security` | Cyber Security | Social engineering, phishing awareness, defense-in-depth, password hygiene, CIA triad. |
| `data_science` | Data Science & Stats | Data interpretation, statistical fallacies (correlation vs causation), chart comprehension, hypothesis reasoning. |
| `logical_reasoning` | Logical Reasoning | Syllogisms, truth deduction, constraint satisfaction, deductive grids, relational deductions. |
| `critical_thinking` | Critical Thinking | Identifying cognitive biases, logical fallacies, evaluating arguments, premise vs conclusion. |
| `communication_skills`| Communication Skills | Active listening, non-verbal cues, dispute resolution, conciseness, feedback delivery. |
| `problem_solving` | Problem Solving | Root cause analysis, decision matrix evaluation, systems thinking, prioritization. |
| `quantitative_reasoning` | Quantitative Reasoning | Data estimation, dimensional analysis, percentage changes, financial intuition. |
| `verbal_reasoning` | Verbal Reasoning | Deductions from texts, identifying assumptions, inference validation. |
| `general_knowledge` | General Knowledge | Science concepts, historical context, environmental systems, global geography. |

---

## 3. Strict Non-Coding / Non-Programming Policy
> [!IMPORTANT]
> **NO CODING / PROGRAMMING PUZZLES ARE PERMITTED IN ASCENDRA.**

### 3.1 Prohibited Tasks
A puzzle is **strictly invalid** and will be rejected by the Node.js validation pipeline if it requires the player to:
- Write, complete, or fix code in any programming language (Python, JavaScript, C++, Java, Rust, Go, SQL, etc.).
- Predict the output or execution state of a code snippet or script.
- Identify or recall language syntax rules, compiler errors, or language-specific APIs.
- Write or complete database query scripts (e.g. `SELECT`, `JOIN`, `UPDATE`).
- Implement algorithmic data structures in code (e.g. linked lists, tree traversal implementations).
- Debug or trace lines of software code.

### 3.2 Contrast: Invalid vs Valid
- ❌ **INVALID:** *"What will this Python snippet output? `print([x**2 for x in range(4)])`"*
- ✅ **VALID:** *"What is the difference between supervised and unsupervised machine learning?"*
- ❌ **INVALID:** *"Write a SQL query to find customers who placed more than 3 orders."*
- ✅ **VALID:** *"What is the primary operational trade-off of adding a secondary index to a database table?"*
- ❌ **INVALID:** *"Fix the null pointer exception in the following Java method."*
- ✅ **VALID:** *"An employee receives an urgent email claiming to be from the CEO requesting gift cards. What attack is this?"*
- ❌ **INVALID:** *"Which AWS SDK Python function uploads an object to S3?"*
- ✅ **VALID:** *"Which cloud architecture pattern ensures application uptime during a complete data center outage?"*

---

## 4. Educational Puzzle Types vs Interaction Types

ASCENDRA separates the **educational category** (`type`) from the **player interaction model** (`interactionType`):

- **`type`**: The cognitive category of the challenge (e.g. `sequence`, `riddle`, `scenario`, `ordering`, `matching`, `concept`, `logic`).
- **`interactionType`**: The client-side mechanism used by Unity to render the puzzle and collect input:
  1. `multiple_choice` — Select 1 option from a list of options.
  2. `text_input` — Enter a concise string or numerical answer (riddles, sequence next value, fill in blank).
  3. `ordering` — Arrange a list of steps, events, or items into the correct sequence.
  4. `matching` — Pair terms from one column with corresponding definitions or attributes in another.
  5. `decision` — Situational judgment / case study dilemma where player selects the best action.
  6. `true_false` — Determine whether an analytical statement is True or False.

---

## 5. Canonical AI Generation HTTP Contract (FastAPI ↔ Node.js)

### 5.1 Generation Request (Node.js ➔ FastAPI)
**`POST /api/v1/ai/puzzles/generate`**

```json
{
  "questId": "quest_ancient_runes",
  "topic": "cloud_computing",
  "difficulty": "medium",
  "type": "ordering",
  "interactionType": "ordering"
}
```

#### Request Fields:
- `questId` *(string, optional)*: Associated quest ID for narrative alignment.
- `topic` *(string, required)*: One of the supported domain identifiers.
- `difficulty` *(string, required)*: `"easy"` | `"medium"` | `"hard"`.
- `type` *(string, optional)*: Requested puzzle category (e.g. `"sequence"`, `"ordering"`, `"scenario"`, `"riddle"`).
- `interactionType` *(string, optional)*: Requested interaction model.

---

### 5.2 Generation Response (FastAPI ➔ Node.js)
The response from FastAPI must adhere to the canonical schema:

```json
{
  "specVersion": "1.0",
  "externalPuzzleId": "ai_pz_982341",
  "type": "ordering",
  "interactionType": "ordering",
  "topic": "cloud_computing",
  "difficulty": "medium",
  "question": "Arrange the standard incident response phases in the correct operational sequence.",
  "content": {
    "items": [
      "Preparation",
      "Detection & Analysis",
      "Containment, Eradication & Recovery",
      "Post-Incident Activity"
    ]
  },
  "answer": [0, 1, 2, 3],
  "explanation": "According to the NIST incident response framework, teams must prepare, detect/analyze, contain/recover, and finally conduct post-incident review."
}
```

---

## 6. Interaction Type Schemas & Examples

### 6.1 `multiple_choice` (Single Option Selection)
- **`content`**: `{ "options": ["Option A", "Option B", "Option C", "Option D"] }`
- **`answer`**: `"Option B"` (or exact 0-indexed integer `1`)
- **Example:**
```json
{
  "type": "concept",
  "interactionType": "multiple_choice",
  "topic": "artificial_intelligence",
  "difficulty": "easy",
  "question": "Which branch of AI focuses on enabling machines to learn from experience without being explicitly programmed?",
  "content": {
    "options": [
      "Machine Learning",
      "Rule-Based Expert Systems",
      "Deterministic Finite Automata",
      "Relational Database Querying"
    ]
  },
  "answer": "Machine Learning",
  "explanation": "Machine Learning algorithms build mathematical models based on sample training data to make predictions or decisions."
}
```

### 6.2 `text_input` (Sequence / Riddle / Fill-in-the-Blank)
- **`content`**: `{ "sequence": [2, 4, 8, 16], "prompt": "Enter the next number" }` OR `{ "riddle": "...", "hint": "..." }`
- **`answer`**: `"32"` (string or numerical string)
- **Example (Math/Aptitude Sequence):**
```json
{
  "type": "sequence",
  "interactionType": "text_input",
  "topic": "mathematics",
  "difficulty": "easy",
  "question": "What is the next number in the pattern: 3, 7, 15, 31, ...?",
  "content": {
    "sequence": [3, 7, 15, 31],
    "prompt": "Enter the next integer in this series."
  },
  "answer": "63",
  "explanation": "Each term is double the previous term plus one: 31 * 2 + 1 = 63 (or 2^(n+1) - 1)."
}
```

### 6.3 `ordering` (Process Sequence / Timeline)
- **`content`**: `{ "items": ["Item A", "Item B", "Item C", "Item D"] }`
- **`answer`**: `[1, 0, 3, 2]` (array of indices representing the correct permutation) OR `["Item B", "Item A", "Item D", "Item C"]`
- **Example (Data Science Lifecycle):**
```json
{
  "type": "ordering",
  "interactionType": "ordering",
  "topic": "data_science",
  "difficulty": "medium",
  "question": "Order the phases of the data science workflow from start to finish.",
  "content": {
    "items": [
      "Model Evaluation",
      "Problem Formulation",
      "Data Cleaning & Preprocessing",
      "Deployment & Monitoring"
    ]
  },
  "answer": [1, 2, 0, 3],
  "explanation": "The workflow begins with problem formulation, followed by data cleaning, model evaluation, and deployment."
}
```

### 6.4 `matching` (Concept & Pair Linking)
- **`content`**:
  `{ "terms": ["Symmetric Encryption", "Asymmetric Encryption", "Hashing"], "definitions": ["One-way transformation for integrity", "Uses identical key for encrypt/decrypt", "Uses public and private key pair"] }`
- **`answer`**:
  `{ "Symmetric Encryption": "Uses identical key for encrypt/decrypt", "Asymmetric Encryption": "Uses public and private key pair", "Hashing": "One-way transformation for integrity" }`
- **Example (Cyber Security):**
```json
{
  "type": "matching",
  "interactionType": "matching",
  "topic": "cyber_security",
  "difficulty": "medium",
  "question": "Match each cybersecurity concept with its primary objective.",
  "content": {
    "terms": ["Confidentiality", "Integrity", "Availability"],
    "definitions": ["Ensuring data is not tampered with", "Ensuring systems are accessible to authorized users", "Preventing unauthorized disclosure of information"]
  },
  "answer": {
    "Confidentiality": "Preventing unauthorized disclosure of information",
    "Integrity": "Ensuring data is not tampered with",
    "Availability": "Ensuring systems are accessible to authorized users"
  },
  "explanation": "These three principles constitute the foundational CIA Triad of information security."
}
```

### 6.5 `decision` (Situational Judgment / Ethics)
- **`content`**: `{ "context": "...", "dilemma": "...", "choices": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"] }`
- **`answer`**: `"Choice 2"`
- **Example (Interview / Workplace Scenario):**
```json
{
  "type": "scenario",
  "interactionType": "decision",
  "topic": "interview_preparation",
  "difficulty": "medium",
  "question": "A critical project deadline is in two days, and you realize a core dependency will not be delivered on time. What is the most professional response?",
  "content": {
    "context": "You are coordinating a multi-team deliverable.",
    "choices": [
      "Immediately notify stakeholders with the current status, impact assessment, and proposed mitigation alternatives.",
      "Work privately through the night without alerting anyone, hoping the dependency arrives.",
      "Blame the dependency team in the public company channel to protect your reputation.",
      "Quietly remove the dependent feature without informing the client."
    ]
  },
  "answer": "Immediately notify stakeholders with the current status, impact assessment, and proposed mitigation alternatives.",
  "explanation": "Proactive transparency, accompanied by impact analysis and mitigation options, demonstrates leadership and accountability."
}
```

### 6.6 `true_false` (Analytical Reasoning)
- **`content`**: `{ "statement": "Correlation between two variables necessarily implies that one causes the other." }`
- **`answer`**: `"false"` (or boolean `false`)
- **Example (Data Science Fallacy):**
```json
{
  "type": "concept",
  "interactionType": "true_false",
  "topic": "data_science",
  "difficulty": "easy",
  "question": "Evaluate the validity of the following statement: Correlation between two variables proves a direct causal relationship.",
  "content": {
    "statement": "Correlation between two variables proves a direct causal relationship."
  },
  "answer": "false",
  "explanation": "Correlation indicates a statistical relationship, but does not prove causation due to confounding variables or coincidence."
}
```

---

## 7. Node.js Authoritative Validation Pipeline

When Node.js receives an AI-generated puzzle from FastAPI (or local fallback), it executes the following sequential validation checks before storing in PostgreSQL:

```
FastAPI Response
       │
       ▼
1. Structure Validation (fields exist and are non-empty)
       │
       ▼
2. Domain / Topic Validation (matches supported domains)
       │
       ▼
3. Difficulty Validation (easy | medium | hard)
       │
       ▼
4. Interaction Type Validation (valid interaction model)
       │
       ▼
5. Strict Non-Coding Validation (heuristics + intent scanning)
       │
       ▼
6. Answer Integrity Validation (unambiguous, matches content)
       │
       ▼
7. Content Consistency Validation (no duplicates, valid options)
       │
   ┌───┴────────────────────────┐
   │ PASS                       │ FAIL
   ▼                            ▼
Persist in PostgreSQL        Trigger Retry (max 2 retries)
Return Sanitized to Unity    If all fail -> 502/503 Safe Error
```

### 7.1 Non-Coding Heuristic & Intent Detection
Node.js scans the `question`, `content`, `explanation`, and `answer` fields:
1. **Syntax & Keywords**: Detects code constructs (e.g. `def `, `function(`, `class `, `console.log`, `print(`, `#include`, `public static void`, `SELECT * FROM`).
2. **Task Intent Patterns**: Detects programming instruction prompts (e.g. *"what will this print"*, *"write a script"*, *"debug this"*, *"syntax of"*, *"which python/java/c++/sql function"*, *"algorithm time complexity of code"*).
3. Any detected coding intent causes immediate rejection and triggers regeneration.

---

## 8. Unity Public Sanitization Contract
Unity WebGL receives **only** sanitized puzzle details. Under no circumstances does the client receive correct answers, answer keys, or internal evaluation models.

### Example Sanitized Client Response:
```json
{
  "success": true,
  "data": {
    "id": "pz_1789052680_abc12",
    "questId": "quest_ancient_runes",
    "type": "ordering",
    "interactionType": "ordering",
    "topic": "cloud_computing",
    "difficulty": "medium",
    "question": "Arrange the standard incident response phases in the correct operational sequence.",
    "content": {
      "items": [
        "Preparation",
        "Detection & Analysis",
        "Containment, Eradication & Recovery",
        "Post-Incident Activity"
      ]
    },
    "options": [
      "Preparation",
      "Detection & Analysis",
      "Containment, Eradication & Recovery",
      "Post-Incident Activity"
    ],
    "xpReward": 40,
    "scoreReward": 100,
    "createdAt": "2026-09-10T15:55:00.000Z"
  }
}
```

---

## 9. Server-Side Answer Evaluation Rules
When Unity submits `POST /api/v1/puzzles/:puzzleId/attempt`:
- **`text_input`**: Evaluated after trimming whitespace and normalizing character case. Numerical answers compare mathematically or via normalized digit strings.
- **`ordering`**: Evaluated by checking if the submitted sequence matches the authoritative order index permutation (e.g. `[1, 0, 3, 2]`) or item text sequence.
- **`matching`**: Evaluated by verifying that every submitted key matches its exact target definition.
- **`multiple_choice` / `decision`**: Normalized string comparison against the authoritative choice or index.
- **`true_false`**: Evaluated as normalized boolean string (`"true"` vs `"false"`).
