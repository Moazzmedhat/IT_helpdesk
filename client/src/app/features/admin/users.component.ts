import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { User, Role } from '../../core/models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Enterprise User & Role Management</h1>
        <p class="text-sm text-slate-500 mt-1">Manage employee and staff access privileges, role assignments, and active account status.</p>
      </div>

      <!-- Users Table -->
      <div class="mt-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold uppercase">
              <tr>
                <th class="px-6 py-3">Full Name & Email</th>
                <th class="px-6 py-3">Department</th>
                <th class="px-6 py-3">Branch</th>
                <th class="px-6 py-3">Current Role</th>
                <th class="px-6 py-3">Status</th>
                <th class="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
              <tr *ngFor="let u of users" class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td class="px-6 py-3.5">
                  <div class="font-bold text-slate-900 dark:text-white">{{ u.fullName }}</div>
                  <div class="text-slate-400 font-mono text-[11px]">{{ u.email }}</div>
                </td>
                <td class="px-6 py-3.5 text-slate-600 dark:text-slate-300">{{ u.department?.name }}</td>
                <td class="px-6 py-3.5 text-slate-600 dark:text-slate-300">{{ u.branch?.name }}</td>
                <td class="px-6 py-3.5">
                  <select
                    [ngModel]="u.role"
                    (ngModelChange)="changeRole(u, $event)"
                    class="text-xs rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="TECHNICIAN">TECHNICIAN</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td class="px-6 py-3.5">
                  <span
                    [class.bg-emerald-100]="u.isActive"
                    [class.text-emerald-800]="u.isActive"
                    [class.bg-red-100]="!u.isActive"
                    [class.text-red-800]="!u.isActive"
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                  >
                    {{ u.isActive ? 'ACTIVE' : 'DEACTIVATED' }}
                  </span>
                </td>
                <td class="px-6 py-3.5 text-right">
                  <button
                    (click)="toggleActive(u)"
                    class="px-2.5 py-1 text-xs font-semibold rounded border transition"
                    [class.border-red-300]="u.isActive"
                    [class.text-red-600]="u.isActive"
                    [class.hover:bg-red-50]="u.isActive"
                    [class.border-emerald-300]="!u.isActive"
                    [class.text-emerald-600]="!u.isActive"
                    [class.hover:bg-emerald-50]="!u.isActive"
                  >
                    {{ u.isActive ? 'Deactivate' : 'Reactivate' }}
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
export class AdminUsersComponent implements OnInit {
  private adminService = inject(AdminService);
  users: User[] = [];

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.adminService.getUsers().subscribe(res => {
      this.users = res.users;
    });
  }

  changeRole(user: User, newRole: Role) {
    if (user.role === newRole) return;
    this.adminService.updateUserRole(user.id, newRole).subscribe({
      next: (res) => {
        user.role = res.user.role;
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to update user role');
      }
    });
  }

  toggleActive(user: User) {
    this.adminService.toggleUserActive(user.id).subscribe({
      next: (res) => {
        user.isActive = res.user.isActive;
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to change user status');
      }
    });
  }
}
