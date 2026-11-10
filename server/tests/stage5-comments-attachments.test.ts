import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { CommentVisibility, Role, PriorityLevel } from '@prisma/client';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrf.middleware';

describe('Stage 5: Comments, Internal Notes & Secure File Attachments', () => {
  const app = createApp();

  let empCookie: string[];
  let techCookie: string[];
  let ticketId: string;
  let categoryId: string;
  let departmentId: string;
  let branchId: string;

  beforeAll(async () => {
    // 1. Metadata
    const cat = await prisma.category.findFirst({ where: { name: 'Hardware' } });
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

    // 3. Create a test ticket
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, getCsrf(empCookie))
      .send({
        title: 'FX printer offline in currency vault',
        description: 'Vault high-speed counter printer is not responding to batch print jobs.',
        categoryId,
        departmentId,
        branchId,
        priority: PriorityLevel.HIGH,
      });

    ticketId = createRes.body.ticket.id;
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

  it('employee and technician can post public comments', async () => {
    // Employee posts public comment
    const empComment = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, getCsrf(empCookie))
      .send({
        content: 'I have verified that power cable is securely connected.',
        visibility: CommentVisibility.PUBLIC,
      });

    expect(empComment.status).toBe(201);
    expect(empComment.body.comment.visibility).toBe('PUBLIC');

    // Technician posts public comment
    const techComment = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Cookie', techCookie)
      .set(CSRF_HEADER_NAME, getCsrf(techCookie))
      .send({
        content: 'Connecting remotely to check the print spooler status.',
        visibility: CommentVisibility.PUBLIC,
      });

    expect(techComment.status).toBe(201);
    expect(techComment.body.comment.visibility).toBe('PUBLIC');
  });

  it('technician can post internal note, but employee gets 403 Forbidden', async () => {
    // Employee attempt to post INTERNAL note -> 403 Forbidden
    const empForbidden = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, getCsrf(empCookie))
      .send({
        content: 'Trying to sneak an internal note.',
        visibility: CommentVisibility.INTERNAL,
      });

    expect(empForbidden.status).toBe(403);
    expect(empForbidden.body.message).toContain('Employees cannot create internal notes');

    // Technician posts INTERNAL note -> 201 Created
    const techInternal = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Cookie', techCookie)
      .set(CSRF_HEADER_NAME, getCsrf(techCookie))
      .send({
        content: 'Internal diagnostics: Spooler queue crashed due to out-of-memory error on driver v2.4.',
        visibility: CommentVisibility.INTERNAL,
      });

    expect(techInternal.status).toBe(201);
    expect(techInternal.body.comment.visibility).toBe('INTERNAL');
  });

  it('CRITICAL: internal notes never leak to employee in API response', async () => {
    // 1. Employee fetches comments
    const empFetch = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set('Cookie', empCookie);

    expect(empFetch.status).toBe(200);
    const empComments = empFetch.body.comments;
    expect(empComments.length).toBeGreaterThan(0);

    // Verify ZERO internal notes returned to employee
    const internalNotesVisible = empComments.filter((c: any) => c.visibility === 'INTERNAL');
    expect(internalNotesVisible.length).toBe(0);

    // 2. Technician fetches comments -> can see BOTH public and internal
    const techFetch = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set('Cookie', techCookie);

    expect(techFetch.status).toBe(200);
    const techComments = techFetch.body.comments;
    const techInternalNotes = techComments.filter((c: any) => c.visibility === 'INTERNAL');
    expect(techInternalNotes.length).toBeGreaterThanOrEqual(1);
  });

  it('sensitive data guard rejects card numbers in comments', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, getCsrf(empCookie))
      .send({
        content: 'Card number 4532 0150 1234 5671 should not be posted in comment.',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('payment card number detected');
  });

  it('uploads valid log file and serves signed/authorized download URL', async () => {
    const logBuffer = Buffer.from('2026-11-09 20:00:00 [ERROR] Vault printer spooler offline\n');

    const uploadRes = await request(app)
      .post(`/api/tickets/${ticketId}/attachments/upload`)
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, getCsrf(empCookie))
      .attach('file', logBuffer, 'printer_spooler.log');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.attachment.originalName).toBe('printer_spooler.log');
    expect(uploadRes.body.attachment.storageKey).toBeDefined();

    const attachmentId = uploadRes.body.attachment.id;

    // Employee gets download URL
    const urlRes = await request(app)
      .get(`/api/attachments/${attachmentId}/url`)
      .set('Cookie', empCookie);

    expect(urlRes.status).toBe(200);
    expect(urlRes.body.url).toBeDefined();

    // Verify audit log for download
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ATTACHMENT_DOWNLOAD', entityId: attachmentId },
    });
    expect(audit).toBeDefined();
  });

  it('verifies magic bytes: rejects spoofed .png file containing invalid bytes', async () => {
    // Text buffer disguised as .png
    const fakePng = Buffer.from('This is not a real PNG image file at all.');

    const uploadRes = await request(app)
      .post(`/api/tickets/${ticketId}/attachments/upload`)
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, getCsrf(empCookie))
      .attach('file', fakePng, 'screenshot.png');

    expect(uploadRes.status).toBe(400);
    expect(uploadRes.body.message).toContain('magic bytes');
  });

  it('virus scanner rejects EICAR malware test string', async () => {
    const eicarString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const infectedBuffer = Buffer.from(eicarString);

    const uploadRes = await request(app)
      .post(`/api/tickets/${ticketId}/attachments/upload`)
      .set('Cookie', empCookie)
      .set(CSRF_HEADER_NAME, getCsrf(empCookie))
      .attach('file', infectedBuffer, 'malware.txt');

    expect(uploadRes.status).toBe(400);
    expect(uploadRes.body.message).toContain('malware detected');
  });
});
