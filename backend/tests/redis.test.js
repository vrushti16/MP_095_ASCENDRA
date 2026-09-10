const redisConfig = require('../src/config/redis');
const cacheService = require('../src/services/cacheService');

describe('Redis Configuration & Cache Service Unit Tests', () => {
  describe('Redis Configuration Module', () => {
    it('should export required methods and attributes', () => {
      expect(typeof redisConfig.getRedisClient).toBe('function');
      expect(typeof redisConfig.connectRedis).toBe('function');
      expect(typeof redisConfig.isRedisAvailable).toBe('function');
      expect(typeof redisConfig.testRedisConnection).toBe('function');
      expect(typeof redisConfig.disconnectRedis).toBe('function');
    });

    it('should return boolean state for isRedisAvailable', () => {
      const available = redisConfig.isRedisAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should report fallbackState and status when Redis is unavailable', async () => {
      // Mock isRedisAvailable to false
      const spy = jest.spyOn(redisConfig, 'isRedisAvailable').mockReturnValueOnce(false);

      const health = await redisConfig.testRedisConnection();
      expect(health.ok).toBe(false);
      expect(health.status).toBe('unavailable');
      expect(health.fallbackState).toBe('cache_bypass');
      expect(health.latencyMs).toBeNull();

      spy.mockRestore();
    });

    it('should report healthy status when client responds to PING', async () => {
      const mockClient = {
        isOpen: true,
        ping: jest.fn().mockResolvedValue('PONG')
      };

      const spyAvailable = jest.spyOn(redisConfig, 'isRedisAvailable').mockReturnValueOnce(true);
      const spyClient = jest.spyOn(redisConfig, 'getRedisClient').mockReturnValueOnce(mockClient);

      const health = await redisConfig.testRedisConnection();
      expect(health.ok).toBe(true);
      expect(health.status).toBe('healthy');
      expect(health.fallbackState).toBe('none');
      expect(typeof health.latencyMs).toBe('number');

      spyAvailable.mockRestore();
      spyClient.mockRestore();
    });

    it('should gracefully handle ping failure when testing connection', async () => {
      const mockClient = {
        isOpen: true,
        ping: jest.fn().mockRejectedValue(new Error('Connection timeout'))
      };

      const spyAvailable = jest.spyOn(redisConfig, 'isRedisAvailable').mockReturnValueOnce(true);
      const spyClient = jest.spyOn(redisConfig, 'getRedisClient').mockReturnValueOnce(mockClient);

      const health = await redisConfig.testRedisConnection();
      expect(health.ok).toBe(false);
      expect(health.status).toBe('unavailable');
      expect(health.fallbackState).toBe('cache_bypass');
      expect(health.error).toBe('Connection timeout');

      spyAvailable.mockRestore();
      spyClient.mockRestore();
    });
  });

  describe('Cache Service — Graceful Fallback Mode (Redis Unavailable)', () => {
    beforeEach(() => {
      jest.spyOn(redisConfig, 'isRedisAvailable').mockReturnValue(false);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('get() should return null on cache miss / Redis unavailable without throwing', async () => {
      const value = await cacheService.get('test_key');
      expect(value).toBeNull();
    });

    it('set() should return false when Redis is unavailable without throwing', async () => {
      const success = await cacheService.set('test_key', { data: 'test' }, 60);
      expect(success).toBe(false);
    });

    it('del() should return false when Redis is unavailable without throwing', async () => {
      const deleted = await cacheService.del('test_key');
      expect(deleted).toBe(false);
    });

    it('invalidate() should return 0 when Redis is unavailable without throwing', async () => {
      const count = await cacheService.invalidate('test_*');
      expect(count).toBe(0);
    });

    it('exists() should return false when Redis is unavailable without throwing', async () => {
      const doesExist = await cacheService.exists('test_key');
      expect(doesExist).toBe(false);
    });
  });

  describe('Cache Service — Operations (Redis Mocked/Available)', () => {
    let mockStore;
    let mockClient;

    beforeEach(() => {
      mockStore = new Map();
      mockClient = {
        isOpen: true,
        get: jest.fn().mockImplementation(async (key) => mockStore.get(key) || null),
        set: jest.fn().mockImplementation(async (key, val) => {
          mockStore.set(key, val);
          return 'OK';
        }),
        del: jest.fn().mockImplementation(async (keyOrKeys) => {
          const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
          let removed = 0;
          for (const k of keys) {
            if (mockStore.delete(k)) removed++;
          }
          return removed;
        }),
        exists: jest.fn().mockImplementation(async (key) => (mockStore.has(key) ? 1 : 0)),
        scanIterator: jest.fn().mockImplementation(async function* ({ MATCH }) {
          const prefix = MATCH.replace('*', '');
          for (const k of mockStore.keys()) {
            if (k.startsWith(prefix)) yield k;
          }
        })
      };

      jest.spyOn(redisConfig, 'isRedisAvailable').mockReturnValue(true);
      jest.spyOn(redisConfig, 'getRedisClient').mockReturnValue(mockClient);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should format keys with ascendra: prefix', () => {
      expect(cacheService.formatKey('test')).toBe('ascendra:test');
      expect(cacheService.formatKey('ascendra:already_prefixed')).toBe('ascendra:already_prefixed');
    });

    it('should set, retrieve, and deserialize complex JSON objects', async () => {
      const testData = { id: 'quest_01', score: 100, tags: ['educational', 'cloud'] };

      const setResult = await cacheService.set('quest:catalog', testData, 120);
      expect(setResult).toBe(true);

      const cached = await cacheService.get('quest:catalog');
      expect(cached).toEqual(testData);
    });

    it('should return null on cache miss', async () => {
      const nonExistent = await cacheService.get('missing_key_xyz');
      expect(nonExistent).toBeNull();
    });

    it('should check existence of keys using exists()', async () => {
      await cacheService.set('status:ready', true);
      const exists1 = await cacheService.exists('status:ready');
      const exists2 = await cacheService.exists('status:not_ready');

      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });

    it('should delete a specific key from cache', async () => {
      await cacheService.set('temp_key', 'temp_val');
      expect(await cacheService.exists('temp_key')).toBe(true);

      await cacheService.del('temp_key');
      expect(await cacheService.exists('temp_key')).toBe(false);
    });

    it('should invalidate multiple keys matching a pattern', async () => {
      await cacheService.set('quests:easy:1', { id: 1 });
      await cacheService.set('quests:easy:2', { id: 2 });
      await cacheService.set('users:profile:1', { id: 1 });

      const removed = await cacheService.invalidate('quests:easy:*');
      expect(removed).toBe(2);

      expect(await cacheService.get('quests:easy:1')).toBeNull();
      expect(await cacheService.get('quests:easy:2')).toBeNull();
      expect(await cacheService.get('users:profile:1')).not.toBeNull();
    });

    it('should handle read errors gracefully without throwing', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Redis socket closed'));

      const result = await cacheService.get('failing_read');
      expect(result).toBeNull();
    });

    it('should handle write errors gracefully without throwing', async () => {
      mockClient.set.mockRejectedValueOnce(new Error('Redis write buffer full'));

      const result = await cacheService.set('failing_write', 'data');
      expect(result).toBe(false);
    });
  });
});
