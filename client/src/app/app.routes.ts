import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  // Employee routes
  {
    path: 'employee/dashboard',
    canActivate: [authGuard, roleGuard('EMPLOYEE')],
    loadComponent: () => import('./features/employee/dashboard.component').then(m => m.EmployeeDashboardComponent),
  },
  {
    path: 'employee/create-ticket',
    canActivate: [authGuard, roleGuard('EMPLOYEE')],
    loadComponent: () => import('./features/employee/create-ticket.component').then(m => m.CreateTicketComponent),
  },
  {
    path: 'employee/tickets',
    canActivate: [authGuard, roleGuard('EMPLOYEE')],
    loadComponent: () => import('./features/employee/my-tickets.component').then(m => m.MyTicketsComponent),
  },
  {
    path: 'employee/tickets/:id',
    canActivate: [authGuard, roleGuard('EMPLOYEE')],
    loadComponent: () => import('./features/employee/ticket-detail.component').then(m => m.TicketDetailComponent),
  },

  // Technician routes
  {
    path: 'technician/dashboard',
    canActivate: [authGuard, roleGuard('TECHNICIAN', 'ADMIN')],
    loadComponent: () => import('./features/technician/dashboard.component').then(m => m.TechnicianDashboardComponent),
  },
  {
    path: 'technician/queue',
    canActivate: [authGuard, roleGuard('TECHNICIAN', 'ADMIN')],
    loadComponent: () => import('./features/technician/queue.component').then(m => m.TechnicianQueueComponent),
    data: { mode: 'queue' },
  },
  {
    path: 'technician/my-tickets',
    canActivate: [authGuard, roleGuard('TECHNICIAN', 'ADMIN')],
    loadComponent: () => import('./features/technician/queue.component').then(m => m.TechnicianQueueComponent),
    data: { mode: 'my-tickets' },
  },
  {
    path: 'technician/tickets/:id',
    canActivate: [authGuard, roleGuard('TECHNICIAN', 'ADMIN')],
    loadComponent: () => import('./features/technician/technician-ticket-detail.component').then(m => m.TechnicianTicketDetailComponent),
  },

  // Admin routes
  {
    path: 'admin/dashboard',
    canActivate: [authGuard, roleGuard('ADMIN')],
    loadComponent: () => import('./features/admin/dashboard.component').then(m => m.AdminDashboardComponent),
  },
  {
    path: 'admin/reports',
    canActivate: [authGuard, roleGuard('ADMIN')],
    loadComponent: () => import('./features/admin/reports.component').then(m => m.AdminReportsComponent),
  },
  {
    path: 'admin/tickets',
    canActivate: [authGuard, roleGuard('ADMIN')],
    loadComponent: () => import('./features/technician/queue.component').then(m => m.TechnicianQueueComponent),
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, roleGuard('ADMIN')],
    loadComponent: () => import('./features/admin/users.component').then(m => m.AdminUsersComponent),
  },
  {
    path: 'admin/audit-logs',
    canActivate: [authGuard, roleGuard('ADMIN')],
    loadComponent: () => import('./features/admin/audit-logs.component').then(m => m.AdminAuditLogsComponent),
  },
  {
    path: 'admin/settings',
    canActivate: [authGuard, roleGuard('ADMIN')],
    loadComponent: () => import('./features/admin/settings.component').then(m => m.AdminSettingsComponent),
  },

  { path: '**', redirectTo: 'login' },
];
