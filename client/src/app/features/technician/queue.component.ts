import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TicketService } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';
import { Ticket, Category } from '../../core/models';

@Component({
  selector: 'app-technician-queue',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Title & Header -->
      <div class="pb-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center space-x-3">
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
              {{ isMyAssignedMode ? 'My Assigned Workload' : 'Shared Technical Queue' }}
            </h1>
            <span
              [ngClass]="isMyAssignedMode ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'"
              class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
            >
              {{ isMyAssignedMode ? 'Personal View' : 'Global Queue' }}
            </span>
          </div>
          <p class="text-sm text-slate-500 mt-1">
            {{ isMyAssignedMode
              ? 'Showing only tickets assigned directly to ' + (authService.currentUser?.fullName || 'you') + ' for investigation and resolution.'
              : 'Real-time company-wide queue across all currency exchange branches and IT staff.' }}
          </p>
        </div>

        <!-- Quick Switcher Buttons -->
        <div class="flex items-center space-x-2">
          <a
            routerLink="/technician/queue"
            [ngClass]="!isMyAssignedMode ? 'bg-emerald-700 text-white font-semibold shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'"
            class="px-3.5 py-1.5 rounded-md text-xs font-medium transition"
          >
            Shared Queue (All)
          </a>
          <a
            routerLink="/technician/my-tickets"
            [ngClass]="isMyAssignedMode ? 'bg-emerald-700 text-white font-semibold shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'"
            class="px-3.5 py-1.5 rounded-md text-xs font-medium transition"
          >
            My Assigned Tickets
          </a>
        </div>
      </div>

      <!-- Queue Tabs -->
      <div class="mt-6 flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto space-x-6 text-sm font-semibold">
        <!-- If in Shared Queue mode, show 'Available' first -->
        <button
          *ngIf="!isMyAssignedMode"
          (click)="setTab('available')"
          [class.border-emerald-600]="activeTab === 'available'"
          [class.text-emerald-700]="activeTab === 'available'"
          [class.dark:text-emerald-400]="activeTab === 'available'"
          [class.border-transparent]="activeTab !== 'available'"
          class="pb-3 border-b-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition whitespace-nowrap"
        >
          Available (Unassigned Pool)
        </button>

        <!-- If in My Assigned mode, show 'All My Tickets' first -->
        <button
          *ngIf="isMyAssignedMode"
          (click)="setTab('all')"
          [class.border-emerald-600]="activeTab === 'all'"
          [class.text-emerald-700]="activeTab === 'all'"
          [class.dark:text-emerald-400]="activeTab === 'all'"
          [class.border-transparent]="activeTab !== 'all'"
          class="pb-3 border-b-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition whitespace-nowrap"
        >
          All My Tickets
        </button>

        <button
          (click)="setTab('in_progress')"
          [class.border-emerald-600]="activeTab === 'in_progress'"
          [class.text-emerald-700]="activeTab === 'in_progress'"
          [class.dark:text-emerald-400]="activeTab === 'in_progress'"
          [class.border-transparent]="activeTab !== 'in_progress'"
          class="pb-3 border-b-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition whitespace-nowrap"
        >
          {{ isMyAssignedMode ? 'My In Progress' : 'In Progress (All Techs)' }}
        </button>

        <button
          (click)="setTab('pending')"
          [class.border-emerald-600]="activeTab === 'pending'"
          [class.text-emerald-700]="activeTab === 'pending'"
          [class.dark:text-emerald-400]="activeTab === 'pending'"
          [class.border-transparent]="activeTab !== 'pending'"
          class="pb-3 border-b-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition whitespace-nowrap"
        >
          Pending
        </button>

        <button
          (click)="setTab('resolved')"
          [class.border-emerald-600]="activeTab === 'resolved'"
          [class.text-emerald-700]="activeTab === 'resolved'"
          [class.dark:text-emerald-400]="activeTab === 'resolved'"
          [class.border-transparent]="activeTab !== 'resolved'"
          class="pb-3 border-b-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition whitespace-nowrap"
        >
          Resolved
        </button>

        <button
          (click)="setTab('closed')"
          [class.border-emerald-600]="activeTab === 'closed'"
          [class.text-emerald-700]="activeTab === 'closed'"
          [class.dark:text-emerald-400]="activeTab === 'closed'"
          [class.border-transparent]="activeTab !== 'closed'"
          class="pb-3 border-b-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition whitespace-nowrap"
        >
          Closed
        </button>
      </div>

      <!-- Search and Filter Bar -->
      <div class="mt-6 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div class="w-full sm:w-80">
          <input
            type="text"
            [(ngModel)]="search"
            (keyup.enter)="loadTickets()"
            placeholder="Search ticket number, title, asset tag..."
            class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div class="flex items-center space-x-2 w-full sm:w-auto">
          <select
            [(ngModel)]="selectedCategory"
            (change)="loadTickets()"
            class="text-xs rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-700 dark:text-slate-200"
          >
            <option value="">All Categories</option>
            <option *ngFor="let c of categories" [value]="c.id">{{ c.name }}</option>
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
            Search
          </button>
        </div>
      </div>

      <!-- Status conflict banner -->
      <div *ngIf="claimErrorMessage" class="mt-4 p-3 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex justify-between items-center">
        <span>{{ claimErrorMessage }}</span>
        <button (click)="claimErrorMessage = ''" class="text-xs font-bold">&times;</button>
      </div>

      <!-- Tickets Table -->
      <div class="mt-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div *ngIf="loading" class="p-8 text-center text-sm text-slate-500">
          Loading tickets...
        </div>

        <div *ngIf="!loading && tickets.length === 0" class="p-12 text-center text-slate-400 text-sm">
          {{ isMyAssignedMode ? 'You currently have no tickets assigned in this tab.' : 'No tickets found in this tab of the shared queue.' }}
        </div>

        <div *ngIf="!loading && tickets.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
            <thead class="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th class="px-6 py-3">Number</th>
                <th class="px-6 py-3">Subject</th>
                <th class="px-6 py-3">Ownership / Status</th>
                <th class="px-6 py-3">Requester & Branch</th>
                <th class="px-6 py-3">Priority</th>
                <th class="px-6 py-3">Age</th>
                <th class="px-6 py-3 text-right">Actions</th>
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
                <!-- Ownership Labels Required by Spec -->
                <td class="px-6 py-3.5">
                  <span *ngIf="!t.assignedTo && ['OPEN', 'REOPENED'].includes(t.status)" class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                    AVAILABLE (UNASSIGNED)
                  </span>
                  <span *ngIf="t.assignedTo && t.assignedTo.id === authService.currentUser?.id" class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase tracking-wider">
                    ASSIGNED TO YOU ({{ t.status }})
                  </span>
                  <span *ngIf="t.assignedTo && t.assignedTo.id !== authService.currentUser?.id && t.status === 'IN_PROGRESS'" class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                    BEING WORKED ON BY {{ t.assignedTo.fullName }}
                  </span>
                  <span *ngIf="t.assignedTo && t.assignedTo.id !== authService.currentUser?.id && t.status === 'PENDING'" class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                    PENDING ({{ t.assignedTo.fullName }})
                  </span>
                  <span *ngIf="t.status === 'RESOLVED' && t.assignedTo?.id !== authService.currentUser?.id" class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                    RESOLVED
                  </span>
                  <span *ngIf="t.status === 'CLOSED' && t.assignedTo?.id !== authService.currentUser?.id" class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider">
                    CLOSED
                  </span>
                </td>
                <td class="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                  {{ t.requester?.fullName }} &bull; {{ t.branch?.name }}
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
                <td class="px-6 py-3.5 text-xs text-slate-500">
                  {{ t.createdAt | date:'short' }}
                </td>
                <td class="px-6 py-3.5 text-right space-x-2">
                  <a [routerLink]="['/technician/tickets', t.id]" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                    View
                  </a>
                  <!-- The Take Ticket button appears only on claimable tickets -->
                  <button
                    *ngIf="!t.assignedTo && ['OPEN', 'REOPENED'].includes(t.status)"
                    (click)="claimTicket(t)"
                    class="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-sm transition"
                  >
                    Take Ticket
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class TechnicianQueueComponent implements OnInit {
  private ticketService = inject(TicketService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public authService = inject(AuthService);

  isMyAssignedMode = false;
  activeTab: string = 'available';
  tickets: Ticket[] = [];
  categories: Category[] = [];
  search = '';
  selectedCategory = '';
  selectedPriority = '';
  loading = true;
  claimErrorMessage = '';

  ngOnInit() {
    this.route.data.subscribe(data => {
      this.isMyAssignedMode = data['mode'] === 'my-tickets' || this.router.url.includes('my-tickets');
      if (this.isMyAssignedMode) {
        this.activeTab = 'all';
      } else {
        this.activeTab = 'available';
      }

      this.route.queryParams.subscribe(params => {
        if (params['tab']) {
          this.activeTab = params['tab'];
        }
        this.loadTickets();
      });
    });

    this.ticketService.getCategories().subscribe(res => {
      this.categories = res.categories;
    });
  }

  setTab(tab: string) {
    this.activeTab = tab;
    this.loadTickets();
  }

  loadTickets() {
    this.loading = true;
    this.claimErrorMessage = '';

    const filterOptions: any = {
      search: this.search || undefined,
      categoryId: this.selectedCategory || undefined,
      priority: this.selectedPriority || undefined,
    };

    if (this.isMyAssignedMode) {
      filterOptions.myAssigned = true;
      if (this.activeTab !== 'all') {
        filterOptions.queueTab = this.activeTab;
      }
    } else {
      filterOptions.queueTab = this.activeTab;
    }

    this.ticketService.listTickets(filterOptions).subscribe({
      next: (res) => {
        this.tickets = res.tickets;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  claimTicket(ticket: Ticket) {
    this.claimErrorMessage = '';
    this.ticketService.claimTicket(ticket.id).subscribe({
      next: () => {
        this.loadTickets();
      },
      error: (err) => {
        if (err.status === 409) {
          this.claimErrorMessage = 'Conflict (409): Ticket already claimed by another technician!';
        } else {
          this.claimErrorMessage = err.error?.message || 'Could not claim ticket';
        }
        this.loadTickets();
      }
    });
  }
}
