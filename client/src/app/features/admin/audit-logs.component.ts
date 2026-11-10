import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { AuditLog } from '../../core/models';

@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Security & Operational Audit Logs</h1>
        <p class="text-sm text-slate-500 mt-1">Immutable, append-only record of all security-sensitive actions and transitions.</p>
      </div>

      <!-- Action Filter -->
      <div class="mt-6 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
        <div class="flex items-center space-x-3 text-xs">
          <span class="font-bold text-slate-600 dark:text-slate-300">Filter Action:</span>
          <select
            [(ngModel)]="selectedAction"
            (change)="loadLogs()"
            class="text-xs rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-slate-800 dark:text-slate-200"
          >
            <option value="">All Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="CLAIM">CLAIM</option>
            <option value="RELEASE">RELEASE</option>
            <option value="STATUS_CHANGE">STATUS_CHANGE</option>
            <option value="ADMIN_OVERRIDE">ADMIN_OVERRIDE</option>
            <option value="SETTINGS_CHANGE">SETTINGS_CHANGE</option>
            <option value="ATTACHMENT_DOWNLOAD">ATTACHMENT_DOWNLOAD</option>
            <option value="AUTO_CLOSE">AUTO_CLOSE</option>
          </select>
        </div>

        <span class="text-xs text-slate-400">Total: {{ total }} events</span>
      </div>

      <!-- Logs Table -->
      <div class="mt-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div *ngIf="loading" class="p-8 text-center text-xs text-slate-500">
          Loading audit trail...
        </div>

        <div *ngIf="!loading && logs.length === 0" class="p-12 text-center text-xs text-slate-400">
          No audit records matching criteria.
        </div>

        <div *ngIf="!loading && logs.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold uppercase">
              <tr>
                <th class="px-6 py-3">Timestamp</th>
                <th class="px-6 py-3">Action</th>
                <th class="px-6 py-3">Actor</th>
                <th class="px-6 py-3">Target Entity</th>
                <th class="px-6 py-3">Details / Context</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
              <tr *ngFor="let l of logs" class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td class="px-6 py-3 text-slate-500 whitespace-nowrap">{{ l.createdAt | date:'medium' }}</td>
                <td class="px-6 py-3 font-mono font-bold">
                  <span
                    [class.text-emerald-600]="l.action === 'LOGIN' || l.action === 'CLAIM'"
                    [class.text-red-600]="l.action === 'ADMIN_OVERRIDE' || l.action === 'RELEASE'"
                    [class.text-blue-600]="l.action === 'STATUS_CHANGE'"
                    [class.text-amber-600]="l.action === 'SETTINGS_CHANGE'"
                  >
                    {{ l.action }}
                  </span>
                </td>
                <td class="px-6 py-3 text-slate-700 dark:text-slate-300">
                  <span *ngIf="l.actor">{{ l.actor.fullName }} ({{ l.actor.role }})</span>
                  <span *ngIf="!l.actor" class="italic text-slate-400">System</span>
                </td>
                <td class="px-6 py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                  {{ l.entity }} <span *ngIf="l.entityId">#{{ l.entityId.slice(0, 8) }}</span>
                </td>
                <td class="px-6 py-3 text-slate-500 font-mono text-[10px] max-w-xs truncate">
                  {{ l.details | json }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class AdminAuditLogsComponent implements OnInit {
  private adminService = inject(AdminService);
  logs: AuditLog[] = [];
  total = 0;
  selectedAction = '';
  loading = true;

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.loading = true;
    this.adminService.getAuditLogs({ action: this.selectedAction || undefined, limit: 50 }).subscribe({
      next: (res) => {
        this.logs = res.logs;
        this.total = res.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
