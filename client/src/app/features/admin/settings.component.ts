import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { Setting } from '../../core/models';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="pb-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">System Settings & Automation</h1>
          <p class="text-sm text-slate-500 mt-1">Configure global ticketing policies, SLA thresholds, and lifecycle automations.</p>
        </div>

        <button
          (click)="runAutoClose()"
          [disabled]="runningJob"
          class="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold shadow-sm transition flex items-center space-x-2"
        >
          <span *ngIf="runningJob">Executing Job...</span>
          <span *ngIf="!runningJob">&#9654; Run Auto-Close Job Now</span>
        </button>
      </div>

      <div *ngIf="jobMessage" class="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded">
        {{ jobMessage }}
      </div>

      <!-- Settings Table -->
      <div class="mt-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 class="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Ticketing Policy Parameters</h2>
        </div>

        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          <div *ngFor="let s of settings" class="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="max-w-md">
              <div class="font-mono text-xs font-bold text-slate-900 dark:text-white">{{ s.key }}</div>
              <div class="text-xs text-slate-500 mt-1">{{ s.description }}</div>
            </div>

            <div class="flex items-center space-x-2">
              <input
                type="text"
                [(ngModel)]="s.value"
                class="w-24 text-xs font-mono font-bold text-center rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 py-1.5 px-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                (click)="saveSetting(s)"
                class="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminSettingsComponent implements OnInit {
  private adminService = inject(AdminService);
  settings: Setting[] = [];
  jobMessage = '';
  runningJob = false;

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    this.adminService.getSettings().subscribe(res => {
      this.settings = res.settings;
    });
  }

  saveSetting(setting: Setting) {
    this.adminService.updateSetting(setting.key, setting.value).subscribe({
      next: () => {
        alert(`Setting ${setting.key} updated successfully.`);
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to update setting');
      }
    });
  }

  runAutoClose() {
    this.runningJob = true;
    this.jobMessage = '';
    this.adminService.triggerAutoClose().subscribe({
      next: (res) => {
        this.runningJob = false;
        this.jobMessage = `Auto-close job executed: ${res.result.closedCount} ticket(s) closed.`;
      },
      error: () => {
        this.runningJob = false;
        this.jobMessage = 'Failed to execute auto-close job.';
      }
    });
  }
}
