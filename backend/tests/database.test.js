const { query, pool } = require('../src/config/database');

describe('PostgreSQL Database Connection and Schema Operations', () => {
  const testEmail = `test_player_${Date.now()}@ascendra.game`;
  let createdUserId = null;

  afterAll(async () => {
    // Clean up test data if any remains
    if (createdUserId) {
      await query('DELETE FROM users WHERE id = $1;', [createdUserId]);
    }
    await pool.end();
  });

  it('should successfully execute a simple test query', async () => {
    const res = await query('SELECT 1 + 1 AS result;');
    expect(res.rows[0].result).toBe(2);
  });

  it('should create a user and linked player_profile', async () => {
    // 1. Insert user
    const userRes = await query(
      `INSERT INTO users (email, name, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, role, created_at;`,
      [testEmail, 'Sir Ascend', 'player']
    );

    expect(userRes.rows.length).toBe(1);
    createdUserId = userRes.rows[0].id;
    expect(userRes.rows[0].email).toBe(testEmail);
    expect(userRes.rows[0].role).toBe('player');
    expect(createdUserId).toBeDefined();

    // 2. Insert linked player profile
    const profileRes = await query(
      `INSERT INTO player_profiles (user_id, level, experience, score)
       VALUES ($1, 1, 0, 0)
       RETURNING id, user_id, level, experience, score, health, max_health;`,
      [createdUserId]
    );

    expect(profileRes.rows.length).toBe(1);
    expect(profileRes.rows[0].user_id).toBe(createdUserId);
    expect(profileRes.rows[0].level).toBe(1);
    expect(profileRes.rows[0].health).toBe(100);
  });

  it('should enforce unique constraint on email', async () => {
    await expect(
      query(
        `INSERT INTO users (email, name) VALUES ($1, $2);`,
        [testEmail, 'Duplicate User']
      )
    ).rejects.toThrow();
  });

  it('should cascade delete player_profile when user is deleted', async () => {
    // Delete the test user
    await query('DELETE FROM users WHERE id = $1;', [createdUserId]);

    // Profile should automatically be removed via ON DELETE CASCADE
    const profileCheck = await query(
      'SELECT * FROM player_profiles WHERE user_id = $1;',
      [createdUserId]
    );
    expect(profileCheck.rows.length).toBe(0);

    // Reset createdUserId so afterAll doesn't fail
    createdUserId = null;
  });
});
