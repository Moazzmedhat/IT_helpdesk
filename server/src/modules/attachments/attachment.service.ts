import crypto from 'crypto';
import fileType from 'file-type';
import { prisma } from '../../config/prisma';
import { storageService } from './storage.service';
import { virusScanner } from './virus-scanner.interface';
import { auditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../middleware/auth.middleware';
import { Role, ScanStatus } from '@prisma/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../tickets/ticket.service';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'pdf', 'txt', 'log', 'docx']);

export class AttachmentService {
  async validateAndUpload(
    params: {
      ticketId: string;
      commentId?: string | null;
      file: Express.Multer.File;
    },
    user: AuthenticatedUser
  ) {
    const { ticketId, commentId, file } = params;

    // 1. Verify ticket access
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterId: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    if (user.role === Role.EMPLOYEE && ticket.requesterId !== user.id) {
      throw new NotFoundError('Ticket not found');
    }

    // 2. Check ticket attachment count limit
    const existingCount = await prisma.attachment.count({
      where: { ticketId },
    });

    if (existingCount >= 5) {
      throw new BadRequestError('Maximum attachment limit (5 files) reached for this ticket');
    }

    // 3. Check extension
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestError(`File type .${ext} is not allowed. Allowed types: png, jpg, pdf, txt, log, docx`);
    }

    // 4. Verify magic bytes using file-type
    let detectedMime = file.mimetype;
    const typeResult = await fileType.fromBuffer(file.buffer);

    if (typeResult) {
      detectedMime = typeResult.mime;
    } else {
      // Text or log files do not have binary magic bytes in file-type
      if (ext === 'txt' || ext === 'log') {
        const isAsciiOrUtf8 = /^[\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]*$/.test(file.buffer.toString('utf8'));
        if (isAsciiOrUtf8) {
          detectedMime = 'text/plain';
        } else {
          throw new BadRequestError('Corrupted or invalid plain text file');
        }
      } else {
        throw new BadRequestError('Could not verify file integrity or unsupported format (magic bytes mismatch)');
      }
    }

    if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
      throw new BadRequestError(`File format ${detectedMime} rejected by magic bytes verification`);
    }

    // 5. Virus scanner check
    const scan = await virusScanner.scanBuffer(file.buffer, file.originalname);
    if (scan.status === ScanStatus.INFECTED) {
      throw new BadRequestError(`File rejected: malware detected (${scan.threatDetails || 'Threat found'})`);
    }

    // 6. Compute SHA-256 checksum
    const checksumSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 7. Store file with randomized storage key
    const randomizedKey = `tickets/${ticketId}/${crypto.randomUUID()}.${ext}`;
    await storageService.uploadFile(randomizedKey, file.buffer, detectedMime);

    // 8. Save metadata in Postgres
    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        commentId: commentId || null,
        uploaderId: user.id,
        fileName: pathOrName(file.originalname),
        originalName: file.originalname,
        mimeType: detectedMime,
        sizeBytes: file.size,
        storageKey: randomizedKey,
        checksumSha256,
        scanStatus: scan.status,
      },
    });

    await auditService.log({
      actorId: user.id,
      action: 'ATTACHMENT_UPLOAD',
      entity: 'Attachment',
      entityId: attachment.id,
      details: { ticketId, fileName: attachment.fileName, size: attachment.sizeBytes },
    });

    return attachment;
  }

  async getDownloadUrl(attachmentId: string, user: AuthenticatedUser) {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        ticket: { select: { id: true, requesterId: true } },
        comment: { select: { id: true, visibility: true } },
      },
    });

    if (!attachment) {
      throw new NotFoundError('Attachment not found');
    }

    // Authorization checks
    if (user.role === Role.EMPLOYEE) {
      // Must own ticket
      if (attachment.ticket.requesterId !== user.id) {
        throw new NotFoundError('Attachment not found');
      }

      // Internal note isolation rule: if attachment is attached to an INTERNAL comment, employee cannot access
      if (attachment.comment && attachment.comment.visibility === 'INTERNAL') {
        throw new NotFoundError('Attachment not found');
      }
    }

    // Log attachment download in append-only audit log
    await auditService.log({
      actorId: user.id,
      action: 'ATTACHMENT_DOWNLOAD',
      entity: 'Attachment',
      entityId: attachment.id,
      details: { ticketId: attachment.ticketId, fileName: attachment.originalName },
    });

    const url = await storageService.getPresignedDownloadUrl(attachment.storageKey, attachment.originalName);
    return { url, attachment };
  }
}

function pathOrName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export const attachmentService = new AttachmentService();
