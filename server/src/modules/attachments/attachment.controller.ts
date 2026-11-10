import { Request, Response, NextFunction } from 'express';
import { attachmentService } from './attachment.service';
import { storageService } from './storage.service';

export class AttachmentController {
  async uploadAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const { ticketId } = req.params;
      const { commentId } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Validation Error', message: 'No file uploaded' });
      }

      const attachment = await attachmentService.validateAndUpload(
        {
          ticketId,
          commentId,
          file,
        },
        req.user!
      );

      res.status(201).json({ success: true, attachment });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }

  async getDownloadUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await attachmentService.getDownloadUrl(id, req.user!);
      res.status(200).json({ success: true, url: result.url, attachment: result.attachment });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }

  async downloadLocalFile(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const buffer = await storageService.getFileBuffer(decodeURIComponent(key));
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(buffer);
    } catch (error) {
      res.status(404).json({ error: 'Not Found', message: 'File not found' });
    }
  }
}

export const attachmentController = new AttachmentController();
