import request from 'supertest';
import { createApp } from '../src/app';

describe('Stage 1: Health check and base server configuration', () => {
  const app = createApp();

  it('GET /health returns 200 with status UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.environment).toBeDefined();
    expect(res.body.authMode).toBeDefined();
  });

  it('GET /api/ping returns 200 with message', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('active');
  });
});
