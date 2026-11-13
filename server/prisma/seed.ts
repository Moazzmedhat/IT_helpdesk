import { PrismaClient, Role, PriorityLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Helpdesk database...');

  // 1. Settings
  const settings = [
    { key: 'DEFAULT_AUTO_CLOSE_DAYS', value: '3', description: 'Days after resolution before auto-closing' },
    { key: 'DEFAULT_REOPEN_WINDOW_DAYS', value: '7', description: 'Window in days during which creator can reopen resolved ticket' },
    { key: 'SLA_OVERDUE_LOW_HOURS', value: '72', description: 'Hours before LOW ticket is overdue' },
    { key: 'SLA_OVERDUE_MEDIUM_HOURS', value: '24', description: 'Hours before MEDIUM ticket is overdue' },
    { key: 'SLA_OVERDUE_HIGH_HOURS', value: '8', description: 'Hours before HIGH ticket is overdue' },
    { key: 'SLA_OVERDUE_CRITICAL_HOURS', value: '2', description: 'Hours before CRITICAL ticket is overdue' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: s,
    });
  }

  // 2. Priorities
  const priorities = [
    { level: PriorityLevel.LOW, name: 'Low', color: '#10b981', slaResponseHours: 8, slaResolveHours: 72 },
    { level: PriorityLevel.MEDIUM, name: 'Medium', color: '#3b82f6', slaResponseHours: 4, slaResolveHours: 24 },
    { level: PriorityLevel.HIGH, name: 'High', color: '#f59e0b', slaResponseHours: 2, slaResolveHours: 8 },
    { level: PriorityLevel.CRITICAL, name: 'Critical', color: '#ef4444', slaResponseHours: 1, slaResolveHours: 2 },
  ];

  for (const p of priorities) {
    await prisma.priority.upsert({
      where: { level: p.level },
      update: p,
      create: p,
    });
  }

  // 3. Departments
  const departmentsData = [
    { name: 'FX Trading', code: 'FXT' },
    { name: 'Compliance & AML', code: 'AML' },
    { name: 'Risk Management', code: 'RSK' },
    { name: 'Cash Management & Vault', code: 'CSH' },
    { name: 'Retail Operations', code: 'RET' },
    { name: 'Finance & Accounting', code: 'FIN' },
    { name: 'Human Resources', code: 'HR' },
    { name: 'Information Technology', code: 'IT' },
  ];

  const departmentsMap: Record<string, string> = {};
  for (const d of departmentsData) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: d,
    });
    departmentsMap[d.code] = dept.id;
  }

  // 4. Branches
  const branchesData = [
    { name: 'Head Office', code: 'HO-DXB', city: 'Dubai' },
    { name: 'Downtown Financial Branch', code: 'BR-DWN', city: 'Dubai' },
    { name: 'Airport Terminal 1 Branch', code: 'BR-DXB-T1', city: 'Dubai' },
    { name: 'Mall of the Emirates Branch', code: 'BR-MOE', city: 'Dubai' },
    { name: 'Marina Mall Branch', code: 'BR-MAR', city: 'Dubai' },
    { name: 'Deira Gold Souk Branch', code: 'BR-DEI', city: 'Dubai' },
  ];

  const branchesMap: Record<string, string> = {};
  for (const b of branchesData) {
    const br = await prisma.branch.upsert({
      where: { code: b.code },
      update: { name: b.name, city: b.city },
      create: b,
    });
    branchesMap[b.code] = br.id;
  }

  // 5. Categories & Subcategories
  const categoriesData = [
    {
      name: 'Hardware',
      description: 'Physical computers, monitors, POS terminals, scanners',
      subcategories: ['Workstation / PC', 'Laptop', 'Monitor / Display', 'POS Terminal', 'Peripherals / Cables']
    },
    {
      name: 'Software',
      description: 'Exchange rate system, accounting software, FX dealing platforms',
      subcategories: ['FX Exchange Portal', 'ERP / Accounting System', 'AML Screening Tool', 'Office 365', 'Browser Issues']
    },
    {
      name: 'Network and Internet',
      description: 'LAN, Wi-Fi, VPN, firewall, branch connectivity',
      subcategories: ['Branch VPN Down', 'Wi-Fi Connectivity', 'Internet Slow/Unreachable', 'LAN Port Issue']
    },
    {
      name: 'Printers and Scanners',
      description: 'Receipt printers, document scanners, passport readers',
      subcategories: ['Passport Scanner', 'Receipt Printer', 'Office Laser Printer', 'Paper Jam']
    },
    {
      name: 'Email and Accounts',
      description: 'Email access, distribution lists, shared mailboxes',
      subcategories: ['Email Login Failed', 'Shared Mailbox Access', 'Spam/Phishing Report', 'Password Reset']
    },
    {
      name: 'Access and Permissions',
      description: 'System roles, shared drives, security badge, MFA',
      subcategories: ['Shared Network Drive', 'FX System Permission Request', 'MFA Token Reset', 'Badge Access']
    },
    {
      name: 'Operating System',
      description: 'Windows updates, blue screens, freeze/crash',
      subcategories: ['Windows Crash / BSOD', 'Slow Performance', 'Update Pending / Stuck']
    },
    {
      name: 'Other',
      description: 'General IT requests and unlisted issues',
      subcategories: ['General Inquiry', 'IT Equipment Relocation', 'Other']
    }
  ];

  for (const cat of categoriesData) {
    const c = await prisma.category.upsert({
      where: { name: cat.name },
      update: { description: cat.description },
      create: { name: cat.name, description: cat.description },
    });

    for (const sub of cat.subcategories) {
      await prisma.subcategory.upsert({
        where: {
          categoryId_name: {
            categoryId: c.id,
            name: sub,
          }
        },
        update: {},
        create: {
          categoryId: c.id,
          name: sub,
        }
      });
    }
  }

  // 6. Users
  const users = [
    // Admin
    {
      email: 'admin@currencyexchange.local',
      fullName: 'Sarah Jenkins (IT Director)',
      role: Role.ADMIN,
      deptCode: 'IT',
      branchCode: 'HO-DXB',
    },
    // Technicians
    {
      email: 'tech1@currencyexchange.local',
      fullName: 'Alex Vance (Senior Technician)',
      role: Role.TECHNICIAN,
      deptCode: 'IT',
      branchCode: 'HO-DXB',
    },
    {
      email: 'tech2@currencyexchange.local',
      fullName: 'Marcus Brody (Support Specialist)',
      role: Role.TECHNICIAN,
      deptCode: 'IT',
      branchCode: 'BR-DWN',
    },
    {
      email: 'tech3@currencyexchange.local',
      fullName: 'Elena Rostova (Systems Engineer)',
      role: Role.TECHNICIAN,
      deptCode: 'IT',
      branchCode: 'BR-DXB-T1',
    },
    // Employees
    {
      email: 'emp1@currencyexchange.local',
      fullName: 'David Sterling (Senior FX Trader)',
      role: Role.EMPLOYEE,
      deptCode: 'FXT',
      branchCode: 'HO-DXB',
    },
    {
      email: 'emp2@currencyexchange.local',
      fullName: 'Layla Al-Mansoor (Chief Cashier)',
      role: Role.EMPLOYEE,
      deptCode: 'CSH',
      branchCode: 'BR-DXB-T1',
    },
    {
      email: 'emp3@currencyexchange.local',
      fullName: 'Robert Chen (AML Compliance Officer)',
      role: Role.EMPLOYEE,
      deptCode: 'AML',
      branchCode: 'BR-DWN',
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        role: u.role,
        departmentId: departmentsMap[u.deptCode],
        branchId: branchesMap[u.branchCode],
        isActive: true,
      },
      create: {
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        departmentId: departmentsMap[u.deptCode],
        branchId: branchesMap[u.branchCode],
        isActive: true,
      },
    });
  }

  // 7. Seed Tickets & Operational History
  const seededUsers = await prisma.user.findMany();
  const userMap = new Map(seededUsers.map(u => [u.email, u.id]));
  const categoriesList = await prisma.category.findMany();
  const catLookup = new Map(categoriesList.map(c => [c.name, c.id]));

  const sampleTickets = [
    {
      ticketNumber: 'TKT-2026-0001',
      title: 'Bloomberg FX Dealing Terminal Latency & Feed Stalling',
      description: 'Experiencing intermittent 3-5 second freezes on EUR/USD tick updates during high-volatility sessions.',
      requesterEmail: 'emp1@currencyexchange.local',
      assignedEmail: 'tech1@currencyexchange.local',
      deptCode: 'FXT',
      branchCode: 'HO-DXB',
      categoryName: 'Software',
      priority: PriorityLevel.CRITICAL,
      status: 'IN_PROGRESS' as any,
      claimedAt: new Date(Date.now() - 3 * 3600 * 1000),
      createdAt: new Date(Date.now() - 4 * 3600 * 1000),
    },
    {
      ticketNumber: 'TKT-2026-0002',
      title: 'Branch Vault POS Receipt Thermal Printer Jamming',
      description: 'Counter 2 receipt printer continuously reporting paper jam despite clearing path. Need urgent inspection.',
      requesterEmail: 'emp2@currencyexchange.local',
      assignedEmail: 'tech2@currencyexchange.local',
      deptCode: 'CSH',
      branchCode: 'BR-DXB-T1',
      categoryName: 'Printers and Scanners',
      priority: PriorityLevel.HIGH,
      status: 'RESOLVED' as any,
      claimedAt: new Date(Date.now() - 5 * 3600 * 1000),
      resolvedAt: new Date(Date.now() - 1 * 3600 * 1000),
      createdAt: new Date(Date.now() - 6 * 3600 * 1000),
    },
    {
      ticketNumber: 'TKT-2026-0003',
      title: 'Sanctions & AML Watchlist Screening Tool API Timeout',
      description: 'Compliance system getting 504 Gateway Timeout when executing batch screening against UN sanctions list.',
      requesterEmail: 'emp3@currencyexchange.local',
      assignedEmail: 'tech3@currencyexchange.local',
      deptCode: 'AML',
      branchCode: 'BR-DWN',
      categoryName: 'Software',
      priority: PriorityLevel.HIGH,
      status: 'OPEN' as any,
      createdAt: new Date(Date.now() - 10 * 3600 * 1000),
    },
    {
      ticketNumber: 'TKT-2026-0004',
      title: 'Workstation Display Port Flicker on Dealing Desk 4',
      description: 'Secondary portrait monitor goes black randomly when adjusting tilt.',
      requesterEmail: 'emp1@currencyexchange.local',
      assignedEmail: 'tech1@currencyexchange.local',
      deptCode: 'FXT',
      branchCode: 'HO-DXB',
      categoryName: 'Hardware',
      priority: PriorityLevel.MEDIUM,
      status: 'CLOSED' as any,
      claimedAt: new Date(Date.now() - 24 * 3600 * 1000),
      resolvedAt: new Date(Date.now() - 20 * 3600 * 1000),
      closedAt: new Date(Date.now() - 18 * 3600 * 1000),
      createdAt: new Date(Date.now() - 26 * 3600 * 1000),
    },
    {
      ticketNumber: 'TKT-2026-0005',
      title: 'Branch Secure VPN Tunnel Failover Route Check',
      description: 'Downtown branch failover line testing required ahead of weekend banking sync.',
      requesterEmail: 'emp3@currencyexchange.local',
      assignedEmail: 'tech2@currencyexchange.local',
      deptCode: 'AML',
      branchCode: 'BR-DWN',
      categoryName: 'Network and Internet',
      priority: PriorityLevel.LOW,
      status: 'RESOLVED' as any,
      claimedAt: new Date(Date.now() - 14 * 3600 * 1000),
      resolvedAt: new Date(Date.now() - 8 * 3600 * 1000),
      createdAt: new Date(Date.now() - 16 * 3600 * 1000),
    },
  ];

  for (const st of sampleTickets) {
    const reqId = userMap.get(st.requesterEmail);
    const assignId = st.assignedEmail ? userMap.get(st.assignedEmail) : null;
    const deptId = departmentsMap[st.deptCode];
    const brId = branchesMap[st.branchCode];
    const catId = catLookup.get(st.categoryName);

    if (reqId && deptId && brId && catId) {
      await prisma.ticket.upsert({
        where: { ticketNumber: st.ticketNumber },
        update: {},
        create: {
          ticketNumber: st.ticketNumber,
          title: st.title,
          description: st.description,
          requesterId: reqId,
          assignedToId: assignId,
          departmentId: deptId,
          branchId: brId,
          categoryId: catId,
          priority: st.priority,
          status: st.status,
          claimedAt: st.claimedAt || null,
          resolvedAt: st.resolvedAt || null,
          closedAt: (st as any).closedAt || null,
          createdAt: st.createdAt,
        },
      });
    }
  }

  await prisma.yearSequence.upsert({
    where: { year: 2026 },
    update: { lastNumber: 5 },
    create: { year: 2026, lastNumber: 5 },
  });

  console.log('Seed completed successfully with realistic tickets and operational metrics.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
