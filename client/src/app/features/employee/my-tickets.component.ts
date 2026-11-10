import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TicketService } from '../../core/services/ticket.service';
import { Ticket } from '../../core/models';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">My Support Tickets</h1>
          <p class="text-sm text-slate-500 mt-1">Track status, reply to technician notes, and confirm ticket resolutions.</p>
        </div>
        <div class="mt-4 sm:mt-0">
          <a
            routerLink="/employee/create-ticket"
            class="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded shadow-sm transition"
          >
            + New Ticket
          </a>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="mt-6 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div class="w-full sm:w-80">
          <input
            type="text"
            [(ngModel)]="search"
            (keyup.enter)="loadTickets()"
            placeholder="Search tickets by number, keyword or asset tag..."
            class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div class="flex items-center space-x-2 w-full sm:w-auto">
          <select
            [(ngModel)]="selectedStatus"
            (change)="loadTickets()"
            class="text-xs rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-700 dark:text-slate-200"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PENDING">Pending</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="REOPENED">Reopened</option>
          </select>

          <select
            [(ngModel)]="selectedPriority"
            (change)="loadTickets()"
            class="text-xs rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-700 dark:text-slate-200"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          <button
            (click)="loadTickets()"
            class="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-semibold rounded text-slate-700 dark:text-slate-200 transition"
          >
            Filter
          </button>
        </div>
      </div>

      <!-- Tickets Table -->
      <div class="mt-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div *ngIf="loading" class="p-8 text-center text-sm text-slate-500">
          Loading your tickets...
        </div>

        <div *ngIf="!loading && tickets.length === 0" class="p-12 text-center">
          <div class="text-sm font-semibold text-slate-500">No tickets found</div>
          <p class="text-xs text-slate-400 mt-1">Try adjusting your search criteria or create a new ticket.</p>
        </div>

        <div *ngIf="!loading && tickets.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
            <thead class="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th class="px-6 py-3">Number</th>
                <th class="px-6 py-3">Subject / Title</th>
                <th class="px-6 py-3">Category</th>
                <th class="px-6 py-3">Technician</th>
                <th class="px-6 py-3">Priority</th>
                <th class="px-6 py-3">Status</th>
                <th class="px-6 py-3">Updated</th>
                <th class="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
              <tr *ngFor="let t of tickets" class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td class="px-6 py-3.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {{ t.ticketNumber }}
                </td>
                <td class="px-6 py-3.5 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                  {{ t.title }}
                </td>
                <td class="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                  {{ t.category?.name }}
                </td>
                <td class="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                  <span *ngIf="t.assignedTo">{{ t.assignedTo.fullName }}</span>
                  <span *ngIf="!t.assignedTo" class="italic text-slate-400">Unassigned</span>
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
                    [class.bg-purple-100]="t.status === 'REOPENED'"
                    [class.text-purple-700]="t.status === 'REOPENED'"
                    class="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider"
                  >
                    {{ t.status }}
                  </span>
                </td>
                <td class="px-6 py-3.5 text-xs text-slate-500">
                  {{ t.updatedAt | date:'short' }}
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
export class MyTicketsComponent implements OnInit {
  private ticketService = inject(TicketService);

  tickets: Ticket[] = [];
  loading = true;
  search = '';
  selectedStatus = '';
  selectedPriority = '';

  ngOnInit() {
    this.loadTickets();
  }

  loadTickets() {
    this.loading = true;
    this.ticketService.listTickets({
      search: this.search,
      status: this.selectedStatus || undefined,
      priority: this.selectedPriority || undefined,
    }).subscribe({
      next: (res) => {
        this.tickets = res.tickets;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
