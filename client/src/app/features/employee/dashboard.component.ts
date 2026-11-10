import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TicketService } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';
import { Ticket } from '../../core/models';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Welcome Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Employee IT Portal</h1>
          <p class="text-sm text-slate-500 mt-1">
            Welcome, {{ authService.currentUser?.fullName }} ({{ authService.currentUser?.department?.name }})
          </p>
        </div>
        <div class="mt-4 md:mt-0">
          <a
            routerLink="/employee/create-ticket"
            class="inline-flex items-center px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded shadow-sm transition"
          >
            + Create New Ticket
          </a>
        </div>
      </div>

      <!-- Quick Stats Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6">
        <div class="bg-white dark:bg-slate-800 p-5 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Tickets</div>
          <div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{{ activeCount }}</div>
          <div class="mt-1 text-xs text-slate-400">Open or in-progress tickets</div>
        </div>
        <div class="bg-white dark:bg-slate-800 p-5 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resolved</div>
          <div class="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{{ resolvedCount }}</div>
          <div class="mt-1 text-xs text-slate-400">Awaiting your confirmation or closed</div>
        </div>
        <div class="bg-white dark:bg-slate-800 p-5 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Submitted</div>
          <div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{{ totalCount }}</div>
          <div class="mt-1 text-xs text-slate-400">All-time tickets requested</div>
        </div>
      </div>

      <!-- Recent Tickets Table -->
      <div class="mt-8 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 class="text-base font-bold text-slate-900 dark:text-white">Recent Tickets</h2>
          <a routerLink="/employee/tickets" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">View all &rarr;</a>
        </div>

        <div *ngIf="loading" class="p-8 text-center text-sm text-slate-500">
          Loading tickets...
        </div>

        <div *ngIf="!loading && tickets.length === 0" class="p-12 text-center">
          <div class="text-slate-400 text-sm font-medium">No tickets created yet.</div>
          <p class="text-xs text-slate-500 mt-1">Need help with hardware, dealing software or branch internet? Create a ticket above.</p>
        </div>

        <div *ngIf="!loading && tickets.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
            <thead class="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th class="px-6 py-3">Ticket ID</th>
                <th class="px-6 py-3">Title</th>
                <th class="px-6 py-3">Category</th>
                <th class="px-6 py-3">Priority</th>
                <th class="px-6 py-3">Status</th>
                <th class="px-6 py-3">Created</th>
                <th class="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
              <tr *ngFor="let t of tickets" class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td class="px-6 py-3.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {{ t.ticketNumber }}
                </td>
                <td class="px-6 py-3.5 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                  {{ t.title }}
                </td>
                <td class="px-6 py-3.5 text-slate-600 dark:text-slate-300 text-xs">
                  {{ t.category?.name }}
                </td>
                <td class="px-6 py-3.5">
                  <span
                    [class.bg-red-100]="t.priority === 'CRITICAL'"
                    [class.text-red-800]="t.priority === 'CRITICAL'"
                    [class.bg-amber-100]="t.priority === 'HIGH'"
                    [class.text-amber-800]="t.priority === 'HIGH'"
                    [class.bg-blue-100]="t.priority === 'MEDIUM'"
                    [class.text-blue-800]="t.priority === 'MEDIUM'"
                    [class.bg-emerald-100]="t.priority === 'LOW'"
                    [class.text-emerald-800]="t.priority === 'LOW'"
                    class="px-2 py-0.5 rounded text-[11px] font-bold"
                  >
                    {{ t.priority }}
                  </span>
                </td>
                <td class="px-6 py-3.5">
                  <span
                    [class.bg-slate-100]="t.status === 'OPEN'"
                    [class.text-slate-700]="t.status === 'OPEN'"
                    [class.bg-blue-100]="t.status === 'IN_PROGRESS'"
                    [class.text-blue-700]="t.status === 'IN_PROGRESS'"
                    [class.bg-amber-100]="t.status === 'PENDING'"
                    [class.text-amber-700]="t.status === 'PENDING'"
                    [class.bg-emerald-100]="t.status === 'RESOLVED'"
                    [class.text-emerald-700]="t.status === 'RESOLVED'"
                    [class.bg-gray-100]="t.status === 'CLOSED'"
                    [class.text-gray-500]="t.status === 'CLOSED'"
                    class="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider"
                  >
                    {{ t.status }}
                  </span>
                </td>
                <td class="px-6 py-3.5 text-slate-500 text-xs">
                  {{ t.createdAt | date:'short' }}
                </td>
                <td class="px-6 py-3.5 text-right">
                  <a [routerLink]="['/employee/tickets', t.id]" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                    View
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class EmployeeDashboardComponent implements OnInit {
  public authService = inject(AuthService);
  private ticketService = inject(TicketService);

  tickets: Ticket[] = [];
  loading = true;
  activeCount = 0;
  resolvedCount = 0;
  totalCount = 0;

  ngOnInit() {
    this.ticketService.listTickets({ limit: 5 }).subscribe({
      next: (res) => {
        this.tickets = res.tickets;
        this.totalCount = res.total;
        this.activeCount = res.tickets.filter(t => ['OPEN', 'IN_PROGRESS', 'PENDING', 'REOPENED'].includes(t.status)).length;
        this.resolvedCount = res.tickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
