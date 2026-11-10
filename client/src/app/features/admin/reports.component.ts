import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" *ngIf="data">
      <div class="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Help Desk Operational Reports</h1>
        <p class="text-sm text-slate-500 mt-1">Multi-dimensional volume, SLA compliance, and department distribution.</p>
      </div>

      <!-- Overdue Tickets SLA Breaches Table -->
      <div class="mt-8 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-900 shadow-sm overflow-hidden">
        <div class="px-6 py-4 bg-red-50/50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900 flex justify-between items-center">
          <div>
            <h2 class="text-sm font-bold text-red-800 dark:text-red-300 uppercase tracking-wide">
              Overdue Tickets (SLA Threshold Breached)
            </h2>
            <p class="text-xs text-red-600 dark:text-red-400">Tickets that have exceeded the resolution threshold configured in Settings.</p>
          </div>
          <span class="px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
            {{ data.overdueTickets.length }} Breached
          </span>
        </div>

        <div *ngIf="data.overdueTickets.length === 0" class="p-8 text-center text-xs text-slate-500 italic">
          No overdue tickets. All requests are currently within priority SLA limits.
        </div>

        <div *ngIf="data.overdueTickets.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold uppercase">
              <tr>
                <th class="px-6 py-3">Number</th>
                <th class="px-6 py-3">Title</th>
                <th class="px-6 py-3">Priority</th>
                <th class="px-6 py-3">Status</th>
                <th class="px-6 py-3">Created</th>
                <th class="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
              <tr *ngFor="let t of data.overdueTickets" class="hover:bg-red-50/30 transition">
                <td class="px-6 py-3 font-mono font-bold text-red-700 dark:text-red-400">{{ t.ticketNumber }}</td>
                <td class="px-6 py-3 font-medium text-slate-900 dark:text-white">{{ t.title }}</td>
                <td class="px-6 py-3 font-bold text-red-600">{{ t.priority }}</td>
                <td class="px-6 py-3 uppercase">{{ t.status }}</td>
                <td class="px-6 py-3 text-slate-500">{{ t.createdAt | date:'short' }}</td>
                <td class="px-6 py-3 text-right">
                  <a [routerLink]="['/technician/tickets', t.id]" class="text-emerald-600 font-semibold hover:underline">Inspect</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Breakdown Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <!-- By Priority -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Volume by Priority</h3>
          <div class="space-y-3">
            <div *ngFor="let p of data.byPriority" class="flex justify-between items-center text-xs">
              <span class="font-semibold text-slate-800 dark:text-slate-200">{{ p.priority }}</span>
              <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 font-bold rounded">{{ p.count }}</span>
            </div>
          </div>
        </div>

        <!-- By Status -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Volume by Status</h3>
          <div class="space-y-3">
            <div *ngFor="let s of data.byStatus" class="flex justify-between items-center text-xs">
              <span class="font-semibold text-slate-800 dark:text-slate-200">{{ s.status }}</span>
              <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 font-bold rounded">{{ s.count }}</span>
            </div>
          </div>
        </div>

        <!-- By Department -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Tickets by Department</h3>
          <div class="space-y-3">
            <div *ngFor="let d of data.byDepartment" class="flex justify-between items-center text-xs">
              <span class="font-semibold text-slate-800 dark:text-slate-200">{{ d.name }}</span>
              <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 font-bold rounded">{{ d.count }}</span>
            </div>
          </div>
        </div>

        <!-- By Category -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Tickets by Technical Category</h3>
          <div class="space-y-3">
            <div *ngFor="let c of data.byCategory" class="flex justify-between items-center text-xs">
              <span class="font-semibold text-slate-800 dark:text-slate-200">{{ c.name }}</span>
              <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 font-bold rounded">{{ c.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminReportsComponent implements OnInit {
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
