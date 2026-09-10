const request = require('supertest');
const app = require('../src/app');
const { query, pool } = require('../src/config/database');
const aiService = require('../src/services/aiService');
const puzzleValidator = require('../src/services/puzzleValidator');

describe('Phase 11: AI Puzzle Specification & Generation Contract', () => {
  const timestamp = Date.now();
  let playerToken = null;
  let playerId = null;
  const testQuestId = `quest_spec_${timestamp}`;

  beforeAll(async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `spec_hero_${timestamp}@ascendra.test`,
        password: 'Password123!',
        name: 'Specification Explorer'
      });
    playerToken = regRes.body.data.accessToken;
    playerId = regRes.body.data.user.id;

    await query(
      `INSERT INTO quests (id, title, description, category, difficulty, xp_reward, score_reward, status)
       VALUES ($1, 'The Trial of Concepts', 'Test of diverse knowledge domains.', 'puzzle', 'medium', 150, 300, 'active');`,
      [testQuestId]
    );

    await request(app)
      .post(`/api/v1/quests/${testQuestId}/start`)
      .set('Authorization', `Bearer ${playerToken}`);
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
    await query('DELETE FROM quests WHERE id = $1;', [testQuestId]);
    await pool.end();
  });

  describe('1. Supported Learning Domains Validation', () => {
    it('should validate all canonical educational domains', () => {
      const domains = [
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
        'general_knowledge'
      ];

      domains.forEach(domain => {
        expect(puzzleValidator.SUPPORTED_DOMAINS.has(domain)).toBe(true);
      });
    });

    it('should reject unsupported domain in validation pipeline', () => {
      const invalidPuzzle = {
        topic: 'astrology_and_tarot_123',
        difficulty: 'easy',
        question: 'What is your lucky star today?',
        options: ['Sun', 'Moon'],
        answer: 'Sun'
      };

      expect(() => puzzleValidator.validatePuzzleStructure(invalidPuzzle)).toThrow(
        puzzleValidator.PuzzleValidationError
      );
    });
  });

  describe('2. Strict Non-Coding & Anti-Programming Policy', () => {
    it('should detect and reject explicit code blocks (```python, ```js, etc.)', () => {
      const codingPuzzle = {
        topic: 'artificial_intelligence',
        difficulty: 'medium',
        question: 'What does this function do?\n```python\ndef train(x, y):\n    return model.fit(x, y)\n```',
        options: ['Trains model', 'Evaluates model'],
        answer: 'Trains model'
      };

      expect(() => puzzleValidator.validatePuzzleStructure(codingPuzzle)).toThrow(
        /strictly prohibited/i
      );
    });

    it('should detect and reject programming syntax keywords (def, function, console.log, print, SELECT)', () => {
      const samples = [
        'def compute_weights(data): return data * 2',
        'function evaluateMetric(accuracy) { return accuracy > 0.9; }',
        'console.log("training loss: " + loss);',
        'SELECT * FROM employees WHERE department = "HR";',
        'print("The result is:", total)'
      ];

      samples.forEach(sample => {
        expect(puzzleValidator.isCodingContent(sample)).toBe(true);
      });
    });

    it('should detect and reject programming-task intent without syntax (write a script, debug code, etc.)', () => {
      const taskIntentSamples = [
        'What will this Python program print when executed?',
        'Write a SQL query to retrieve all active user sessions.',
        'Which JavaScript function should you use to sort this array?',
        'Fix the bug in the following binary search logic.',
        'What is the time complexity of the following code?'
      ];

      taskIntentSamples.forEach(intent => {
        expect(puzzleValidator.isCodingContent(intent)).toBe(true);
      });
    });

    it('should accept valid conceptual questions in technical domains without false positives', () => {
      const validTechnicalQuestions = [
        'What is the primary difference between supervised and unsupervised machine learning?',
        'Which cloud architecture pattern ensures zero downtime during region-wide infrastructure failures?',
        'An employee receives an urgent email claiming to be from the CEO requesting gift cards. What attack is this?',
        'Why does a strong statistical correlation not necessarily prove a causal relationship between variables?',
        'What is the operational trade-off of maintaining multiple database replica instances across regions?'
      ];

      validTechnicalQuestions.forEach(q => {
        expect(puzzleValidator.isCodingContent(q)).toBe(false);
      });
    });
  });

  describe('3. Multi-Modal Interaction Types Validation', () => {
    it('should validate and normalize a sequence/pattern puzzle (text_input)', () => {
      const seqPuzzle = {
        type: 'sequence',
        interactionType: 'text_input',
        topic: 'mathematics',
        difficulty: 'easy',
        question: 'What comes next in the sequence: 5, 10, 20, 40, ...?',
        content: {
          sequence: [5, 10, 20, 40],
          prompt: 'Enter the next integer.'
        },
        answer: '80',
        explanation: 'Each term doubles the preceding term.'
      };

      const validated = puzzleValidator.validatePuzzleStructure(seqPuzzle);
      expect(validated.interactionType).toBe('text_input');
      expect(validated.answer).toBe('80');
      expect(validated.content.sequence).toHaveLength(4);
    });

    it('should validate and normalize an ordering puzzle (ordering)', () => {
      const orderPuzzle = {
        type: 'ordering',
        interactionType: 'ordering',
        topic: 'cloud_computing',
        difficulty: 'medium',
        question: 'Arrange the cloud disaster recovery steps in sequence.',
        content: {
          items: ['Detection', 'Failover', 'Verification', 'Failback']
        },
        answer: [0, 1, 2, 3],
        explanation: 'Standard disaster recovery sequence.'
      };

      const validated = puzzleValidator.validatePuzzleStructure(orderPuzzle);
      expect(validated.interactionType).toBe('ordering');
      expect(validated.content.items).toHaveLength(4);
    });

    it('should validate and normalize a matching puzzle (matching)', () => {
      const matchPuzzle = {
        type: 'matching',
        interactionType: 'matching',
        topic: 'cyber_security',
        difficulty: 'medium',
        question: 'Match each security pillar with its goal.',
        content: {
          terms: ['Confidentiality', 'Integrity', 'Availability'],
          definitions: ['Prevent disclosure', 'Prevent alteration', 'Ensure access']
        },
        answer: {
          'Confidentiality': 'Prevent disclosure',
          'Integrity': 'Prevent alteration',
          'Availability': 'Ensure access'
        }
      };

      const validated = puzzleValidator.validatePuzzleStructure(matchPuzzle);
      expect(validated.interactionType).toBe('matching');
    });

    it('should validate and normalize a situational decision puzzle (decision)', () => {
      const decisionPuzzle = {
        type: 'scenario',
        interactionType: 'decision',
        topic: 'interview_preparation',
        difficulty: 'medium',
        question: 'A teammate consistently misses deliverables. What is the most constructive response?',
        content: {
          choices: [
            'Privately discuss the blockers with the teammate and explore how to assist.',
            'Complain to executive leadership immediately.',
            'Ignore the issue completely and let the project fail.',
            'Publicly criticize them during the sprint retro.'
          ]
        },
        answer: 'Privately discuss the blockers with the teammate and explore how to assist.'
      };

      const validated = puzzleValidator.validatePuzzleStructure(decisionPuzzle);
      expect(validated.interactionType).toBe('decision');
      expect(validated.content.choices).toHaveLength(4);
    });

    it('should validate and normalize an analytical true_false puzzle (true_false)', () => {
      const tfPuzzle = {
        type: 'concept',
        interactionType: 'true_false',
        topic: 'data_science',
        difficulty: 'easy',
        question: 'Correlation proves causation between variables.',
        content: {
          statement: 'Correlation proves causation between variables.'
        },
        answer: 'false'
      };

      const validated = puzzleValidator.validatePuzzleStructure(tfPuzzle);
      expect(validated.interactionType).toBe('true_false');
      expect(validated.answer).toBe('false');
    });
  });

  describe('4. Server-Side Multi-Modal Answer Verification', () => {
    it('should accurately evaluate text_input answers with whitespace/case normalization', () => {
      const puzzle = {
        options: { interactionType: 'text_input' },
        correct_answer: 'Photosynthesis'
      };

      expect(puzzleValidator.verifySubmittedAnswer(puzzle, '  photosynthesis  ')).toBe(true);
      expect(puzzleValidator.verifySubmittedAnswer(puzzle, 'PHOTOSYNTHESIS')).toBe(true);
      expect(puzzleValidator.verifySubmittedAnswer(puzzle, 'Respiration')).toBe(false);
    });

    it('should accurately evaluate ordering answers (permutation array)', () => {
      const puzzle = {
        options: { interactionType: 'ordering' },
        correct_answer: JSON.stringify([1, 0, 2])
      };

      expect(puzzleValidator.verifySubmittedAnswer(puzzle, [1, 0, 2])).toBe(true);
      expect(puzzleValidator.verifySubmittedAnswer(puzzle, '[1, 0, 2]')).toBe(true);
      expect(puzzleValidator.verifySubmittedAnswer(puzzle, [0, 1, 2])).toBe(false);
    });

    it('should accurately evaluate matching answers (key-value dictionary)', () => {
      const puzzle = {
        options: { interactionType: 'matching' },
        correct_answer: JSON.stringify({ 'KeyA': 'Val1', 'KeyB': 'Val2' })
      };

      expect(puzzleValidator.verifySubmittedAnswer(puzzle, { 'KeyA': 'Val1', 'KeyB': 'Val2' })).toBe(true);
      expect(puzzleValidator.verifySubmittedAnswer(puzzle, { 'KeyA': 'Wrong', 'KeyB': 'Val2' })).toBe(false);
      expect(puzzleValidator.verifySubmittedAnswer(puzzle, { 'KeyA': 'Val1' })).toBe(false);
    });

    it('should accurately evaluate true_false answers', () => {
      const puzzle = {
        options: { interactionType: 'true_false' },
        correct_answer: 'false'
      };

      expect(puzzleValidator.verifySubmittedAnswer(puzzle, 'false')).toBe(true);
      expect(puzzleValidator.verifySubmittedAnswer(puzzle, false)).toBe(true);
      expect(puzzleValidator.verifySubmittedAnswer(puzzle, 'true')).toBe(false);
    });
  });

  describe('5. AI Service Contract & Retry Behavior', () => {
    it('should retry when AI returns a coding puzzle and succeed on subsequent non-coding attempt', async () => {
      const invalidCodingResponse = {
        data: {
          topic: 'artificial_intelligence',
          difficulty: 'easy',
          question: 'What does this print? ```python\nprint(1+1)\n```',
          options: ['2', '11'],
          correctAnswer: '2'
        }
      };

      const validCleanResponse = {
        data: {
          topic: 'artificial_intelligence',
          difficulty: 'easy',
          type: 'concept',
          interactionType: 'multiple_choice',
          question: 'What is the primary role of a loss function in machine learning?',
          content: {
            options: [
              'Quantifies the error between prediction and actual target',
              'Compiles the source code into bytecode',
              'Manages cloud server memory allocation',
              'Backs up the database transactions'
            ]
          },
          answer: 'Quantifies the error between prediction and actual target',
          explanation: 'A loss function measures model prediction discrepancy.'
        }
      };

      jest.spyOn(aiService.aiClient, 'post')
        .mockResolvedValueOnce(invalidCodingResponse)
        .mockResolvedValueOnce(validCleanResponse);

      const generated = await aiService.requestPuzzleGeneration({
        questId: testQuestId,
        topic: 'artificial_intelligence',
        difficulty: 'easy'
      });

      expect(generated).toBeDefined();
      expect(generated.topic).toBe('artificial_intelligence');
      expect(generated.question).toContain('loss function');
      aiService.aiClient.post.mockRestore();
    });

    it('should exhaust retries and throw safe error if AI consistently returns invalid payloads', async () => {
      const invalidResponse = {
        data: {
          topic: 'invalid_domain_xyz',
          question: 'Broken',
          options: []
        }
      };

      jest.spyOn(aiService.aiClient, 'post').mockResolvedValue(invalidResponse);

      await expect(
        aiService.requestPuzzleGeneration({ questId: testQuestId, topic: 'invalid_domain_xyz' })
      ).rejects.toThrow(aiService.AiServiceError);

      aiService.aiClient.post.mockRestore();
    });
  });

  describe('6. End-to-End API Integration & Unity Sanitization', () => {
    it('should generate an ordering puzzle through API and return strictly sanitized payload to Unity', async () => {
      const orderTemplate = {
        externalPuzzleId: `ai_order_${timestamp}`,
        type: 'ordering',
        interactionType: 'ordering',
        topic: 'cloud_computing',
        difficulty: 'medium',
        question: 'Arrange the cloud deployment verification phases.',
        content: {
          items: ['Build', 'Test', 'Deploy', 'Monitor']
        },
        answer: [0, 1, 2, 3],
        explanation: 'Standard continuous delivery cycle.'
      };

      jest.spyOn(aiService.aiClient, 'post').mockResolvedValueOnce({ data: orderTemplate });

      const res = await request(app)
        .post('/api/v1/puzzles/generate')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          questId: testQuestId,
          topic: 'cloud_computing',
          difficulty: 'medium',
          type: 'ordering',
          interactionType: 'ordering'
        });

      expect(res.status).toBe(201);
      const puzzle = res.body.data;

      // Public fields present
      expect(puzzle.id).toBeDefined();
      expect(puzzle.type).toBe('ordering');
      expect(puzzle.interactionType).toBe('ordering');
      expect(puzzle.topic).toBe('cloud_computing');
      expect(puzzle.content.items).toHaveLength(4);
      expect(Array.isArray(puzzle.options)).toBe(true); // Backwards-compatible options array
      expect(puzzle.options).toEqual(['Build', 'Test', 'Deploy', 'Monitor']);

      // Sensitive fields strictly stripped
      expect(puzzle.correct_answer).toBeUndefined();
      expect(puzzle.correctAnswer).toBeUndefined();
      expect(puzzle.answer).toBeUndefined();
      expect(puzzle.explanation).toBeUndefined();

      aiService.aiClient.post.mockRestore();

      // Verify GET /puzzles/:id also never leaks answer
      const getRes = await request(app)
        .get(`/api/v1/puzzles/${puzzle.id}`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.correct_answer).toBeUndefined();
      expect(getRes.body.data.correctAnswer).toBeUndefined();
      expect(getRes.body.data.answer).toBeUndefined();
      expect(getRes.body.data.explanation).toBeUndefined();

      // Submit attempt for this ordering puzzle
      const attemptRes = await request(app)
        .post(`/api/v1/puzzles/${puzzle.id}/attempt`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ answer: [0, 1, 2, 3] });

      expect(attemptRes.status).toBe(200);
      expect(attemptRes.body.data.correct).toBe(true);
      expect(attemptRes.body.data.reward.xp).toBeGreaterThan(0);
    });
  });
});
