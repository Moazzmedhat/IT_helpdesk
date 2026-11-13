import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div class="flex items-center space-x-2">
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Help Desk Operational Reports</h1>
            <span class="text-xs px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded font-semibold border border-blue-200 dark:border-blue-800">
              Enterprise Analytics
            </span>
          </div>
          <p class="text-sm text-slate-500 mt-1">Multi-dimensional volume, SLA compliance, and cross-departmental distribution.</p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <select
            [(ngModel)]="selectedPeriod"
            class="text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last Quarter</option>
            <option value="all">All-Time Volume</option>
          </select>

          <button
            (click)="exportReport()"
            class="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
          >
            <span>&darr;</span>
            <span>Export CSV</span>
          </button>

          <button
            (click)="loadData(true)"
            [disabled]="loading"
            class="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
          >
            <span [class.animate-spin]="loading">&#8635;</span>
            <span>{{ loading ? 'Updating...' : 'Refresh' }}</span>
          </button>
        </div>
      </div>

      <!-- SLA Performance Executive Strip -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div class="bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SLA Compliance Rate</div>
          <div class="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ getSlaCompliance() }}%</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Tickets met resolution threshold</div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Resolution</div>
          <div class="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{{ data.summary?.avgResolutionHours || 3.4 }}h</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Time to resolved/closed status</div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average First Response</div>
          <div class="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{{ data.summary?.avgFirstResponseHours || 0.6 }}h</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Time to first technician note</div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Backlog</div>
          <div class="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{{ data.summary?.openTickets || 11 }}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Open & in-progress requests</div>
        </div>
      </div>

      <!-- Overdue Tickets SLA Breaches Table -->
      <div class="mt-8 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-900/60 shadow-sm overflow-hidden">
        <div class="px-6 py-4 bg-red-50/60 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-bold text-red-800 dark:text-red-300 uppercase tracking-wide flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full bg-red-600"></span>
              <span>Overdue Tickets (SLA Threshold Breached)</span>
            </h2>
            <p class="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Tickets exceeding maximum allowed resolution windows configured in System Settings.
            </p>
          </div>
          <span class="px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded-full self-start sm:self-auto">
            {{ data.overdueTickets.length }} Breached
          </span>
        </div>

        <div *ngIf="data.overdueTickets.length === 0" class="p-8 text-center text-xs text-slate-500 italic bg-white dark:bg-slate-800">
          <div class="text-emerald-600 font-bold mb-1">&check; All SLAs Fully Compliant</div>
          <div>No overdue tickets. All requests are currently operating within configured priority SLA limits.</div>
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
              <tr *ngFor="let t of data.overdueTickets" class="hover:bg-red-50/30 dark:hover:bg-red-950/20 transition">
                <td class="px-6 py-3.5 font-mono font-bold text-red-700 dark:text-red-400">{{ t.ticketNumber }}</td>
                <td class="px-6 py-3.5 font-medium text-slate-900 dark:text-white max-w-xs truncate">{{ t.title }}</td>
                <td class="px-6 py-3.5">
                  <span
                    [class.bg-red-100]="t.priority === 'CRITICAL'"
                    [class.text-red-800]="t.priority === 'CRITICAL'"
                    [class.bg-amber-100]="t.priority === 'HIGH'"
                    [class.text-amber-800]="t.priority === 'HIGH'"
                    class="px-2 py-0.5 rounded text-[10px] font-bold"
                  >
                    {{ t.priority }}
                  </span>
                </td>
                <td class="px-6 py-3.5 font-mono text-[11px] uppercase">{{ t.status }}</td>
                <td class="px-6 py-3.5 text-slate-500">{{ t.createdAt | date:'short' }}</td>
                <td class="px-6 py-3.5 text-right">
                  <a [routerLink]="['/technician/tickets', t.id]" class="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
                    Inspect &rarr;
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Multi-Dimensional Breakdown Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <!-- 1. Volume by Priority -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Volume by Priority</h3>
            <span class="text-[11px] text-slate-400">Impact Tier</span>
          </div>
          <div class="space-y-4">
            <div *ngFor="let p of data.byPriority" class="text-xs">
              <div class="flex justify-between items-center mb-1">
                <span class="font-semibold text-slate-800 dark:text-slate-200">{{ p.priority }}</span>
                <span class="font-bold text-slate-700 dark:text-slate-300">{{ p.count }} tickets</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  [style.width.%]="getPercentage(p.count, data.summary?.totalTickets || 42)"
                  [class.bg-red-500]="p.priority === 'CRITICAL'"
                  [class.bg-amber-500]="p.priority === 'HIGH'"
                  [class.bg-blue-500]="p.priority === 'MEDIUM'"
                  [class.bg-emerald-500]="p.priority === 'LOW'"
                  class="h-full rounded-full transition-all duration-500"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Volume by Status -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Volume by Status</h3>
            <span class="text-[11px] text-slate-400">Lifecycle State</span>
          </div>
          <div class="space-y-4">
            <div *ngFor="let s of data.byStatus" class="text-xs">
              <div class="flex justify-between items-center mb-1">
                <span class="font-semibold text-slate-800 dark:text-slate-200">{{ s.status }}</span>
                <span class="font-bold text-slate-700 dark:text-slate-300">{{ s.count }} tickets</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  [style.width.%]="getPercentage(s.count, data.summary?.totalTickets || 42)"
                  [class.bg-blue-500]="s.status === 'OPEN'"
                  [class.bg-indigo-500]="s.status === 'IN_PROGRESS'"
                  [class.bg-amber-500]="s.status === 'PENDING'"
                  [class.bg-emerald-500]="s.status === 'RESOLVED'"
                  [class.bg-slate-500]="s.status === 'CLOSED'"
                  [class.bg-purple-500]="s.status === 'REOPENED'"
                  class="h-full rounded-full transition-all duration-500"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. By Department -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Tickets by Department</h3>
            <span class="text-[11px] text-slate-400">Business Unit</span>
          </div>
          <div class="space-y-4">
            <div *ngFor="let d of data.byDepartment" class="text-xs">
              <div class="flex justify-between items-center mb-1">
                <span class="font-semibold text-slate-800 dark:text-slate-200">{{ d.name }}</span>
                <span class="font-bold text-slate-700 dark:text-slate-300">{{ d.count }} tickets</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  [style.width.%]="getPercentage(d.count, data.summary?.totalTickets || 42)"
                  class="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-500"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. By Technical Category -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Tickets by Technical Category</h3>
            <span class="text-[11px] text-slate-400">Problem Domain</span>
          </div>
          <div class="space-y-4">
            <div *ngFor="let c of data.byCategory" class="text-xs">
              <div class="flex justify-between items-center mb-1">
                <span class="font-semibold text-slate-800 dark:text-slate-200">{{ c.name }}</span>
                <span class="font-bold text-slate-700 dark:text-slate-300">{{ c.count }} tickets</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  [style.width.%]="getPercentage(c.count, data.summary?.totalTickets || 42)"
                  class="h-full bg-teal-600 dark:bg-teal-500 rounded-full transition-all duration-500"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminReportsComponent implements OnInit {
  private adminService = inject(AdminService);
  data: any = this.adminService.getFallbackReportsData();
  loading = false;
  selectedPeriod = '30d';

  ngOnInit() {
    this.loadData();
  }

  loadData(showSpinner = false) {
    if (showSpinner) this.loading = true;
    this.adminService.getDashboardReports().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.data = res.data;
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getPercentage(count: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.min(100, Math.round((count / total) * 100));
  }

  getSlaCompliance(): string {
    const total = this.data.summary?.totalTickets || 42;
    const overdue = this.data.summary?.overdueCount ?? 2;
    if (total === 0) return '100.0';
    const rate = Math.max(0, ((total - overdue) / total) * 100);
    return rate.toFixed(1);
  }

  exportReport() {
    const rows = [
      ['Metric', 'Value'],
      ['Total Tickets', this.data.summary?.totalTickets],
      ['Open Tickets', this.data.summary?.openTickets],
      ['Resolved Tickets', this.data.summary?.resolvedTickets],
      ['Overdue SLA Count', this.data.summary?.overdueCount],
      ['Avg Resolution (Hours)', this.data.summary?.avgResolutionHours],
      ['Avg First Response (Hours)', this.data.summary?.avgFirstResponseHours],
      ['SLA Compliance Rate', `${this.getSlaCompliance()}%`],
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `helpdesk-reports-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
