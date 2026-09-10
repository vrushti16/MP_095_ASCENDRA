const request = require('supertest');
const app = require('../src/app');
const database = require('../src/config/database');
const redisConfig = require('../src/config/redis');
const axios = require('axios');

describe('Health and System Observability API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/v1/health (Lightweight Standard Probe)', () => {
    it('should return 200 and standard healthy response payload', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'ASCENDRA backend is running');
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('version', '1.0.0');
      expect(response.body.data).toHaveProperty('uptimeSeconds');
      expect(response.body.data).toHaveProperty('environment');
    });
  });

  describe('GET /api/v1/health?detailed=true (Deep Diagnostic Probe)', () => {
    it('should return 200 with all dependency metrics when all services are healthy', async () => {
      jest.spyOn(database, 'query').mockResolvedValueOnce({ rows: [{ health_check: 1 }] });
      jest.spyOn(redisConfig, 'isRedisAvailable').mockReturnValueOnce(true);
      jest.spyOn(redisConfig, 'getRedisClient').mockReturnValueOnce({
        isOpen: true,
        ping: jest.fn().mockResolvedValueOnce('PONG')
      });
      jest.spyOn(axios, 'get').mockResolvedValueOnce({
        status: 200,
        data: { status: 'healthy', specVersion: '1.0.0' }
      });

      const response = await request(app).get('/api/v1/health?detailed=true');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('runtime');
      expect(response.body.data.runtime).toHaveProperty('memory');
      expect(response.body.data.dependencies.postgresql.status).toBe('healthy');
      expect(typeof response.body.data.dependencies.postgresql.latencyMs).toBe('number');
      expect(response.body.data.dependencies.redis.status).toBe('healthy');
      expect(response.body.data.dependencies.fastapi.status).toBe('healthy');
    });

    it('should report degraded mode (HTTP 200) when Redis is offline but Postgres is healthy', async () => {
      jest.spyOn(database, 'query').mockResolvedValueOnce({ rows: [{ health_check: 1 }] });
      jest.spyOn(redisConfig, 'isRedisAvailable').mockReturnValueOnce(false);
      jest.spyOn(axios, 'get').mockResolvedValueOnce({
        status: 200,
        data: { status: 'healthy', specVersion: '1.0.0' }
      });

      const response = await request(app).get('/api/v1/health?detailed=true');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.dependencies.postgresql.status).toBe('healthy');
      expect(response.body.data.dependencies.redis.status).toBe('unavailable');
      expect(response.body.data.dependencies.redis.fallbackState).toBe('cache_bypass');
    });

    it('should report degraded mode (HTTP 200) when FastAPI is offline but Postgres is healthy', async () => {
      jest.spyOn(database, 'query').mockResolvedValueOnce({ rows: [{ health_check: 1 }] });
      jest.spyOn(redisConfig, 'isRedisAvailable').mockReturnValueOnce(true);
      jest.spyOn(redisConfig, 'getRedisClient').mockReturnValueOnce({
        isOpen: true,
        ping: jest.fn().mockResolvedValueOnce('PONG')
      });
      jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app).get('/api/v1/health?detailed=true');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.dependencies.fastapi.status).toBe('unavailable');
      expect(response.body.data.dependencies.fastapi.error).toBe('AI service unreachable');
    });

    it('should report HTTP 503 and unhealthy status when PostgreSQL is down', async () => {
      jest.spyOn(database, 'query').mockRejectedValueOnce(new Error('Database pool exhausted'));
      jest.spyOn(redisConfig, 'isRedisAvailable').mockReturnValueOnce(false);
      jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('AI service offline'));

      const response = await request(app).get('/api/v1/health?detailed=true');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.data.status).toBe('unhealthy');
      expect(response.body.data.dependencies.postgresql.status).toBe('unhealthy');
      expect(response.body.data.dependencies.postgresql.error).toBe('Database connection failed');
    });
  });

  describe('404 Not Found Handling', () => {
    it('should return 404 with standardized error payload for undefined routes', async () => {
      const response = await request(app).get('/api/v1/non-existent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'ROUTE_NOT_FOUND');
      expect(response.body.error.message).toContain('Route not found');
    });
  });
});
