import { Router } from 'express';
import { ticketController } from './ticket.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// All ticket routes require authentication
router.use(authenticate);

router.post('/', requireRole(Role.EMPLOYEE), ticketController.createTicket);
router.get('/', ticketController.listTickets);
router.get('/:id', ticketController.getTicketById);
router.post('/:id/claim', requireRole(Role.TECHNICIAN), ticketController.claimTicket);
router.post('/:id/release', requireRole(Role.TECHNICIAN, Role.ADMIN), ticketController.releaseTicket);
router.post('/:id/transition', ticketController.transitionStatus);
router.post('/:id/reassign', requireRole(Role.ADMIN), ticketController.reassignTicket);

export const ticketRouter = router;
