import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrf.middleware';
import { Role } from '@prisma/client';

describe('Stage 7 & 8: Reports, System Settings, Admin Master Data & Notifications', () => {
  const app = createApp();

  let adminCookie: string[];
  let techCookie: string[];
  let empCookie: string[];

  beforeAll(async () => {
    const adminRes = await request(app).post('/api/auth/dev-login').send({ email: 'admin@currencyexchange.local' });
    adminCookie = adminRes.headers['set-cookie'] as unknown as string[];

    const techRes = await request(app).post('/api/auth/dev-login').send({ email: 'tech1@currencyexchange.local' });
    techCookie = techRes.headers['set-cookie'] as unknown as string[];

    const empRes = await request(app).post('/api/auth/dev-login').send({ email: 'emp1@currencyexchange.local' });
    empCookie = empRes.headers['set-cookie'] as unknown as string[];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function getCsrf(cookies: string[]): string {
    const csrfC = cookies.find(c => c.includes(CSRF_COOKIE_NAME));
    if (!csrfC) return '';
    const match = csrfC.match(/XSRF-TOKEN=([^;]+)/);
    return match ? match[1] : '';
  }

  it('admin can access /api/reports/dashboard with comprehensive metrics', async () => {
    const res = await request(app)
      .get('/api/reports/dashboard')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary).toHaveProperty('totalTickets');
    expect(res.body.data.summary).toHaveProperty('openTickets');
    expect(res.body.data.summary).toHaveProperty('avgResolutionHours');
    expect(res.body.data.summary).toHaveProperty('avgFirstResponseHours');
    expect(res.body.data.byStatus).toBeInstanceOf(Array);
    expect(res.body.data.byPriority).toBeInstanceOf(Array);
    expect(res.body.data.byCategory).toBeInstanceOf(Array);
    expect(res.body.data.byDepartment).toBeInstanceOf(Array);
  });

  it('employee and technician cannot access admin reports dashboard (403)', async () => {
    const empRes = await request(app).get('/api/reports/dashboard').set('Cookie', empCookie);
    expect(empRes.status).toBe(403);

    const techRes = await request(app).get('/api/reports/dashboard').set('Cookie', techCookie);
    expect(techRes.status).toBe(403);
  });

  it('admin can view and update system settings with audit log', async () => {
    const csrf = getCsrf(adminCookie);

    // Get settings
    const getRes = await request(app).get('/api/admin/settings').set('Cookie', adminCookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.settings.length).toBeGreaterThan(0);

    // Update setting
    const updateRes = await request(app)
      .patch('/api/admin/settings/DEFAULT_AUTO_CLOSE_DAYS')
      .set('Cookie', adminCookie)
      .set(CSRF_HEADER_NAME, csrf)
      .send({ value: '4' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.setting.value).toBe('4');

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SETTINGS_CHANGE', entityId: 'DEFAULT_AUTO_CLOSE_DAYS' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeDefined();
    expect((audit?.details as any).newValue).toBe('4');

    // Reset back
    await request(app)
      .patch('/api/admin/settings/DEFAULT_AUTO_CLOSE_DAYS')
      .set('Cookie', adminCookie)
      .set(CSRF_HEADER_NAME, csrf)
      .send({ value: '3' });
  });

  it('user can list notifications and mark them as read', async () => {
    // Create a notification for emp1
    const emp = await prisma.user.findUnique({ where: { email: 'emp1@currencyexchange.local' } });
    const notif = await prisma.notification.create({
      data: {
        userId: emp!.id,
        title: 'System Maintenance Notice',
        message: 'Network upgrade scheduled for weekend.',
      },
    });

    // List notifications
    const listRes = await request(app)
      .get('/api/notifications')
      .set('Cookie', empCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.notifications.some((n: any) => n.id === notif.id)).toBe(true);

    // Mark as read
    const csrf = getCsrf(empCookie);
    const markRes = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, csrf);

    expect(markRes.status).toBe(200);

    const updated = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(updated?.isRead).toBe(true);
  });
});
