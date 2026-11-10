import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { auditService } from '../audit/audit.service';
import { autoCloseJob } from '../../jobs/auto-close.job';

const router = Router();

// Master data in-memory cache
let cachedDepartments: any = null;
let departmentsCacheTime = 0;
let cachedBranches: any = null;
let branchesCacheTime = 0;
let cachedCategories: any = null;
let categoriesCacheTime = 0;
let cachedPriorities: any = null;
let prioritiesCacheTime = 0;
const MASTER_DATA_TTL_MS = 60000; // 60 seconds

// Master data reading is available to all authenticated staff/employees for ticket forms
router.get('/departments', authenticate, async (req: Request, res: Response) => {
  const now = Date.now();
  if (cachedDepartments && (now - departmentsCacheTime < MASTER_DATA_TTL_MS)) {
    return res.status(200).json({ departments: cachedDepartments });
  }
  cachedDepartments = await prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  departmentsCacheTime = now;
  res.status(200).json({ departments: cachedDepartments });
});

router.get('/branches', authenticate, async (req: Request, res: Response) => {
  const now = Date.now();
  if (cachedBranches && (now - branchesCacheTime < MASTER_DATA_TTL_MS)) {
    return res.status(200).json({ branches: cachedBranches });
  }
  cachedBranches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  branchesCacheTime = now;
  res.status(200).json({ branches: cachedBranches });
});

router.get('/categories', authenticate, async (req: Request, res: Response) => {
  const now = Date.now();
  if (cachedCategories && (now - categoriesCacheTime < MASTER_DATA_TTL_MS)) {
    return res.status(200).json({ categories: cachedCategories });
  }
  cachedCategories = await prisma.category.findMany({
    where: { isActive: true },
    include: { subcategories: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  });
  categoriesCacheTime = now;
  res.status(200).json({ categories: cachedCategories });
});

router.get('/priorities', authenticate, async (req: Request, res: Response) => {
  const now = Date.now();
  if (cachedPriorities && (now - prioritiesCacheTime < MASTER_DATA_TTL_MS)) {
    return res.status(200).json({ priorities: cachedPriorities });
  }
  cachedPriorities = await prisma.priority.findMany({ where: { isActive: true }, orderBy: { slaResponseHours: 'desc' } });
  prioritiesCacheTime = now;
  res.status(200).json({ priorities: cachedPriorities });
});

// Admin-only management endpoints
const adminOnly = [authenticate, requireRole(Role.ADMIN)];

// Settings
router.get('/settings', ...adminOnly, async (req: Request, res: Response) => {
  const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  res.status(200).json({ settings });
});

const updateSettingSchema = z.object({
  value: z.string().min(1),
});

router.patch('/settings/:key', ...adminOnly, async (req: Request, res: Response) => {
  const { key } = req.params;
  const parsed = updateSettingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation Error', message: 'Setting value cannot be empty' });
  }

  const prev = await prisma.setting.findUnique({ where: { key } });
  const updated = await prisma.setting.update({
    where: { key },
    data: { value: parsed.data.value },
  });

  await auditService.log({
    actorId: req.user!.id,
    action: 'SETTINGS_CHANGE',
    entity: 'Setting',
    entityId: key,
    details: { previousValue: prev?.value, newValue: parsed.data.value },
  });

  res.status(200).json({ success: true, setting: updated });
});

// Users management
router.get('/users', ...adminOnly, async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    include: { department: true, branch: true },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  });
  res.status(200).json({ users });
});

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.nativeEnum(Role).default(Role.EMPLOYEE),
  departmentId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
});

router.post('/users', ...adminOnly, async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation Error', message: parsed.error.issues[0]?.message || 'Invalid user data' });
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'Conflict', message: 'A user with this email address already exists' });
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      fullName: parsed.data.fullName.trim(),
      role: parsed.data.role,
      departmentId: parsed.data.departmentId || null,
      branchId: parsed.data.branchId || null,
      isActive: parsed.data.isActive,
    },
    include: { department: true, branch: true },
  });

  await auditService.log({
    actorId: req.user!.id,
    action: 'USER_CREATE',
    entity: 'User',
    entityId: user.id,
    details: { email: user.email, role: user.role, fullName: user.fullName },
  });

  res.status(201).json({ success: true, user });
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(Role).optional(),
  departmentId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.put('/users/:id', ...adminOnly, async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation Error', message: parsed.error.issues[0]?.message || 'Invalid user data' });
  }

  const prev = await prisma.user.findUnique({ where: { id } });
  if (!prev) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found' });
  }

  if (parsed.data.email && parsed.data.email.toLowerCase().trim() !== prev.email.toLowerCase()) {
    const conflict = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } });
    if (conflict) {
      return res.status(409).json({ error: 'Conflict', message: 'Another user with this email address already exists' });
    }
  }

  const updateData: any = {};
  if (parsed.data.fullName !== undefined) updateData.fullName = parsed.data.fullName.trim();
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email.toLowerCase().trim();
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.departmentId !== undefined) updateData.departmentId = parsed.data.departmentId || null;
  if (parsed.data.branchId !== undefined) updateData.branchId = parsed.data.branchId || null;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: { department: true, branch: true },
  });

  await auditService.log({
    actorId: req.user!.id,
    action: 'USER_UPDATE',
    entity: 'User',
    entityId: user.id,
    details: { changes: updateData },
  });

  res.status(200).json({ success: true, user });
});

router.delete('/users/:id', ...adminOnly, async (req: Request, res: Response) => {
  const { id } = req.params;

  if (id === req.user!.id) {
    return res.status(400).json({ error: 'Bad Request', message: 'You cannot delete your own administrative account' });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          requestedTickets: true,
          assignedTickets: true,
          comments: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found' });
  }

  const hasHistory = user._count.requestedTickets > 0 || user._count.assignedTickets > 0 || user._count.comments > 0;

  if (hasHistory) {
    // Soft delete / deactivate to maintain referential audit integrity
    const deactivated = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: { department: true, branch: true },
    });

    // Revoke active sessions
    await prisma.session.deleteMany({ where: { userId: id } });

    await auditService.log({
      actorId: req.user!.id,
      action: 'USER_DEACTIVATE',
      entity: 'User',
      entityId: id,
      details: { email: user.email, reason: 'Deactivated instead of deleted due to historical ticket records' },
    });

    return res.status(200).json({
      success: true,
      deactivated: true,
      user: deactivated,
      message: 'User has associated tickets/comments. Account was deactivated and sessions revoked to preserve ticket history.',
    });
  }

  // Safe hard delete: clean sessions and notifications first
  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.notification.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });

  await auditService.log({
    actorId: req.user!.id,
    action: 'USER_DELETE',
    entity: 'User',
    entityId: id,
    details: { email: user.email, fullName: user.fullName },
  });

  res.status(200).json({ success: true, message: 'User deleted successfully' });
});

const updateUserRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

router.patch('/users/:id/role', ...adminOnly, async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = updateUserRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation Error', message: 'Invalid role' });
  }

  const prev = await prisma.user.findUnique({ where: { id } });
  const updated = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
  });

  await auditService.log({
    actorId: req.user!.id,
    action: 'ROLE_CHANGE',
    entity: 'User',
    entityId: id,
    details: { previousRole: prev?.role, newRole: parsed.data.role },
  });

  res.status(200).json({ success: true, user: updated });
});

router.patch('/users/:id/toggle-active', ...adminOnly, async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found' });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
  });

  await auditService.log({
    actorId: req.user!.id,
    action: updated.isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
    entity: 'User',
    entityId: id,
    details: { email: user.email },
  });

  res.status(200).json({ success: true, user: updated });
});

// Audit Logs
router.get('/audit-logs', ...adminOnly, async (req: Request, res: Response) => {
  const { action, entity, limit, offset } = req.query;
  const result = await auditService.query({
    action: action as string,
    entity: entity as string,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0,
  });

  res.status(200).json({ success: true, logs: result.logs, total: result.total });
});

// Auto-Close Trigger Endpoint
router.post('/jobs/auto-close', ...adminOnly, async (req: Request, res: Response) => {
  const result = await autoCloseJob.runAutoClose();
  res.status(200).json({ success: true, result });
});

export const adminRouter = router;
