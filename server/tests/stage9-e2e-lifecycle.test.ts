import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { Role, PriorityLevel, TicketStatus, CommentVisibility } from '@prisma/client';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrf.middleware';

describe('Stage 9: End-to-End Enterprise Ticketing Lifecycle', () => {
  const app = createApp();

  let empCookie: string[];
  let techCookie: string[];
  let categoryId: string;
  let departmentId: string;
  let branchId: string;

  beforeAll(async () => {
    // 1. Fetch metadata
    const cat = await prisma.category.findFirst({ where: { name: 'Software' } });
    categoryId = cat!.id;
    const dept = await prisma.department.findFirst({ where: { code: 'FXT' } });
    departmentId = dept!.id;
    const br = await prisma.branch.findFirst({ where: { code: 'HO-DXB' } });
    branchId = br!.id;

    // 2. Login
    const empRes = await request(app).post('/api/auth/dev-login').send({ email: 'emp1@currencyexchange.local' });
    empCookie = empRes.headers['set-cookie'] as unknown as string[];

    const techRes = await request(app).post('/api/auth/dev-login').send({ email: 'tech1@currencyexchange.local' });
    techCookie = techRes.headers['set-cookie'] as unknown as string[];
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

  it('runs complete lifecycle: create -> claim -> internal note -> public reply -> resolve -> confirm close', async () => {
    // 1. Employee creates ticket
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, getCsrf(empCookie))
      .send({
        title: 'Dealing portal FX rate feed delayed by 15 seconds',
        description: 'EUR/USD and GBP/USD exchange feeds are lagging behind Reuters interbank rates.',
        categoryId,
        departmentId,
        branchId,
        priority: PriorityLevel.CRITICAL,
      });

    expect(createRes.status).toBe(201);
    const ticketId = createRes.body.ticket.id;
    expect(createRes.body.ticket.status).toBe(TicketStatus.OPEN);

    // 2. Technician views queue: ticket is in available queue
    const queueRes = await request(app)
      .get('/api/tickets?queueTab=available')
      .set('Cookie', techCookie);

    expect(queueRes.status).toBe(200);
    const inQueue = queueRes.body.tickets.some((t: any) => t.id === ticketId);
    expect(inQueue).toBe(true);

    // 3. Technician claims ticket
    const claimRes = await request(app)
      .post(`/api/tickets/${ticketId}/claim`)
      .set('Cookie', techCookie)
      .set(CSRF_HEADER_NAME, getCsrf(techCookie));

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.ticket.status).toBe(TicketStatus.IN_PROGRESS);

    // 4. Technician adds internal diagnostic note
    const internalNoteRes = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Cookie', techCookie)
      .set(CSRF_HEADER_NAME, getCsrf(techCookie))
      .send({
        content: 'Internal: Redis websocket pub/sub socket buffer overflow observed on node 2.',
        visibility: CommentVisibility.INTERNAL,
      });

    expect(internalNoteRes.status).toBe(201);

    // 5. Technician adds public comment for employee
    const publicCommentRes = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Cookie', techCookie)
      .set(CSRF_HEADER_NAME, getCsrf(techCookie))
      .send({
        content: 'We have identified a feed buffer delay and are restarting the primary rates gateway.',
        visibility: CommentVisibility.PUBLIC,
      });

    expect(publicCommentRes.status).toBe(201);

    // 6. Verify employee can read public comment but NOT internal note
    const empReadComments = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set('Cookie', empCookie);

    expect(empReadComments.status).toBe(200);
    const visibleToEmp = empReadComments.body.comments;
    expect(visibleToEmp.some((c: any) => c.visibility === 'INTERNAL')).toBe(false);
    expect(visibleToEmp.some((c: any) => c.content.includes('feed buffer delay'))).toBe(true);

    // 7. Technician resolves ticket
    const resolveRes = await request(app)
      .post(`/api/tickets/${ticketId}/transition`)
      .set('Cookie', techCookie)
      .set(CSRF_HEADER_NAME, getCsrf(techCookie))
      .send({
        status: TicketStatus.RESOLVED,
        reason: 'Gateway restarted and market rate latency restored to under 50ms.',
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.ticket.status).toBe(TicketStatus.RESOLVED);

    // 8. Employee confirms resolution and closes ticket
    const closeRes = await request(app)
      .post(`/api/tickets/${ticketId}/transition`)
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, getCsrf(empCookie))
      .send({
        status: TicketStatus.CLOSED,
        reason: 'Confirmed rates are updating in real-time.',
      });

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.ticket.status).toBe(TicketStatus.CLOSED);

    // 9. Verify CLOSED is terminal (attempting any further transition returns 409)
    const terminalAttempt = await request(app)
      .post(`/api/tickets/${ticketId}/transition`)
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, getCsrf(empCookie))
      .send({ status: TicketStatus.REOPENED });

    expect(terminalAttempt.status).toBe(409);
    expect(terminalAttempt.body.message).toContain('Closed tickets cannot transition');

    // 10. Verify TicketHistory audit timeline
    const finalTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { history: true },
    });

    expect(finalTicket?.status).toBe(TicketStatus.CLOSED);
    expect(finalTicket?.history.length).toBeGreaterThanOrEqual(4); // Created, Claimed, Resolved, Closed
  });
});
