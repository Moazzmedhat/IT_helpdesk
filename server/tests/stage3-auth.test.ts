import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrf.middleware';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/session.service';

describe('Stage 3: Authentication, Session Management, RBAC & Audit Service', () => {
  const app = createApp();

  beforeAll(async () => {
    // Clean any existing test sessions
    await prisma.session.deleteMany();
  });

  afterAll(async () => {
    await prisma.session.deleteMany();
    await prisma.$disconnect();
  });

  it('GET /api/auth/dev-users returns list of seeded users in dev mode', async () => {
    const res = await request(app).get('/api/auth/dev-users');
    expect(res.status).toBe(200);
    expect(res.body.users).toBeInstanceOf(Array);
    expect(res.body.users.length).toBeGreaterThan(0);
    expect(res.body.users[0]).toHaveProperty('email');
    expect(res.body.users[0]).toHaveProperty('role');
  });

  it('POST /api/auth/dev-login logs in as employee and sets httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'emp1@currencyexchange.local' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('emp1@currencyexchange.local');
    expect(res.body.user.role).toBe('EMPLOYEE');

    // Check Set-Cookie header contains session cookie
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const sessionCookie = cookies.find(c => c.includes(SESSION_COOKIE_NAME));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
  });

  it('verifies audit log was recorded on login', async () => {
    const log = await prisma.auditLog.findFirst({
      where: { action: 'LOGIN' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log?.action).toBe('LOGIN');
    expect(log?.entity).toBe('Session');
  });

  it('enforces RBAC: employee cannot access technician or admin routes', async () => {
    // 1. Login as employee
    const loginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'emp1@currencyexchange.local' });

    const cookie = loginRes.headers['set-cookie'];

    // 2. Can access employee route
    const empRes = await request(app)
      .get('/api/auth/test-employee')
      .set('Cookie', cookie);
    expect(empRes.status).toBe(200);

    // 3. Forbidden on technician route
    const techRes = await request(app)
      .get('/api/auth/test-tech')
      .set('Cookie', cookie);
    expect(techRes.status).toBe(403);
    expect(techRes.body.error).toBe('Forbidden');

    // 4. Forbidden on admin route
    const adminRes = await request(app)
      .get('/api/auth/test-admin')
      .set('Cookie', cookie);
    expect(adminRes.status).toBe(403);
    expect(adminRes.body.error).toBe('Forbidden');
  });

  it('enforces RBAC: technician can access tech route but not admin route', async () => {
    const loginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'tech1@currencyexchange.local' });

    const cookie = loginRes.headers['set-cookie'];

    const techRes = await request(app)
      .get('/api/auth/test-tech')
      .set('Cookie', cookie);
    expect(techRes.status).toBe(200);

    const adminRes = await request(app)
      .get('/api/auth/test-admin')
      .set('Cookie', cookie);
    expect(adminRes.status).toBe(403);
  });

  it('enforces RBAC: admin can access admin route', async () => {
    const loginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'admin@currencyexchange.local' });

    const cookie = loginRes.headers['set-cookie'];

    const adminRes = await request(app)
      .get('/api/auth/test-admin')
      .set('Cookie', cookie);
    expect(adminRes.status).toBe(200);
  });

  it('revokes session on logout', async () => {
    const loginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'emp2@currencyexchange.local' });

    const cookie = loginRes.headers['set-cookie'];

    // Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);

    // Check accessing protected route fails with 401
    const testRes = await request(app)
      .get('/api/auth/test-employee')
      .set('Cookie', cookie);
    expect(testRes.status).toBe(401);
  });
});
