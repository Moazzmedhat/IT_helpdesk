import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { User } from '../../core/models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <!-- Top Dev Mode Switcher Bar -->
    <div *ngIf="devUsers.length > 0" class="bg-slate-900 border-b border-slate-800 text-xs text-slate-300 py-1.5 px-4 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <span class="font-semibold text-emerald-400 uppercase tracking-wider text-[10px] bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">DEV AUTH SWITCHER</span>
        <span class="text-slate-400 hidden sm:inline">Active User:</span>
        <span class="font-medium text-white">{{ authService.currentUser?.fullName }} ({{ authService.currentUser?.role }})</span>
      </div>
      <div class="flex items-center space-x-1.5 overflow-x-auto">
        <span class="text-slate-400 text-[11px] mr-1 hidden md:inline">Switch identity:</span>
        <button
          *ngFor="let u of devUsers"
          (click)="switchUser(u.email)"
          [class.bg-emerald-700]="authService.currentUser?.email === u.email"
          [class.text-white]="authService.currentUser?.email === u.email"
          [class.bg-slate-800]="authService.currentUser?.email !== u.email"
          class="px-2 py-0.5 rounded text-[11px] hover:bg-slate-700 transition"
        >
          {{ u.role === 'ADMIN' ? 'Admin' : u.role === 'TECHNICIAN' ? u.fullName.split(' ')[0] + ' (Tech)' : u.fullName.split(' ')[0] + ' (Emp)' }}
        </button>
      </div>
    </div>

    <!-- Main Navigation Bar -->
    <header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
        <!-- Logo & Brand -->
        <div class="flex items-center space-x-3">
          <div class="h-9 w-9 bg-emerald-700 text-white rounded flex items-center justify-center font-bold tracking-tight text-lg shadow-sm">
            FX
          </div>
          <div>
            <div class="font-bold text-slate-900 dark:text-white leading-tight tracking-tight text-base">
              GLOBAL EXCHANGE
            </div>
            <div class="text-[11px] text-slate-500 font-medium tracking-wide uppercase">
              IT Help Desk & Operations
            </div>
          </div>
        </div>

        <!-- Role Nav Links -->
        <nav class="hidden md:flex items-center space-x-1" *ngIf="authService.currentUser as user">
          <!-- Employee Links -->
          <ng-container *ngIf="user.role === 'EMPLOYEE'">
            <a routerLink="/employee/dashboard" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">Dashboard</a>
            <a routerLink="/employee/create-ticket" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">Create Ticket</a>
            <a routerLink="/employee/tickets" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">My Tickets</a>
          </ng-container>

          <!-- Technician Links -->
          <ng-container *ngIf="user.role === 'TECHNICIAN'">
            <a routerLink="/technician/dashboard" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">Overview</a>
            <a routerLink="/technician/queue" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">Shared Queue</a>
            <a routerLink="/technician/my-tickets" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">My Assigned</a>
          </ng-container>

          <!-- Admin Links -->
          <ng-container *ngIf="user.role === 'ADMIN'">
            <a routerLink="/admin/dashboard" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">Dashboard</a>
            <a routerLink="/admin/reports" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">Reports</a>
            <a routerLink="/admin/tickets" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">All Tickets</a>
            <a routerLink="/admin/users" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">Users</a>
            <a routerLink="/admin/audit-logs" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">Audit Logs</a>
            <a routerLink="/admin/settings" routerLinkActive="bg-slate-100 dark:bg-slate-800 text-emerald-700 font-semibold" class="px-3 py-2 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900">Settings</a>
          </ng-container>
        </nav>

        <!-- Right Side: Notifications & User Profile -->
        <div class="flex items-center space-x-3" *ngIf="authService.currentUser as user">
          <!-- Notification Bell -->
          <div class="relative">
            <button
              (click)="showNotifDropdown = !showNotifDropdown"
              class="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="View notifications"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span *ngIf="(realtimeService.unreadCount$ | async) as count" class="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                {{ count }}
              </span>
            </button>

            <!-- Notification Dropdown -->
            <div *ngIf="showNotifDropdown" class="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
              <div class="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Notifications</span>
                <button (click)="markAllRead()" class="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline">Mark all read</button>
              </div>
              <div class="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                <div *ngIf="(realtimeService.notifications$ | async)?.length === 0" class="p-4 text-center text-xs text-slate-500">
                  No notifications
                </div>
                <div
                  *ngFor="let n of realtimeService.notifications$ | async"
                  (click)="markRead(n.id)"
                  [ngClass]="{ 'bg-emerald-50': !n.isRead }"
                  class="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition text-left"
                >
                  <div class="text-xs font-medium text-slate-900 dark:text-slate-100">{{ n.title }}</div>
                  <div class="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{{ n.message }}</div>
                  <div class="text-[10px] text-slate-400 mt-1">{{ n.createdAt | date:'short' }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- User Badge & Logout -->
          <div class="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            <div class="text-right hidden sm:block">
              <div class="text-xs font-semibold text-slate-900 dark:text-white leading-none">{{ user.fullName }}</div>
              <div class="text-[10px] text-slate-500 leading-none mt-1">{{ user.email }}</div>
            </div>
            <button
              (click)="logout()"
              class="text-xs px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-medium transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  `
})
export class NavbarComponent implements OnInit {
  public authService = inject(AuthService);
  public realtimeService = inject(RealtimeService);
  private router = inject(Router);

  devUsers: User[] = [];
  showNotifDropdown = false;

  ngOnInit() {
    this.authService.getDevUsers().subscribe({
      next: (res) => {
        this.devUsers = res.users;
      },
      error: () => {}
    });

    this.realtimeService.init();
  }

  switchUser(email: string) {
    this.authService.devLogin(email).subscribe({
      next: (res) => {
        this.realtimeService.disconnect();
        this.realtimeService.init();
        if (res.user.role === 'EMPLOYEE') this.router.navigate(['/employee/dashboard']);
        else if (res.user.role === 'TECHNICIAN') this.router.navigate(['/technician/dashboard']);
        else if (res.user.role === 'ADMIN') this.router.navigate(['/admin/dashboard']);
      }
    });
  }

  markRead(id: string) {
    this.realtimeService.markAsRead(id).subscribe(() => {
      this.realtimeService.fetchNotifications();
    });
  }

  markAllRead() {
    this.realtimeService.markAllAsRead().subscribe(() => {
      this.realtimeService.fetchNotifications();
    });
  }

  logout() {
    this.authService.logout().subscribe(() => {
      this.realtimeService.disconnect();
      this.router.navigate(['/login']);
    });
  }
}
