import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="flex justify-center">
          <div class="h-12 w-12 bg-emerald-700 text-white rounded-lg flex items-center justify-center font-bold tracking-tight text-2xl shadow-md">
            FX
          </div>
        </div>
        <h2 class="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Global Exchange Help Desk
        </h2>
        <p class="mt-1 text-center text-xs text-slate-500 uppercase tracking-wider font-semibold">
          Internal Operations & Technical Support
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white dark:bg-slate-900 py-8 px-4 shadow-sm border border-slate-200 dark:border-slate-800 sm:rounded-lg sm:px-10">
          <div class="mb-6">
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Select Persona to Sign In</h3>
            <p class="text-xs text-slate-500">Local development authentication is active. Choose an identity below:</p>
          </div>

          <div *ngIf="errorMessage" class="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded text-xs">
            {{ errorMessage }}
          </div>

          <div *ngIf="loading" class="text-center py-6 text-sm text-slate-500">
            Loading identities...
          </div>

          <div *ngIf="!loading" class="space-y-2.5">
            <div *ngFor="let u of users" class="border border-slate-200 dark:border-slate-700 hover:border-emerald-600 dark:hover:border-emerald-500 rounded p-3 transition flex items-center justify-between group cursor-pointer" (click)="login(u.email)">
              <div>
                <div class="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 transition">
                  {{ u.fullName }}
                </div>
                <div class="text-[11px] text-slate-500">
                  {{ u.email }} &bull; {{ u.department?.name }}
                </div>
              </div>
              <span
                [class.bg-purple-100]="u.role === 'ADMIN'"
                [class.text-purple-800]="u.role === 'ADMIN'"
                [class.bg-blue-100]="u.role === 'TECHNICIAN'"
                [class.text-blue-800]="u.role === 'TECHNICIAN'"
                [class.bg-slate-100]="u.role === 'EMPLOYEE'"
                [class.text-slate-800]="u.role === 'EMPLOYEE'"
                class="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
              >
                {{ u.role }}
              </span>
            </div>
          </div>

          <div class="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[11px] text-slate-400">
              In production mode, sign-in delegates to Microsoft Entra ID via OIDC authorization code flow with PKCE.
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  users: User[] = [];
  loading = true;
  errorMessage: string | null = null;

  ngOnInit() {
    this.authService.getDevUsers().subscribe({
      next: (res) => {
        this.users = res.users || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Failed to load user personas from backend. Ensure API is reachable.';
      }
    });
  }

  login(email: string) {
    this.authService.devLogin(email).subscribe({
      next: (res) => {
        if (res.user.role === 'EMPLOYEE') this.router.navigate(['/employee/dashboard']);
        else if (res.user.role === 'TECHNICIAN') this.router.navigate(['/technician/dashboard']);
        else if (res.user.role === 'ADMIN') this.router.navigate(['/admin/dashboard']);
      }
    });
  }
}
