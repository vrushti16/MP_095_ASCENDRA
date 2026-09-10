class PuzzleValidationError extends Error {
  constructor(message, code = 'PUZZLE_VALIDATION_ERROR', statusCode = 400) {
    super(message);
    this.name = 'PuzzleValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Canonical set of supported learning domains in ASCENDRA
 */
const SUPPORTED_DOMAINS = new Set([
  'aptitude',
  'english',
  'artificial_intelligence',
  'mathematics',
  'interview_preparation',
  'cloud_computing',
  'cyber_security',
  'data_science',
  'logical_reasoning',
  'critical_thinking',
  'communication_skills',
  'problem_solving',
  'quantitative_reasoning',
  'verbal_reasoning',
  'general_knowledge',
  'general' // Legacy backwards-compatibility
]);

/**
 * Canonical set of supported player interaction models
 */
const SUPPORTED_INTERACTION_TYPES = new Set([
  'multiple_choice',
  'text_input',
  'ordering',
  'matching',
  'decision',
  'true_false'
]);

/**
 * Non-Coding Detection Patterns:
 * 1. Code block markers and language tags
 * 2. Programming syntax keywords and API constructs
 * 3. Programming-task intent patterns (asking to write/debug/trace code)
 */
const CODE_SYNTAX_PATTERNS = [
  /```(python|javascript|js|ts|typescript|java|c\+\+|cpp|c#|sql|bash|sh|ruby|go|rust|php)/i,
  /```[\s\S]*?```/,
  /\bdef\s+[a-zA-Z0-9_]+\s*\(/i,
  /\bfunction\s*[a-zA-Z0-9_]*\s*\(/i,
  /\bconsole\.log\s*\(/i,
  /\bprint\s*\(/i,
  /#include\s*<[a-zA-Z0-9_.]+>/i,
  /\bpublic\s+(static\s+)?(void|class|int|String)\b/i,
  /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP\s+TABLE|CREATE\s+TABLE)\b[\s\S]*?\b(FROM|WHERE|SET|VALUES)\b/i,
  /\bimport\s+(numpy|pandas|react|express|tensorflow|torch|sklearn|flask)\b/i,
  /\b(const|let|var)\s+[a-zA-Z0-9_]+\s*=/i,
  /\bfor\s*\(\s*(let|var|int)\s+[a-zA-Z0-9_]+\s*=/i,
  /\bwhile\s*\([^)]*\)\s*\{/i
];

const PROGRAMMING_TASK_INTENT_PATTERNS = [
  /\bwhat\s+(will|does)\s+this\s+.*(code|program|script|function|snippet|query)\s+(output|print|return|do)\b/i,
  /\b(write|create)\s+(a\s+)?.*(code|script|query|program|function|algorithm)\b/i,
  /\bwhich\s+.*(function|method|library|syntax|keyword|command|operator|api)\s+(should|would|to|can|is\s+used)\b/i,
  /\bfix\s+the\s+(bug|error|syntax|issue)\b/i,
  /\bpredict\s+the\s+(output|result)\s+of\b/i,
  /\bwhat\s+is\s+the\s+(time|space)\s+complexity\s+of\s+.*(code|function|algorithm|implementation|logic|snippet)\b/i,
  /\bimplement\s+.*(in\s+code|in\s+python|in\s+java|in\s+javascript|in\s+c\+\+|in\s+sql)\b/i,
  /\bwhat\s+does\s+(this|the\s+following)\s+.*(code|snippet|query|script)\s+evaluate\s+to\b/i,
  /\bcomplete\s+the\s+missing\s+(code|line\s+of\s+code|syntax)\b/i,
  /\b(python|javascript|java|c\+\+|sql|typescript|bash|golang|rust)\s+(program|code|snippet|script|query)\s+(prints?|outputs?|returns?)\b/i
];

/**
 * Scan text to detect coding syntax or programming-task intent.
 * Returns true if coding content is detected.
 *
 * @param {string} text - String content to inspect
 * @returns {boolean} True if prohibited coding content is found
 */
function isCodingContent(text) {
  if (!text || typeof text !== 'string') return false;

  for (const pattern of CODE_SYNTAX_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  for (const pattern of PROGRAMMING_TASK_INTENT_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Recursively scan all text values in a puzzle payload for coding content.
 * @param {object} puzzle
 * @returns {boolean} True if any field contains coding content
 */
function scanPuzzleForCoding(puzzle) {
  if (!puzzle) return false;

  const stringsToScan = [];

  function collectStrings(obj) {
    if (!obj) return;
    if (typeof obj === 'string') {
      stringsToScan.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(collectStrings);
    } else if (typeof obj === 'object') {
      Object.values(obj).forEach(collectStrings);
    }
  }

  collectStrings(puzzle.question);
  collectStrings(puzzle.content);
  collectStrings(puzzle.options);
  collectStrings(puzzle.explanation);
  collectStrings(puzzle.answer);
  collectStrings(puzzle.correctAnswer);

  return stringsToScan.some(isCodingContent);
}

/**
 * Authoritative Validation Pipeline for AI-generated puzzles.
 * Validates structure, domain, difficulty, interactionType, non-coding constraint,
 * and answer integrity.
 *
 * @param {object} puzzle - Incoming AI puzzle payload
 * @returns {object} Normalized, validated puzzle specification
 * @throws {PuzzleValidationError} If puzzle fails any quality or safety criteria
 */
function validatePuzzleStructure(puzzle) {
  if (!puzzle || typeof puzzle !== 'object') {
    throw new PuzzleValidationError('Puzzle payload must be a valid JSON object', 'INVALID_PAYLOAD');
  }

  // 1. Validate Question
  if (!puzzle.question || typeof puzzle.question !== 'string' || puzzle.question.trim().length < 5) {
    throw new PuzzleValidationError('Puzzle question must be a descriptive string', 'INVALID_QUESTION');
  }

  // 2. Validate Domain / Topic
  const normalizedTopic = String(puzzle.topic || 'general').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!SUPPORTED_DOMAINS.has(normalizedTopic)) {
    throw new PuzzleValidationError(
      `Unsupported topic '${puzzle.topic}'. Must be one of: ${Array.from(SUPPORTED_DOMAINS).join(', ')}`,
      'UNSUPPORTED_TOPIC'
    );
  }

  // 3. Validate Difficulty
  const normalizedDifficulty = String(puzzle.difficulty || 'easy').trim().toLowerCase();
  if (!['easy', 'medium', 'hard'].includes(normalizedDifficulty)) {
    throw new PuzzleValidationError("Difficulty must be 'easy', 'medium', or 'hard'", 'INVALID_DIFFICULTY');
  }

  // 4. Validate Interaction Type & Content
  let interactionType = puzzle.interactionType;
  if (!interactionType) {
    // Infer interaction type from legacy structure or content
    if (Array.isArray(puzzle.options) && puzzle.options.length > 0) {
      interactionType = 'multiple_choice';
    } else {
      interactionType = 'multiple_choice';
    }
  }
  interactionType = String(interactionType).trim().toLowerCase();

  if (!SUPPORTED_INTERACTION_TYPES.has(interactionType)) {
    throw new PuzzleValidationError(
      `Unsupported interactionType '${interactionType}'. Must be one of: ${Array.from(SUPPORTED_INTERACTION_TYPES).join(', ')}`,
      'INVALID_INTERACTION_TYPE'
    );
  }

  // 5. Strict Non-Coding Check
  if (scanPuzzleForCoding(puzzle)) {
    throw new PuzzleValidationError(
      'Coding/programming questions are strictly prohibited in ASCENDRA puzzles.',
      'CODING_PUZZLE_REJECTED',
      422
    );
  }

  // 6. Normalize Content according to Interaction Type
  const content = puzzle.content && typeof puzzle.content === 'object' ? { ...puzzle.content } : {};

  // Resolve answer from answer or correctAnswer
  const rawAnswer = puzzle.answer !== undefined ? puzzle.answer : puzzle.correctAnswer;
  if (rawAnswer === undefined || rawAnswer === null || (typeof rawAnswer === 'string' && rawAnswer.trim() === '')) {
    throw new PuzzleValidationError('Puzzle must provide a valid authoritative answer', 'MISSING_ANSWER');
  }

  // Specific content and answer validation by interaction model
  switch (interactionType) {
    case 'multiple_choice': {
      const options = Array.isArray(content.options)
        ? content.options
        : (Array.isArray(puzzle.options) ? puzzle.options : []);

      if (!Array.isArray(options) || options.length < 2) {
        throw new PuzzleValidationError('Multiple choice puzzle requires at least 2 options', 'INVALID_OPTIONS');
      }

      // Check for duplicate options
      const normalizedOpts = options.map(o => String(o).trim().toLowerCase());
      if (new Set(normalizedOpts).size !== options.length) {
        throw new PuzzleValidationError('Multiple choice options must be unique', 'DUPLICATE_OPTIONS');
      }

      content.options = options.map(o => String(o).trim());

      // Validate answer belongs to options (string or index)
      const answerStr = String(rawAnswer).trim().toLowerCase();
      const answerIndex = parseInt(rawAnswer, 10);
      const isIndexValid = !isNaN(answerIndex) && answerIndex >= 0 && answerIndex < options.length;
      const isStringValid = normalizedOpts.includes(answerStr);

      if (!isIndexValid && !isStringValid) {
        throw new PuzzleValidationError('Multiple choice answer does not match any available option', 'ANSWER_MISMATCH');
      }
      break;
    }

    case 'ordering': {
      if (!Array.isArray(content.items) || content.items.length < 2) {
        throw new PuzzleValidationError('Ordering puzzle requires at least 2 items in content.items', 'INVALID_ORDERING_ITEMS');
      }
      content.items = content.items.map(it => String(it).trim());

      // Validate answer is an array of indices or ordered strings
      let orderAnswer = rawAnswer;
      if (typeof orderAnswer === 'string') {
        try {
          orderAnswer = JSON.parse(orderAnswer);
        } catch (e) {
          // treat as comma-separated or keep raw
        }
      }

      if (!Array.isArray(orderAnswer) || orderAnswer.length !== content.items.length) {
        throw new PuzzleValidationError(
          `Ordering answer must be an array of length ${content.items.length}`,
          'INVALID_ORDERING_ANSWER'
        );
      }
      break;
    }

    case 'matching': {
      if (!Array.isArray(content.terms) || !Array.isArray(content.definitions) || content.terms.length < 2) {
        throw new PuzzleValidationError('Matching puzzle requires content.terms and content.definitions arrays', 'INVALID_MATCHING_CONTENT');
      }
      let matchAnswer = rawAnswer;
      if (typeof matchAnswer === 'string') {
        try {
          matchAnswer = JSON.parse(matchAnswer);
        } catch (e) {
          throw new PuzzleValidationError('Matching answer must be a valid term-to-definition mapping object', 'INVALID_MATCHING_ANSWER');
        }
      }
      if (typeof matchAnswer !== 'object' || matchAnswer === null || Array.isArray(matchAnswer)) {
        throw new PuzzleValidationError('Matching answer must be a mapping object', 'INVALID_MATCHING_ANSWER');
      }
      break;
    }

    case 'decision': {
      const choices = Array.isArray(content.choices)
        ? content.choices
        : (Array.isArray(puzzle.options) ? puzzle.options : []);

      if (!Array.isArray(choices) || choices.length < 2) {
        throw new PuzzleValidationError('Decision puzzle requires at least 2 choices in content.choices', 'INVALID_DECISION_CHOICES');
      }
      content.choices = choices.map(c => String(c).trim());
      break;
    }

    case 'true_false': {
      const ansLower = String(rawAnswer).trim().toLowerCase();
      if (!['true', 'false'].includes(ansLower)) {
        throw new PuzzleValidationError("True/False puzzle answer must be 'true' or 'false'", 'INVALID_TRUE_FALSE_ANSWER');
      }
      break;
    }

    case 'text_input':
    default: {
      if (typeof rawAnswer !== 'string' && typeof rawAnswer !== 'number') {
        throw new PuzzleValidationError('Text input puzzle answer must be a string or number', 'INVALID_TEXT_ANSWER');
      }
      break;
    }
  }

  return {
    externalPuzzleId: puzzle.externalPuzzleId || `ai_${Date.now()}`,
    type: puzzle.type || interactionType,
    interactionType,
    topic: normalizedTopic,
    difficulty: normalizedDifficulty,
    question: puzzle.question.trim(),
    content,
    answer: typeof rawAnswer === 'object' ? JSON.stringify(rawAnswer) : String(rawAnswer).trim(),
    explanation: puzzle.explanation ? String(puzzle.explanation).trim() : null
  };
}

/**
 * Authoritative Server-Side Answer Evaluator.
 * Compares player submitted answer with stored puzzle answer according to interaction model.
 *
 * @param {object} puzzle - Loaded puzzle record from database (includes correct_answer and options/content)
 * @param {*} submittedAnswer - Raw answer submitted by client
 * @returns {boolean} True if the answer is completely correct
 */
function verifySubmittedAnswer(puzzle, submittedAnswer) {
  if (submittedAnswer === undefined || submittedAnswer === null) {
    return false;
  }

  // Resolve interaction type from puzzle content or options
  let interactionType = 'multiple_choice';
  let content = {};

  if (puzzle.options) {
    if (typeof puzzle.options === 'object' && !Array.isArray(puzzle.options)) {
      interactionType = puzzle.options.interactionType || 'multiple_choice';
      content = puzzle.options.content || {};
    } else if (Array.isArray(puzzle.options)) {
      interactionType = 'multiple_choice';
      content = { options: puzzle.options };
    }
  }

  const expectedAnswer = puzzle.correct_answer;

  switch (interactionType) {
    case 'text_input': {
      const normSubmitted = String(submittedAnswer).trim().toLowerCase().replace(/\s+/g, ' ');
      const normExpected = String(expectedAnswer).trim().toLowerCase().replace(/\s+/g, ' ');
      return normSubmitted === normExpected;
    }

    case 'true_false': {
      const normSubmitted = String(submittedAnswer).trim().toLowerCase();
      const normExpected = String(expectedAnswer).trim().toLowerCase();
      return (normSubmitted === 'true' && normExpected === 'true') ||
             (normSubmitted === 'false' && normExpected === 'false');
    }

    case 'decision':
    case 'multiple_choice': {
      const normSubmitted = String(submittedAnswer).trim().toLowerCase();
      const normExpected = String(expectedAnswer).trim().toLowerCase();

      // Direct string equality
      if (normSubmitted === normExpected) return true;

      // Handle 0-indexed choice submissions
      const subIdx = parseInt(submittedAnswer, 10);
      const options = content.options || content.choices || [];
      if (!isNaN(subIdx) && subIdx >= 0 && subIdx < options.length) {
        if (String(options[subIdx]).trim().toLowerCase() === normExpected) {
          return true;
        }
      }

      // Handle expected answer as index
      const expIdx = parseInt(expectedAnswer, 10);
      if (!isNaN(expIdx) && expIdx >= 0 && expIdx < options.length) {
        if (String(options[expIdx]).trim().toLowerCase() === normSubmitted) {
          return true;
        }
      }

      return false;
    }

    case 'ordering': {
      let subArr = submittedAnswer;
      if (typeof subArr === 'string') {
        try {
          subArr = JSON.parse(subArr);
        } catch (e) {
          subArr = subArr.split(',').map(s => s.trim());
        }
      }

      let expArr = expectedAnswer;
      if (typeof expArr === 'string') {
        try {
          expArr = JSON.parse(expArr);
        } catch (e) {
          expArr = expArr.split(',').map(s => s.trim());
        }
      }

      if (!Array.isArray(subArr) || !Array.isArray(expArr) || subArr.length !== expArr.length) {
        return false;
      }

      // Check element-by-element equality
      return subArr.every((val, idx) => String(val).trim().toLowerCase() === String(expArr[idx]).trim().toLowerCase());
    }

    case 'matching': {
      let subObj = submittedAnswer;
      if (typeof subObj === 'string') {
        try {
          subObj = JSON.parse(subObj);
        } catch (e) {
          return false;
        }
      }

      let expObj = expectedAnswer;
      if (typeof expObj === 'string') {
        try {
          expObj = JSON.parse(expObj);
        } catch (e) {
          return false;
        }
      }

      if (typeof subObj !== 'object' || typeof expObj !== 'object' || subObj === null || expObj === null) {
        return false;
      }

      const expKeys = Object.keys(expObj);
      const subKeys = Object.keys(subObj);
      if (expKeys.length !== subKeys.length) return false;

      return expKeys.every(k => {
        const matchingSubKey = subKeys.find(sk => sk.trim().toLowerCase() === k.trim().toLowerCase());
        if (!matchingSubKey) return false;
        return String(subObj[matchingSubKey]).trim().toLowerCase() === String(expObj[k]).trim().toLowerCase();
      });
    }

    default: {
      return String(submittedAnswer).trim().toLowerCase() === String(expectedAnswer).trim().toLowerCase();
    }
  }
}

module.exports = {
  PuzzleValidationError,
  SUPPORTED_DOMAINS,
  SUPPORTED_INTERACTION_TYPES,
  isCodingContent,
  scanPuzzleForCoding,
  validatePuzzleStructure,
  verifySubmittedAnswer
};
