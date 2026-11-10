import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PriorityLevel, TicketStatus } from '@prisma/client';
import { ticketService } from './ticket.service';

const createTicketSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  categoryId: z.string().uuid('Category is required'),
  subcategoryId: z.string().uuid().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  priority: z.nativeEnum(PriorityLevel).optional(),
  departmentId: z.string().uuid().optional().nullable().or(z.literal('')).transform(v => (v ? v : undefined)),
  branchId: z.string().uuid().optional().nullable().or(z.literal('')).transform(v => (v ? v : undefined)),
  deviceAssetTag: z.string().max(50).optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
});

const releaseSchema = z.object({
  reason: z.string().min(3).max(500),
});

const transitionSchema = z.object({
  status: z.nativeEnum(TicketStatus),
  reason: z.string().max(500).optional(),
});

const reassignSchema = z.object({
  technicianId: z.string().uuid(),
  reason: z.string().min(3).max(500),
});

export class TicketController {
  async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        const flat = parsed.error.flatten();
        const fieldErrors = Object.entries(flat.fieldErrors)
          .map(([f, errs]) => `${f}: ${errs?.join(', ')}`)
          .join('; ');
        return res.status(400).json({
          error: 'Validation Error',
          message: fieldErrors || 'Invalid input fields',
          details: flat,
        });
      }

      const ticket = await ticketService.createTicket(parsed.data, req.user!);
      res.status(201).json({ success: true, ticket });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }

  async getTicketById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const ticket = await ticketService.getTicketById(id, req.user!);
      res.status(200).json({ success: true, ticket });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }

  async listTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        status,
        priority,
        departmentId,
        branchId,
        categoryId,
        search,
        queueTab,
        assignedToId,
        myAssigned,
        limit,
        offset,
        sortBy,
        sortOrder,
      } = req.query;

      const targetAssignedToId = myAssigned === 'true' ? req.user!.id : (assignedToId as string);

      const result = await ticketService.listTickets(
        {
          status: status as any,
          priority: priority as any,
          departmentId: departmentId as string,
          branchId: branchId as string,
          categoryId: categoryId as string,
          search: search as string,
          queueTab: queueTab as any,
          assignedToId: targetAssignedToId,
          limit: limit ? parseInt(limit as string, 10) : 20,
          offset: offset ? parseInt(offset as string, 10) : 0,
          sortBy: sortBy as any,
          sortOrder: sortOrder as any,
        },
        req.user!
      );

      res.status(200).json({
        success: true,
        tickets: result.tickets,
        total: result.total,
        limit: limit ? parseInt(limit as string, 10) : 20,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }

  async claimTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const ticket = await ticketService.claimTicket(id, req.user!);
      res.status(200).json({ success: true, message: 'Ticket claimed successfully', ticket });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }

  async releaseTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = releaseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation Error', message: 'Reason is required to release ticket' });
      }

      const ticket = await ticketService.releaseTicket(id, parsed.data.reason, req.user!);
      res.status(200).json({ success: true, message: 'Ticket released successfully', ticket });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }

  async transitionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = transitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation Error', message: 'Invalid status transition payload' });
      }

      const ticket = await ticketService.transitionStatus(id, parsed.data.status, parsed.data.reason, req.user!);
      res.status(200).json({ success: true, message: 'Status updated successfully', ticket });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }

  async reassignTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = reassignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation Error', message: 'Technician ID and reason are required' });
      }

      const ticket = await ticketService.reassignTicket(id, parsed.data.technicianId, parsed.data.reason, req.user!);
      res.status(200).json({ success: true, message: 'Ticket reassigned successfully', ticket });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.name, message: error.message });
      }
      next(error);
    }
  }
}

export const ticketController = new TicketController();
