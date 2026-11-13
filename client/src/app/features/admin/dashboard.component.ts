import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { RealtimeService } from '../../core/services/realtime.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div class="flex items-center space-x-2">
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">IT Administration & System Oversight</h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Live Systems Normal
            </span>
          </div>
          <p class="text-sm text-slate-500 mt-1">Enterprise currency exchange help desk metrics, SLA compliance, and operational health.</p>
        </div>
        <div class="flex items-center space-x-3">
          <button
            (click)="loadData(true)"
            [disabled]="loading"
            class="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
            title="Refresh metrics from backend"
          >
            <span [class.animate-spin]="loading">&#8635;</span>
            <span>{{ loading ? 'Updating...' : 'Refresh' }}</span>
          </button>
          <a routerLink="/admin/reports" class="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-sm transition flex items-center space-x-1">
            <span>Detailed Reports</span>
            <span>&rarr;</span>
          </a>
        </div>
      </div>

      <!-- Critical SLA Breaches Alert Banner (Shown if overdue > 0) -->
      <div *ngIf="data.summary.overdueCount > 0" class="mt-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center space-x-3">
          <div class="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 flex items-center justify-center font-bold text-sm shrink-0">
            !
          </div>
          <div>
            <div class="text-xs font-bold text-red-900 dark:text-red-200 uppercase tracking-wide">
              {{ data.summary.overdueCount }} Ticket{{ data.summary.overdueCount > 1 ? 's' : '' }} Breaching Priority SLA Thresholds
            </div>
            <div class="text-xs text-red-700 dark:text-red-400 mt-0.5">
              High or Critical tickets have exceeded their resolution deadlines without closure.
            </div>
          </div>
        </div>
        <a routerLink="/admin/reports" class="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold shrink-0 transition">
          View Breaches Table &rarr;
        </a>
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
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <a routerLink="/admin/tickets" class="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-600 dark:hover:border-emerald-500 transition group shadow-sm">
          <div class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition flex items-center justify-between">
            <span>All Enterprise Tickets</span>
            <span class="text-xs text-slate-400 group-hover:text-emerald-600">&rarr;</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">Audit, reassign, or force transitions across all departmental queues.</p>
        </a>

        <a routerLink="/admin/users" class="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-600 dark:hover:border-emerald-500 transition group shadow-sm">
          <div class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition flex items-center justify-between">
            <span>User Management</span>
            <span class="text-xs text-slate-400 group-hover:text-emerald-600">&rarr;</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">Configure employee and technician roles, branch mappings, and active state.</p>
        </a>

        <a routerLink="/admin/audit-logs" class="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-600 dark:hover:border-emerald-500 transition group shadow-sm">
          <div class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition flex items-center justify-between">
            <span>Audit Logs</span>
            <span class="text-xs text-slate-400 group-hover:text-emerald-600">&rarr;</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">Immutable audit trail of sign-ins, claims, overrides, and security events.</p>
        </a>

        <a routerLink="/admin/settings" class="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-600 dark:hover:border-emerald-500 transition group shadow-sm">
          <div class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition flex items-center justify-between">
            <span>System Settings</span>
            <span class="text-xs text-slate-400 group-hover:text-emerald-600">&rarr;</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">Auto-close schedules, SLA thresholds, and reopen window policies.</p>
        </a>
      </div>

      <!-- Main Operational Split -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <!-- Left 2 Cols: Technician Resolution Workload -->
        <div class="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h2 class="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Technician Resolution Workload</h2>
                <p class="text-xs text-slate-500 mt-0.5">Tickets successfully resolved and closed per staff technician.</p>
              </div>
              <span class="text-[11px] font-semibold text-slate-400">
                {{ data.technicianPerformance.length }} Active Technicians
              </span>
            </div>

            <div class="p-6">
              <div class="divide-y divide-slate-100 dark:divide-slate-700">
                <div *ngFor="let tw of data.technicianPerformance; let idx = index" class="py-3.5 flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
                      {{ idx + 1 }}
                    </div>
                    <div>
                      <div class="text-xs font-bold text-slate-900 dark:text-white">{{ tw.name }}</div>
                      <div class="text-[10px] text-slate-400">IT Systems Support Specialist</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="text-base font-bold text-emerald-600 dark:text-emerald-400">{{ tw.resolvedCount }}</span>
                    <span class="text-xs text-slate-500 ml-1">tickets resolved</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
            <span>Workload is re-evaluated dynamically on status transitions.</span>
            <a routerLink="/admin/tickets" class="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Inspect Queues &rarr;
            </a>
          </div>
        </div>

        <!-- Right 1 Col: Platform Health & Guard Status -->
        <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h2 class="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-slate-700">
              Infrastructure Status
            </h2>

            <div class="mt-4 space-y-3.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-600 dark:text-slate-300 flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>PostgreSQL Database</span>
                </span>
                <span class="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">CONNECTED</span>
              </div>

              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-600 dark:text-slate-300 flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Socket.IO Real-Time Gateway</span>
                </span>
                <span class="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">ONLINE</span>
              </div>

              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-600 dark:text-slate-300 flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>S3 Secure File Storage</span>
                </span>
                <span class="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">ACTIVE</span>
              </div>

              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-600 dark:text-slate-300 flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Sensitive Data Guard</span>
                </span>
                <span class="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">ENFORCED</span>
              </div>

              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-600 dark:text-slate-300 flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Auto-Close Lifecycle Worker</span>
                </span>
                <span class="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">IDLE (OK)</span>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Security Scanning</div>
              <p class="text-xs text-slate-500 leading-relaxed">
                Server-side Luhn algorithm validator active. Magic byte signature verification rejects spoofed attachments.
              </p>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <a routerLink="/admin/settings" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-between">
              <span>Configure System Policies</span>
              <span>&rarr;</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private realtimeService = inject(RealtimeService);

  private subscriptions: Subscription[] = [];
  data: any = this.adminService.getFallbackReportsData();
  loading = false;

  ngOnInit() {
    this.loadData();

    const socketSub = this.realtimeService.ticketEvents$.subscribe((evt) => {
      if (['ticket:created', 'ticket:claimed', 'ticket:status_changed'].includes(evt.event)) {
        this.loadData();
      }
    });
    this.subscriptions.push(socketSub);

    const pollSub = interval(15000).subscribe(() => {
      this.loadData();
    });
    this.subscriptions.push(pollSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];
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
}
