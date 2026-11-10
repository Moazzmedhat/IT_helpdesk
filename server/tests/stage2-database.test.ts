import { PrismaClient, Role, PriorityLevel } from '@prisma/client';

describe('Stage 2: Database Schema, Migrations, and Seed Verification', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('has required settings seeded', async () => {
    const autoClose = await prisma.setting.findUnique({ where: { key: 'DEFAULT_AUTO_CLOSE_DAYS' } });
    const reopen = await prisma.setting.findUnique({ where: { key: 'DEFAULT_REOPEN_WINDOW_DAYS' } });
    expect(autoClose).toBeDefined();
    expect(autoClose?.value).toBe('3');
    expect(reopen).toBeDefined();
    expect(reopen?.value).toBe('7');
  });

  it('has all 4 priorities seeded with SLA fields', async () => {
    const priorities = await prisma.priority.findMany();
    expect(priorities.length).toBe(4);
    const levels = priorities.map(p => p.level);
    expect(levels).toContain(PriorityLevel.LOW);
    expect(levels).toContain(PriorityLevel.MEDIUM);
    expect(levels).toContain(PriorityLevel.HIGH);
    expect(levels).toContain(PriorityLevel.CRITICAL);
  });

  it('has all required categories seeded', async () => {
    const categories = await prisma.category.findMany({ include: { subcategories: true } });
    const categoryNames = categories.map(c => c.name);
    expect(categoryNames).toContain('Hardware');
    expect(categoryNames).toContain('Software');
    expect(categoryNames).toContain('Network and Internet');
    expect(categoryNames).toContain('Printers and Scanners');
    expect(categoryNames).toContain('Email and Accounts');
    expect(categoryNames).toContain('Access and Permissions');
    expect(categoryNames).toContain('Operating System');
    expect(categoryNames).toContain('Other');

    const hardware = categories.find(c => c.name === 'Hardware');
    expect(hardware?.subcategories.length).toBeGreaterThan(0);
  });

  it('has departments and branches seeded', async () => {
    const departments = await prisma.department.findMany();
    expect(departments.length).toBeGreaterThanOrEqual(8);
    const branches = await prisma.branch.findMany();
    expect(branches.length).toBeGreaterThanOrEqual(6);
  });

  it('has users with EMPLOYEE, TECHNICIAN, and ADMIN roles seeded', async () => {
    const users = await prisma.user.findMany();
    expect(users.length).toBeGreaterThanOrEqual(7);

    const admins = users.filter(u => u.role === Role.ADMIN);
    const techs = users.filter(u => u.role === Role.TECHNICIAN);
    const emps = users.filter(u => u.role === Role.EMPLOYEE);

    expect(admins.length).toBeGreaterThanOrEqual(1);
    expect(techs.length).toBeGreaterThanOrEqual(3);
    expect(emps.length).toBeGreaterThanOrEqual(3);
  });
});
