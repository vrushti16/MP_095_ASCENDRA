const axios = require('axios');
const puzzleValidator = require('./puzzleValidator');

class AiServiceError extends Error {
  constructor(message, code = 'AI_SERVICE_ERROR', statusCode = 502) {
    super(message);
    this.name = 'AiServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS, 10) || 5000;
const MAX_RETRIES = 2; // Total 3 attempts allowed

// Axios instance with bounded timeout
const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * Isolated development-only fallback puzzle catalog for when FastAPI is offline locally.
 * Strictly non-coding, covering diverse educational domains and interaction types.
 * Strictly disabled in production.
 */
const DEVELOPMENT_FALLBACK_CATALOG = [
  // 1. Mathematics — Numerical Sequence (text_input)
  {
    externalPuzzleId: 'dev_math_seq_001',
    type: 'sequence',
    interactionType: 'text_input',
    topic: 'mathematics',
    difficulty: 'easy',
    question: 'What is the next number in the pattern: 3, 6, 12, 24, ...?',
    content: {
      sequence: [3, 6, 12, 24],
      prompt: 'Enter the next number in the progression.'
    },
    answer: '48',
    explanation: 'Each number is multiplied by 2 to obtain the subsequent term.'
  },
  // 2. Cyber Security — Situational Decision (decision)
  {
    externalPuzzleId: 'dev_cyber_scenario_002',
    type: 'scenario',
    interactionType: 'decision',
    topic: 'cyber_security',
    difficulty: 'medium',
    question: 'An urgent email from IT asks you to verify your corporate credentials at a shortened URL. What is the most secure response?',
    content: {
      context: 'You receive an unexpected password expiration warning with an external link.',
      choices: [
        'Report the suspicious email directly to the internal security team through official channels.',
        'Click the link and inspect the certificate in your browser.',
        'Reply to the email asking the sender to prove their identity.',
        'Forward the email to your personal account to test it safely.'
      ]
    },
    answer: 'Report the suspicious email directly to the internal security team through official channels.',
    explanation: 'Never interact with suspicious links or reply to potential phishing senders; report immediately to designated security personnel.'
  },
  // 3. Cloud Computing — Process Ordering (ordering)
  {
    externalPuzzleId: 'dev_cloud_order_003',
    type: 'ordering',
    interactionType: 'ordering',
    topic: 'cloud_computing',
    difficulty: 'medium',
    question: 'Arrange the cloud disaster recovery phases in the correct operational sequence.',
    content: {
      items: [
        'Disaster Event Detection',
        'Failover to Secondary Region',
        'Data Verification & Consistency Check',
        'Failback to Primary Region'
      ]
    },
    answer: [0, 1, 2, 3],
    explanation: 'Teams first detect the outage, initiate failover to the replica, verify data integrity, and later failback once the primary is restored.'
  },
  // 4. Artificial Intelligence — Concept Matching (matching)
  {
    externalPuzzleId: 'dev_ai_match_004',
    type: 'matching',
    interactionType: 'matching',
    topic: 'artificial_intelligence',
    difficulty: 'medium',
    question: 'Match each foundational AI concept with its primary mechanism.',
    content: {
      terms: ['Supervised Learning', 'Unsupervised Learning', 'Reinforcement Learning'],
      definitions: [
        'Learns patterns from unlabeled data clusters',
        'Trained using labeled input-output pairs',
        'Learns optimal policies through rewards and penalties'
      ]
    },
    answer: {
      'Supervised Learning': 'Trained using labeled input-output pairs',
      'Unsupervised Learning': 'Learns patterns from unlabeled data clusters',
      'Reinforcement Learning': 'Learns optimal policies through rewards and penalties'
    },
    explanation: 'Supervised relies on labels, unsupervised discovers inherent structures, and reinforcement optimizes actions via feedback.'
  },
  // 5. Data Science — Statistical Fallacy (true_false)
  {
    externalPuzzleId: 'dev_ds_tf_005',
    type: 'concept',
    interactionType: 'true_false',
    topic: 'data_science',
    difficulty: 'easy',
    question: 'Evaluate the following analytical statement: A strong statistical correlation between two variables proves that one causes the other.',
    content: {
      statement: 'A strong statistical correlation between two variables proves that one causes the other.'
    },
    answer: 'false',
    explanation: 'Correlation does not imply causation; confounding factors or spurious relationships may account for the observed association.'
  },
  // 6. Interview Preparation — Behavioral STAR Technique (multiple_choice)
  {
    externalPuzzleId: 'dev_interview_mc_006',
    type: 'concept',
    interactionType: 'multiple_choice',
    topic: 'interview_preparation',
    difficulty: 'easy',
    question: 'In the STAR behavioral interview framework, what does the "A" stand for?',
    content: {
      options: [
        'Action taken to resolve the challenge',
        'Assessment of personal strengths',
        'Agreement reached with management',
        'Achievement recognized by awards'
      ]
    },
    answer: 'Action taken to resolve the challenge',
    explanation: 'STAR stands for Situation, Task, Action, and Result.'
  },
  // 7. Logical Reasoning — Deduction Riddle (text_input)
  {
    externalPuzzleId: 'dev_logic_riddle_007',
    type: 'riddle',
    interactionType: 'text_input',
    topic: 'logical_reasoning',
    difficulty: 'easy',
    question: 'I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?',
    content: {
      prompt: 'Enter the single word answer.'
    },
    answer: 'map',
    explanation: 'A map depicts geographical features such as cities, mountains, and water bodies symbolically.'
  }
];

/**
 * Filter or select a matching fallback puzzle from the development catalog.
 */
function getDevelopmentFallbackPuzzle({ topic, difficulty, type, interactionType }) {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const normalizedTopic = topic ? String(topic).trim().toLowerCase().replace(/[\s-]+/g, '_') : null;
  const normalizedInteraction = interactionType ? String(interactionType).trim().toLowerCase() : null;

  // Try matching by topic or interaction type
  let matches = DEVELOPMENT_FALLBACK_CATALOG.filter(p => {
    if (normalizedTopic && p.topic === normalizedTopic) return true;
    if (normalizedInteraction && p.interactionType === normalizedInteraction) return true;
    return false;
  });

  if (matches.length === 0) {
    matches = DEVELOPMENT_FALLBACK_CATALOG;
  }

  const selected = matches[Math.floor(Math.random() * matches.length)];
  return { ...selected };
}

// In-memory telemetry circular buffer for immediate retrieval and offline resilience
const MAX_TELEMETRY_BUFFER = 50;
const telemetryBuffer = [];

/**
 * Record an AI generation request outcome to memory and database
 */
async function recordAiTelemetry({ questId, topic, difficulty, status, latencyMs, isFallback = false, errorMessage = null }) {
  const record = {
    id: `telemetry_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    questId: questId || null,
    topic: topic || 'general',
    difficulty: difficulty || 'easy',
    status, // 'success' | 'validation_failed' | 'service_error' | 'fallback_used'
    latencyMs: Math.max(0, Math.round(latencyMs || 0)),
    isFallback: Boolean(isFallback),
    errorMessage: errorMessage ? String(errorMessage).substring(0, 500) : null,
    createdAt: new Date().toISOString()
  };

  telemetryBuffer.unshift(record);
  if (telemetryBuffer.length > MAX_TELEMETRY_BUFFER) {
    telemetryBuffer.pop();
  }

  // Attempt database persistence asynchronously (never throws)
  try {
    const database = require('../config/database');
    await database.query(
      `INSERT INTO ai_telemetry (quest_id, topic, difficulty, status, latency_ms, is_fallback, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [record.questId, record.topic, record.difficulty, record.status, record.latencyMs, record.isFallback, record.errorMessage]
    );
  } catch (err) {
    // Graceful fallback to in-memory buffer if DB table is unmigrated or unreachable
  }

  return record;
}

/**
 * Retrieve aggregated AI telemetry metrics and recent request history
 */
async function getAiTelemetry() {
  let dbRows = [];
  let dbAvailable = false;

  try {
    const database = require('../config/database');
    const res = await database.query(
      `SELECT id, quest_id AS "questId", topic, difficulty, status, latency_ms AS "latencyMs",
              is_fallback AS "isFallback", error_message AS "errorMessage", created_at AS "createdAt"
       FROM ai_telemetry
       ORDER BY created_at DESC
       LIMIT 50;`
    );
    dbRows = res.rows;
    dbAvailable = true;
  } catch (err) {
    dbAvailable = false;
  }

  // Use database rows if available; otherwise use in-memory buffer
  const sourceRecords = dbAvailable && dbRows.length > 0 ? dbRows : telemetryBuffer;

  const totalRequests = sourceRecords.length;
  let successfulRequests = 0;
  let validationFailures = 0;
  let serviceErrors = 0;
  let fallbackUsage = 0;
  let totalLatency = 0;

  for (const r of sourceRecords) {
    totalLatency += (r.latencyMs || 0);
    if (r.status === 'success') successfulRequests++;
    else if (r.status === 'validation_failed') validationFailures++;
    else if (r.status === 'service_error') serviceErrors++;
    else if (r.status === 'fallback_used') fallbackUsage++;

    if (r.isFallback) fallbackUsage++;
  }

  const averageLatencyMs = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;

  return {
    summary: {
      totalRequests,
      successfulRequests,
      validationFailures,
      serviceErrors,
      fallbackUsage,
      averageLatencyMs
    },
    recentRequests: sourceRecords.slice(0, 20),
    storageSource: dbAvailable && dbRows.length > 0 ? 'postgresql' : 'in_memory_buffer'
  };
}

/**
 * Request puzzle generation from Developer B's FastAPI AI Service.
 * Runs response through the authoritative puzzleValidator pipeline.
 * Retries up to MAX_RETRIES if the AI returns malformed structure or prohibited coding content.
 *
 * @param {object} params
 * @param {string} [params.questId] - Associated quest ID
 * @param {string} [params.topic="general"] - Knowledge domain
 * @param {string} [params.difficulty="easy"] - "easy" | "medium" | "hard"
 * @param {string} [params.type="multiple_choice"] - Educational puzzle category
 * @param {string} [params.interactionType] - Player interaction model
 * @returns {Promise<object>} Validated canonical puzzle specification
 */
async function requestPuzzleGeneration({ questId, topic = 'general', difficulty = 'easy', type = 'multiple_choice', interactionType = null }) {
  const payload = {
    questId: questId || null,
    topic,
    difficulty,
    type,
    interactionType
  };

  let lastError = null;
  const requestStartTime = Date.now();
  let isFallbackUsed = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const attemptStartTime = Date.now();
    try {
      let rawData = null;

      try {
        const response = await aiClient.post('/api/v1/ai/puzzles/generate', payload);
        rawData = response.data;
      } catch (httpErr) {
        // If FastAPI service is completely unreachable or timed out
        if (httpErr.code === 'ECONNREFUSED' || httpErr.code === 'ETIMEDOUT' || httpErr.code === 'ENOTFOUND') {
          const fallback = getDevelopmentFallbackPuzzle({ topic, difficulty, type, interactionType });
          if (fallback) {
            console.warn('⚠️ [AI SERVICE WARNING] FastAPI service unreachable. Using isolated local dev mock template.');
            rawData = fallback;
            isFallbackUsed = true;
          } else {
            recordAiTelemetry({
              questId,
              topic,
              difficulty,
              status: 'service_error',
              latencyMs: Date.now() - attemptStartTime,
              errorMessage: httpErr.message
            });
            throw new AiServiceError('AI Puzzle Generation Service is currently unavailable.', 'AI_SERVICE_UNAVAILABLE', 503);
          }
        } else {
          recordAiTelemetry({
            questId,
            topic,
            difficulty,
            status: 'service_error',
            latencyMs: Date.now() - attemptStartTime,
            errorMessage: httpErr.message
          });
          throw httpErr;
        }
      }

      // Authoritative Node.js validation pipeline
      const validatedPuzzle = puzzleValidator.validatePuzzleStructure(rawData);

      // Record successful telemetry
      recordAiTelemetry({
        questId,
        topic,
        difficulty,
        status: isFallbackUsed ? 'fallback_used' : 'success',
        latencyMs: Date.now() - requestStartTime,
        isFallback: isFallbackUsed
      });

      return validatedPuzzle;
    } catch (err) {
      lastError = err;
      if (err.name === 'PuzzleValidationError') {
        console.warn(`⚠️ [AI VALIDATION ATTEMPT ${attempt + 1} FAILED]: ${err.message}. Retrying...`);
        recordAiTelemetry({
          questId,
          topic,
          difficulty,
          status: 'validation_failed',
          latencyMs: Date.now() - attemptStartTime,
          errorMessage: err.message
        });
        // Retry loop continues
        continue;
      }

      // If it's a connection failure or service error, rethrow or retry
      if (attempt === MAX_RETRIES) {
        break;
      }
    }
  }

  // If retries exhausted
  const message = lastError ? lastError.message : 'AI puzzle generation failed validation after multiple attempts';
  recordAiTelemetry({
    questId,
    topic,
    difficulty,
    status: 'service_error',
    latencyMs: Date.now() - requestStartTime,
    errorMessage: message
  });

  throw new AiServiceError(`AI puzzle generation failed: ${message}`, 'AI_GENERATION_FAILED', 502);
}

module.exports = {
  AiServiceError,
  aiClient,
  DEVELOPMENT_FALLBACK_CATALOG,
  getDevelopmentFallbackPuzzle,
  requestPuzzleGeneration,
  recordAiTelemetry,
  getAiTelemetry,
  telemetryBuffer
};
