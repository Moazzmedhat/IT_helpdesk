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
