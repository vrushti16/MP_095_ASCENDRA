const request = require('supertest');
const app = require('../src/app');

describe('Player Web Client Static Serving & Route Isolation (/play)', () => {
  it('should serve player client directly at root GET / without redirecting', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.text).toContain('ASCENDRA — The Lost Realms');
  });

  it('should serve player client at /login and /register routes', async () => {
    const loginRes = await request(app).get('/login');
    expect(loginRes.status).toBe(200);
    expect(loginRes.text).toContain('ASCENDRA — The Lost Realms');

    const regRes = await request(app).get('/register');
    expect(regRes.status).toBe(200);
    expect(regRes.text).toContain('ASCENDRA — The Lost Realms');
  });

  it('should serve player client index.html at /play/', async () => {
    const res = await request(app).get('/play/');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.text).toContain('ASCENDRA — The Lost Realms');
    expect(res.text).toContain('playerSplashOverlay');
    expect(res.text).toContain('playerAppContainer');
  });

  it('should serve player.css with fantasy RPG design tokens', async () => {
    const res = await request(app).get('/play/css/player.css');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/css/);
    expect(res.text).toContain('--p-canvas: #f4f6fa');
    expect(res.text).toContain('--p-cyan: #0284c7');
    expect(res.text).toContain('--p-gold: #d97706');
  });

  it('should serve player responsive.css stylesheet', async () => {
    const res = await request(app).get('/play/css/responsive.css');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/css/);
    expect(res.text).toContain('@media (max-width: 768px)');
  });

  it('should serve player API client script', async () => {
    const res = await request(app).get('/play/js/api.js');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/javascript/);
    expect(res.text).toContain('PlayerApiClient');
  });

  it('should maintain Phase 16 Admin Dashboard isolation at /admin/', async () => {
    const res = await request(app).get('/admin/');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('ASCENDRA — Admin Console');
    expect(res.text).toContain('js/api.js');
  });

  it('should maintain API route priority for /api/v1/health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status');
  });
});
