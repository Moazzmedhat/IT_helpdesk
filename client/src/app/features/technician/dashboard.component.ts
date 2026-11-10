import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TicketService } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';
import { Ticket } from '../../core/models';

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">IT Technician Workspace</h1>
          <p class="text-sm text-slate-500 mt-1">
            Logged in as {{ authService.currentUser?.fullName }} ({{ authService.currentUser?.role }})
          </p>
        </div>
        <div class="mt-4 sm:mt-0 flex space-x-3">
          <a
            routerLink="/technician/queue"
            class="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded shadow-sm transition"
          >
            Open Shared Queue &rarr;
          </a>
        </div>
      </div>

      <!-- Queue Metrics Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-5 mt-6">
        <a routerLink="/technician/queue" [queryParams]="{ tab: 'available' }" class="bg-white dark:bg-slate-800 p-5 rounded border border-slate-200 dark:border-slate-700 shadow-sm hover:border-emerald-500 transition cursor-pointer">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available to Claim</span>
            <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
          </div>
          <div class="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{{ availableCount }}</div>
          <div class="mt-1 text-xs text-slate-400">Unassigned open requests</div>
        </a>

        <a routerLink="/technician/my-tickets" class="bg-white dark:bg-slate-800 p-5 rounded border border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-500 transition cursor-pointer">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Active Workload</span>
            <span class="h-2 w-2 rounded-full bg-blue-500"></span>
          </div>
          <div class="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">{{ myActiveCount }}</div>
          <div class="mt-1 text-xs text-slate-400">Claimed & in progress</div>
        </a>

        <a routerLink="/technician/queue" [queryParams]="{ tab: 'pending' }" class="bg-white dark:bg-slate-800 p-5 rounded border border-slate-200 dark:border-slate-700 shadow-sm hover:border-amber-500 transition cursor-pointer">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Vendor/Parts</span>
            <span class="h-2 w-2 rounded-full bg-amber-500"></span>
          </div>
          <div class="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">{{ pendingCount }}</div>
          <div class="mt-1 text-xs text-slate-400">Blocked on external dependency</div>
        </a>

        <a routerLink="/technician/queue" [queryParams]="{ tab: 'resolved' }" class="bg-white dark:bg-slate-800 p-5 rounded border border-slate-200 dark:border-slate-700 shadow-sm hover:border-emerald-500 transition cursor-pointer">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resolved Tickets</span>
            <span class="h-2 w-2 rounded-full bg-emerald-600"></span>
          </div>
          <div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{{ resolvedCount }}</div>
          <div class="mt-1 text-xs text-slate-400">Awaiting user confirmation</div>
        </a>
      </div>

      <!-- Available to Claim Preview -->
      <div class="mt-8 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h2 class="text-base font-bold text-slate-900 dark:text-white">Unassigned Tickets Awaiting Claim</h2>
            <p class="text-xs text-slate-500">First-come first-served atomic claim queue.</p>
          </div>
          <a routerLink="/technician/queue" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">Full Queue &rarr;</a>
        </div>

        <div *ngIf="loading" class="p-8 text-center text-xs text-slate-400">
          Loading queue...
        </div>

        <div *ngIf="!loading && availableTickets.length === 0" class="p-8 text-center text-xs text-slate-500 italic">
          No unassigned tickets right now. The queue is clean!
        </div>

        <div *ngIf="!loading && availableTickets.length > 0" class="divide-y divide-slate-100 dark:divide-slate-700">
          <div *ngFor="let t of availableTickets" class="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">{{ t.ticketNumber }}</span>
                <span
                  [class.bg-red-100]="t.priority === 'CRITICAL'"
                  [class.text-red-800]="t.priority === 'CRITICAL'"
                  [class.bg-amber-100]="t.priority === 'HIGH'"
                  [class.text-amber-800]="t.priority === 'HIGH'"
                  [class.bg-blue-100]="t.priority === 'MEDIUM'"
                  [class.text-blue-800]="t.priority === 'MEDIUM'"
                  [class.bg-emerald-100]="t.priority === 'LOW'"
                  [class.text-emerald-800]="t.priority === 'LOW'"
                  class="px-1.5 py-0.2 rounded text-[10px] font-bold"
                >
                  {{ t.priority }}
                </span>
                <span class="text-xs font-semibold text-slate-900 dark:text-white">{{ t.title }}</span>
              </div>
              <div class="text-[11px] text-slate-500 mt-1">
                Requested by {{ t.requester?.fullName }} ({{ t.department?.name }} &bull; {{ t.branch?.name }}) &bull; {{ t.createdAt | date:'short' }}
              </div>
            </div>

            <div class="flex items-center space-x-2 flex-shrink-0">
              <a
                [routerLink]="['/technician/tickets', t.id]"
                class="px-3 py-1.5 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-xs font-medium text-slate-700 dark:text-slate-200 transition"
              >
                Inspect
              </a>
              <button
                (click)="claim(t)"
                class="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-sm transition"
              >
                Take Ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class TechnicianDashboardComponent implements OnInit {
  public authService = inject(AuthService);
  private ticketService = inject(TicketService);

  availableCount = 0;
  myActiveCount = 0;
  pendingCount = 0;
  resolvedCount = 0;
  availableTickets: Ticket[] = [];
  loading = true;

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.loading = true;
    this.ticketService.listTickets({ queueTab: 'available', limit: 5 }).subscribe({
      next: (res) => {
        this.availableTickets = res.tickets;
        this.availableCount = res.total;
        this.loading = false;
      }
    });

    this.ticketService.listTickets({ status: 'IN_PROGRESS' }).subscribe({
      next: (res) => {
        const myId = this.authService.currentUser?.id;
        this.myActiveCount = res.tickets.filter(t => t.assignedToId === myId).length;
      }
    });

    this.ticketService.listTickets({ status: 'PENDING' }).subscribe({
      next: (res) => {
        this.pendingCount = res.total;
      }
    });

    this.ticketService.listTickets({ status: 'RESOLVED' }).subscribe({
      next: (res) => {
        this.resolvedCount = res.total;
      }
    });
  }

  claim(ticket: Ticket) {
    this.ticketService.claimTicket(ticket.id).subscribe({
      next: () => {
        this.loadStats();
      },
      error: (err) => {
        if (err.status === 409) {
          alert('Conflict (409): Ticket already claimed by another technician!');
        } else {
          alert(err.error?.message || 'Could not claim ticket');
        }
        this.loadStats();
      }
    });
  }
}
