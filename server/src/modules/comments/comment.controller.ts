import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CommentVisibility } from '@prisma/client';
import { commentService } from './comment.service';

const addCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  visibility: z.nativeEnum(CommentVisibility).optional(),
});

export class CommentController {
  async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { ticketId } = req.params;
      const parsed = addCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation Error', message: 'Comment content cannot be empty' });
      }

      const comment = await commentService.addComment(
        {
          ticketId,
          content: parsed.data.content,
          visibility: parsed.data.visibility,
        },
        req.user!
      );

      res.status(201).json({ success: true, comment });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }

  async getComments(req: Request, res: Response, next: NextFunction) {
    try {
      const { ticketId } = req.params;
      const comments = await commentService.getCommentsByTicketId(ticketId, req.user!);
      res.status(200).json({ success: true, comments });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }
}

export const commentController = new CommentController();
