import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { Role, PriorityLevel, TicketStatus } from '@prisma/client';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrf.middleware';

describe('Stage 4: Critical Concurrent Claim Test (20 Parallel Technicians)', () => {
  jest.setTimeout(60000);
  const app = createApp();

  const NUM_TECHNICIANS = 20;
  const techSessions: Array<{ email: string; cookie: string[]; csrf: string }> = [];
  let testTicketId: string;

  beforeAll(async () => {
    // 1. Fetch metadata
    const dept = await prisma.department.findFirst({ where: { code: 'IT' } });
    const branch = await prisma.branch.findFirst({ where: { code: 'HO-DXB' } });
    const category = await prisma.category.findFirst({ where: { name: 'Hardware' } });

    // 2. Ensure 20 distinct technicians exist in database
    for (let i = 1; i <= NUM_TECHNICIANS; i++) {
      const email = `concurrent-tech-${i}@currencyexchange.local`;
      await prisma.user.upsert({
        where: { email },
        update: { isActive: true },
        create: {
          email,
          fullName: `Concurrent Tech ${i}`,
          role: Role.TECHNICIAN,
          departmentId: dept!.id,
          branchId: branch!.id,
          isActive: true,
        },
      });

      // Login each technician to obtain session cookie & CSRF token
      const loginRes = await request(app).post('/api/auth/dev-login').send({ email });
      const cookie = loginRes.headers['set-cookie'] as unknown as string[];
      const csrfCookie = cookie.find(c => c.includes(CSRF_COOKIE_NAME));
      const match = csrfCookie?.match(/XSRF-TOKEN=([^;]+)/);
      const csrf = match ? match[1] : '';

      techSessions.push({ email, cookie, csrf });
    }

    // 3. Login an employee and create a fresh OPEN ticket
    const empLogin = await request(app).post('/api/auth/dev-login').send({ email: 'emp1@currencyexchange.local' });
    const empCookie = empLogin.headers['set-cookie'] as unknown as string[];
    const empCsrfCookie = empCookie.find(c => c.includes(CSRF_COOKIE_NAME));
    const empCsrf = empCsrfCookie?.match(/XSRF-TOKEN=([^;]+)/)?.[1] || '';

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, empCsrf)
      .send({
        title: 'Critical ATM cash dispense hardware error',
        description: 'ATM unit in lobby rejected cash tray cassette during initialization.',
        categoryId: category!.id,
        departmentId: dept!.id,
        branchId: branch!.id,
        priority: PriorityLevel.CRITICAL,
      });

    testTicketId = createRes.body.ticket.id;
    expect(testTicketId).toBeDefined();
    expect(createRes.body.ticket.status).toBe(TicketStatus.OPEN);
  });

  afterAll(async () => {
    // Cleanup concurrent test tickets, history, sessions, audit logs and users
    if (testTicketId) {
      await prisma.ticketHistory.deleteMany({ where: { ticketId: testTicketId } });
      await prisma.ticket.deleteMany({ where: { id: testTicketId } });
    }
    const techUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'concurrent-tech-' } },
      select: { id: true },
    });
    const userIds = techUsers.map(u => u.id);
    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.ticketHistory.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it('fires 20 parallel claim requests from different technicians: exactly 1 succeeds (200) and 19 receive 409 Conflict', async () => {
    // Fire all 20 requests concurrently using Promise.all
    const claimPromises = techSessions.map((session) =>
      request(app)
        .post(`/api/tickets/${testTicketId}/claim`)
        .set('Cookie', session.cookie)
        .set(CSRF_HEADER_NAME, session.csrf)
    );

    const responses = await Promise.all(claimPromises);

    const successfulClaims = responses.filter((r) => r.status === 200);
    const conflictClaims = responses.filter((r) => r.status === 409);

    console.log(`Concurrent claim results: Successes = ${successfulClaims.length}, Conflicts (409) = ${conflictClaims.length}`);

    // Exactly one must succeed
    expect(successfulClaims.length).toBe(1);

    // Exactly 19 must receive 409 Conflict
    expect(conflictClaims.length).toBe(19);

    // Verify 409 response message
    conflictClaims.forEach((res) => {
      expect(res.body.message).toContain('Ticket already claimed by another technician');
    });

    // Verify database state: ticket status is IN_PROGRESS and assignedTo is set
    const ticketInDb = await prisma.ticket.findUnique({
      where: { id: testTicketId },
      include: { assignedTo: true },
    });

    expect(ticketInDb?.status).toBe(TicketStatus.IN_PROGRESS);
    expect(ticketInDb?.assignedToId).toBeDefined();

    // Verify TicketHistory contains EXACTLY ONE claim entry
    const claimHistories = await prisma.ticketHistory.findMany({
      where: {
        ticketId: testTicketId,
        toStatus: TicketStatus.IN_PROGRESS,
        reason: 'Claimed by technician',
      },
    });

    expect(claimHistories.length).toBe(1);
    expect(claimHistories[0].actorId).toBe(ticketInDb?.assignedToId);
  });
});
