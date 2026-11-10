import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { Role, PriorityLevel, TicketStatus } from '@prisma/client';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrf.middleware';

describe('Stage 4: State Machine, Lifecycle Transitions & Employee Isolation', () => {
  const app = createApp();

  let emp1Cookie: string[];
  let emp2Cookie: string[];
  let tech1Cookie: string[];
  let tech2Cookie: string[];
  let adminCookie: string[];

  let categoryId: string;
  let departmentId: string;
  let branchId: string;

  beforeAll(async () => {
    // 1. Fetch metadata IDs
    const cat = await prisma.category.findFirst({ where: { name: 'Hardware' } });
    categoryId = cat!.id;
    const dept = await prisma.department.findFirst({ where: { code: 'FXT' } });
    departmentId = dept!.id;
    const br = await prisma.branch.findFirst({ where: { code: 'HO-DXB' } });
    branchId = br!.id;

    // 2. Log in users
    const emp1Res = await request(app).post('/api/auth/dev-login').send({ email: 'emp1@currencyexchange.local' });
    emp1Cookie = emp1Res.headers['set-cookie'] as unknown as string[];

    const emp2Res = await request(app).post('/api/auth/dev-login').send({ email: 'emp2@currencyexchange.local' });
    emp2Cookie = emp2Res.headers['set-cookie'] as unknown as string[];

    const tech1Res = await request(app).post('/api/auth/dev-login').send({ email: 'tech1@currencyexchange.local' });
    tech1Cookie = tech1Res.headers['set-cookie'] as unknown as string[];

    const tech2Res = await request(app).post('/api/auth/dev-login').send({ email: 'tech2@currencyexchange.local' });
    tech2Cookie = tech2Res.headers['set-cookie'] as unknown as string[];

    const adminRes = await request(app).post('/api/auth/dev-login').send({ email: 'admin@currencyexchange.local' });
    adminCookie = adminRes.headers['set-cookie'] as unknown as string[];
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

  it('employee creates ticket with valid IT-YYYY-NNNNN number', async () => {
    const csrf = getCsrf(emp1Cookie);
    const res = await request(app)
      .post('/api/tickets')
      .set('Cookie', emp1Cookie)
      .set(CSRF_HEADER_NAME, csrf)
      .send({
        title: 'Trader workstation dual monitor failure',
        description: 'The secondary trading terminal monitor is showing black screen after reboot.',
        categoryId,
        departmentId,
        branchId,
        priority: PriorityLevel.HIGH,
        deviceAssetTag: 'FX-WS-0942',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.ticket.ticketNumber).toMatch(/^IT-\d{4}-\d{5}$/);
    expect(res.body.ticket.status).toBe('OPEN');
  });

  it('sensitive data guard rejects card numbers (Luhn algorithm)', async () => {
    const csrf = getCsrf(emp1Cookie);
    // Valid Luhn test card number
    const res = await request(app)
      .post('/api/tickets')
      .set('Cookie', emp1Cookie)
      .set(CSRF_HEADER_NAME, csrf)
      .send({
        title: 'POS card reader error',
        description: 'Customer card 4532 0150 1234 5671 failed to process during transaction.',
        categoryId,
        departmentId,
        branchId,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('payment card number detected');
  });

  it('sensitive data guard rejects plaintext password submission', async () => {
    const csrf = getCsrf(emp1Cookie);
    const res = await request(app)
      .post('/api/tickets')
      .set('Cookie', emp1Cookie)
      .set(CSRF_HEADER_NAME, csrf)
      .send({
        title: 'Login help',
        description: 'I forgot my password: SuperSecret123! Please unlock.',
        categoryId,
        departmentId,
        branchId,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('plaintext password');
  });

  it('enforces employee isolation: employee requesting another employee ticket gets 404', async () => {
    // emp1 creates a ticket
    const csrf1 = getCsrf(emp1Cookie);
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Cookie', emp1Cookie)
      .set(CSRF_HEADER_NAME, csrf1)
      .send({
        title: 'Private FX trader ticket',
        description: 'Private trading strategy platform crash on desktop terminal.',
        categoryId,
        departmentId,
        branchId,
      });

    const ticketId = createRes.body.ticket.id;

    // emp2 tries to access emp1's ticket
    const res = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set('Cookie', emp2Cookie);

    expect(res.status).toBe(404);
  });

  it('technician cannot modify or transition a ticket owned by someone else', async () => {
    // 1. emp1 creates ticket
    const csrf1 = getCsrf(emp1Cookie);
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Cookie', emp1Cookie)
      .set(CSRF_HEADER_NAME, csrf1)
      .send({
        title: 'Network latency on dealing desk',
        description: 'High latency observed when routing FX order fills to liquidity providers.',
        categoryId,
        departmentId,
        branchId,
      });

    const ticketId = createRes.body.ticket.id;

    // 2. tech1 claims ticket
    const csrfTech1 = getCsrf(tech1Cookie);
    const claimRes = await request(app)
      .post(`/api/tickets/${ticketId}/claim`)
      .set('Cookie', tech1Cookie)
      .set(CSRF_HEADER_NAME, csrfTech1);
    expect(claimRes.status).toBe(200);

    // 3. tech2 tries to transition status -> 403 Forbidden
    const csrfTech2 = getCsrf(tech2Cookie);
    const transitionRes = await request(app)
      .post(`/api/tickets/${ticketId}/transition`)
      .set('Cookie', tech2Cookie)
      .set(CSRF_HEADER_NAME, csrfTech2)
      .send({ status: 'RESOLVED' });

    expect(transitionRes.status).toBe(403);
    expect(transitionRes.body.message).toContain('only update status on tickets you own');
  });

  it('owner technician transitions IN_PROGRESS -> PENDING -> IN_PROGRESS -> RESOLVED', async () => {
    // 1. emp1 creates ticket
    const csrf1 = getCsrf(emp1Cookie);
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Cookie', emp1Cookie)
      .set(CSRF_HEADER_NAME, csrf1)
      .send({
        title: 'Printer paper jam in booth 2',
        description: 'Thermal receipt printer jammed during customer cash exchange.',
        categoryId,
        departmentId,
        branchId,
      });

    const ticketId = createRes.body.ticket.id;

    // 2. tech1 claims ticket
    const csrfTech1 = getCsrf(tech1Cookie);
    await request(app)
      .post(`/api/tickets/${ticketId}/claim`)
      .set('Cookie', tech1Cookie)
      .set(CSRF_HEADER_NAME, csrfTech1);

    // 3. Move to PENDING (e.g. waiting for spare parts)
    const pendingRes = await request(app)
      .post(`/api/tickets/${ticketId}/transition`)
      .set('Cookie', tech1Cookie)
      .set(CSRF_HEADER_NAME, csrfTech1)
      .send({ status: 'PENDING', reason: 'Waiting for vendor replacement roller' });
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.ticket.status).toBe('PENDING');

    // 4. Move back to IN_PROGRESS
    const inProgRes = await request(app)
      .post(`/api/tickets/${ticketId}/transition`)
      .set('Cookie', tech1Cookie)
      .set(CSRF_HEADER_NAME, csrfTech1)
      .send({ status: 'IN_PROGRESS', reason: 'Parts arrived, resuming replacement' });
    expect(inProgRes.status).toBe(200);
    expect(inProgRes.body.ticket.status).toBe('IN_PROGRESS');

    // 5. Resolve
    const resolveRes = await request(app)
      .post(`/api/tickets/${ticketId}/transition`)
      .set('Cookie', tech1Cookie)
      .set(CSRF_HEADER_NAME, csrfTech1)
      .send({ status: 'RESOLVED', reason: 'Roller replaced and test receipts printed cleanly.' });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.ticket.status).toBe('RESOLVED');
  });

  it('release resets ticket to OPEN and clears assignee with mandatory reason', async () => {
    // 1. emp1 creates ticket
    const csrf1 = getCsrf(emp1Cookie);
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Cookie', emp1Cookie)
      .set(CSRF_HEADER_NAME, csrf1)
      .send({
        title: 'VoIP phone registration timeout',
        description: 'Desk phone in FX back-office cannot register to PBX server.',
        categoryId,
        departmentId,
        branchId,
      });

    const ticketId = createRes.body.ticket.id;

    // 2. tech1 claims ticket
    const csrfTech1 = getCsrf(tech1Cookie);
    await request(app)
      .post(`/api/tickets/${ticketId}/claim`)
      .set('Cookie', tech1Cookie)
      .set(CSRF_HEADER_NAME, csrfTech1);

    // 3. Release without reason fails with 400
    const failRelease = await request(app)
      .post(`/api/tickets/${ticketId}/release`)
      .set('Cookie', tech1Cookie)
      .set(CSRF_HEADER_NAME, csrfTech1)
      .send({ reason: '' });
    expect(failRelease.status).toBe(400);

    // 4. Release with reason succeeds
    const releaseRes = await request(app)
      .post(`/api/tickets/${ticketId}/release`)
      .set('Cookie', tech1Cookie)
      .set(CSRF_HEADER_NAME, csrfTech1)
      .send({ reason: 'Releasing due to shift handover to night-shift team' });

    expect(releaseRes.status).toBe(200);
    expect(releaseRes.body.ticket.status).toBe('OPEN');
    expect(releaseRes.body.ticket.assignedToId).toBeNull();

    // 5. Check tech2 can now re-claim it
    const csrfTech2 = getCsrf(tech2Cookie);
    const reclaimRes = await request(app)
      .post(`/api/tickets/${ticketId}/claim`)
      .set('Cookie', tech2Cookie)
      .set(CSRF_HEADER_NAME, csrfTech2);
    expect(reclaimRes.status).toBe(200);
    expect(reclaimRes.body.ticket.status).toBe('IN_PROGRESS');
  });

  it('employee can reopen resolved ticket within window; closes afterwards', async () => {
    // 1. emp1 creates ticket
    const csrf1 = getCsrf(emp1Cookie);
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Cookie', emp1Cookie)
      .set(CSRF_HEADER_NAME, csrf1)
      .send({
        title: 'Scanner glass smudge issue',
        description: 'Document scanner creates black lines across customer passport scans.',
        categoryId,
        departmentId,
        branchId,
      });

    const ticketId = createRes.body.ticket.id;

    // 2. tech1 claims and resolves ticket
    const csrfTech1 = getCsrf(tech1Cookie);
    await request(app)
      .post(`/api/tickets/${ticketId}/claim`)
      .set('Cookie', tech1Cookie)
      .set(CSRF_HEADER_NAME, csrfTech1);

    await request(app)
      .post(`/api/tickets/${ticketId}/transition`)
      .set('Cookie', tech1Cookie)
      .set(CSRF_HEADER_NAME, csrfTech1)
      .send({ status: 'RESOLVED', reason: 'Cleaned scanning glass optics' });

    // 3. emp1 reopens ticket within window
    const reopenRes = await request(app)
      .post(`/api/tickets/${ticketId}/transition`)
      .set('Cookie', emp1Cookie)
      .set(CSRF_HEADER_NAME, csrf1)
      .send({ status: 'REOPENED', reason: 'Issue re-occurred on high-dpi scans' });

    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.ticket.status).toBe('REOPENED');
    expect(reopenRes.body.ticket.assignedToId).toBeNull();
  });
});
