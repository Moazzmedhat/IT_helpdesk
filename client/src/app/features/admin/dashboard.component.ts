import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" *ngIf="data">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">IT Administration & System Oversight</h1>
          <p class="text-sm text-slate-500 mt-1">Enterprise currency exchange help desk metrics and operational health.</p>
        </div>
        <div class="mt-4 sm:mt-0 flex space-x-3">
          <a routerLink="/admin/reports" class="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-sm transition">
            Detailed Reports &rarr;
          </a>
        </div>
      </div>

      <!-- KPI Executive Grid -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Tickets</div>
          <div class="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{{ data.summary.totalTickets }}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">All-time volume</div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Open</div>
          <div class="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{{ data.summary.openTickets }}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Needs action</div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Resolved</div>
          <div class="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ data.summary.resolvedTickets }}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Resolved/Closed</div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overdue SLA</div>
          <div class="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">{{ data.summary.overdueCount }}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Threshold breached</div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Resolution</div>
          <div class="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{{ data.summary.avgResolutionHours }}h</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Hours to resolved</div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg First Reply</div>
          <div class="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{{ data.summary.avgFirstResponseHours }}h</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Public tech response</div>
        </div>
      </div>

      <!-- Quick Actions and Navigation Grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <a routerLink="/admin/tickets" class="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-600 transition group">
          <div class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600">All Enterprise Tickets</div>
          <p class="text-xs text-slate-500 mt-1">Audit, reassign, or force transitions across queues.</p>
        </a>
        <a routerLink="/admin/users" class="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-600 transition group">
          <div class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600">User Management</div>
          <p class="text-xs text-slate-500 mt-1">Configure employee and technician roles and active status.</p>
        </a>
        <a routerLink="/admin/audit-logs" class="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-600 transition group">
          <div class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600">Audit Logs</div>
          <p class="text-xs text-slate-500 mt-1">Immutable audit trail of logins, claims, and overrides.</p>
        </a>
        <a routerLink="/admin/settings" class="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-600 transition group">
          <div class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600">System Settings</div>
          <p class="text-xs text-slate-500 mt-1">Auto-close schedules, SLA thresholds, and reopen windows.</p>
        </a>
      </div>

      <!-- Technician Performance Leaderboard -->
      <div class="mt-8 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 class="text-base font-bold text-slate-900 dark:text-white">Technician Resolution Workload</h2>
        </div>
        <div class="p-6">
          <div class="divide-y divide-slate-100 dark:divide-slate-700">
            <div *ngFor="let tw of data.technicianPerformance" class="py-3 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-900 dark:text-white">{{ tw.name }}</div>
                <div class="text-[10px] text-slate-400">Staff Technician</div>
              </div>
              <div class="text-right">
                <span class="text-sm font-bold text-emerald-600 dark:text-emerald-400">{{ tw.resolvedCount }}</span>
                <span class="text-xs text-slate-500 ml-1">tickets resolved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminDashboardComponent implements OnInit {
  private adminService = inject(AdminService);
  data: any = null;

  ngOnInit() {
    this.adminService.getDashboardReports().subscribe({
      next: (res) => {
        this.data = res.data;
      }
    });
  }
}
