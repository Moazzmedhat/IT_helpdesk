import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { User, Role, Department, Branch } from '../../core/models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Enterprise User & Access Management</h1>
          <p class="text-sm text-slate-500 mt-1">Add, update, assign roles, and manage active status across all personnel.</p>
        </div>
        <div>
          <button
            (click)="openAddModal()"
            class="inline-flex items-center px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <span class="mr-1.5 text-base leading-none font-bold">+</span>
            Add New User
          </button>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="mt-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div class="relative flex-1 max-w-md">
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search by name or email address..."
            class="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <select
            [(ngModel)]="filterRole"
            class="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="EMPLOYEE">Employees</option>
            <option value="TECHNICIAN">Technicians</option>
            <option value="ADMIN">Admins</option>
          </select>

          <select
            [(ngModel)]="filterStatus"
            class="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="DEACTIVATED">Deactivated Only</option>
          </select>
        </div>
      </div>

      <!-- Users Table -->
      <div class="mt-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
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
              <tr *ngFor="let u of filteredUsers" class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td class="px-6 py-3.5">
                  <div class="font-bold text-slate-900 dark:text-white">{{ u.fullName }}</div>
                  <div class="text-slate-400 font-mono text-[11px]">{{ u.email }}</div>
                </td>
                <td class="px-6 py-3.5 text-slate-600 dark:text-slate-300">
                  <span *ngIf="u.department" class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-[11px]">
                    {{ u.department.name }}
                  </span>
                  <span *ngIf="!u.department" class="text-slate-400 italic">None</span>
                </td>
                <td class="px-6 py-3.5 text-slate-600 dark:text-slate-300">
                  <span *ngIf="u.branch" class="text-slate-600 dark:text-slate-300">
                    {{ u.branch.name }}
                  </span>
                  <span *ngIf="!u.branch" class="text-slate-400 italic">None</span>
                </td>
                <td class="px-6 py-3.5">
                  <span
                    [class.bg-purple-100]="u.role === 'ADMIN'"
                    [class.text-purple-800]="u.role === 'ADMIN'"
                    [class.bg-blue-100]="u.role === 'TECHNICIAN'"
                    [class.text-blue-800]="u.role === 'TECHNICIAN'"
                    [class.bg-slate-100]="u.role === 'EMPLOYEE'"
                    [class.text-slate-800]="u.role === 'EMPLOYEE'"
                    class="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider inline-block"
                  >
                    {{ u.role }}
                  </span>
                </td>
                <td class="px-6 py-3.5">
                  <span
                    [class.bg-emerald-100]="u.isActive"
                    [class.text-emerald-800]="u.isActive"
                    [class.bg-red-100]="!u.isActive"
                    [class.text-red-800]="!u.isActive"
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block"
                  >
                    {{ u.isActive ? 'ACTIVE' : 'DEACTIVATED' }}
                  </span>
                </td>
                <td class="px-6 py-3.5 text-right space-x-1">
                  <!-- Edit button -->
                  <button
                    (click)="openEditModal(u)"
                    class="px-2.5 py-1 text-xs font-semibold rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                  >
                    Edit
                  </button>

                  <!-- Toggle active button -->
                  <button
                    (click)="toggleActive(u)"
                    class="px-2.5 py-1 text-xs font-semibold rounded border transition"
                    [class.border-amber-300]="u.isActive"
                    [class.text-amber-700]="u.isActive"
                    [class.hover:bg-amber-50]="u.isActive"
                    [class.border-emerald-300]="!u.isActive"
                    [class.text-emerald-700]="!u.isActive"
                    [class.hover:bg-emerald-50]="!u.isActive"
                  >
                    {{ u.isActive ? 'Deactivate' : 'Reactivate' }}
                  </button>

                  <!-- Delete button -->
                  <button
                    (click)="openDeleteModal(u)"
                    class="px-2.5 py-1 text-xs font-semibold rounded border border-red-200 hover:bg-red-50 text-red-600 transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>

              <tr *ngIf="filteredUsers.length === 0">
                <td colspan="6" class="px-6 py-8 text-center text-slate-500">
                  No users found matching your search and filter criteria.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add User Modal -->
      <div *ngIf="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Add New User</h2>
            <button (click)="showAddModal = false" class="text-slate-400 hover:text-slate-600">&times;</button>
          </div>

          <div class="mt-4 space-y-4">
            <div *ngIf="modalError" class="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800">
              {{ modalError }}
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
              <input
                type="text"
                [(ngModel)]="userForm.fullName"
                placeholder="e.g. John Doe"
                class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
              <input
                type="email"
                [(ngModel)]="userForm.email"
                placeholder="e.g. john.doe@globalexchange.internal"
                class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Role *</label>
                <select
                  [(ngModel)]="userForm.role"
                  class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="TECHNICIAN">TECHNICIAN</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <select
                  [(ngModel)]="userForm.departmentId"
                  class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option [ngValue]="null">None</option>
                  <option *ngFor="let d of departments" [value]="d.id">{{ d.name }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Branch</label>
                <select
                  [(ngModel)]="userForm.branchId"
                  class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option [ngValue]="null">None</option>
                  <option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</option>
                </select>
              </div>
            </div>

            <div class="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="newUserActive"
                [(ngModel)]="userForm.isActive"
                class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label for="newUserActive" class="text-xs font-medium text-slate-700 dark:text-slate-300">
                Account Active Immediately
              </label>
            </div>
          </div>

          <div class="mt-6 flex justify-end space-x-2">
            <button
              (click)="showAddModal = false"
              class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              (click)="createUser()"
              [disabled]="saving"
              class="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded text-xs font-semibold transition"
            >
              {{ saving ? 'Creating...' : 'Create User' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Edit User Modal -->
      <div *ngIf="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Edit User</h2>
            <button (click)="showEditModal = false" class="text-slate-400 hover:text-slate-600">&times;</button>
          </div>

          <div class="mt-4 space-y-4">
            <div *ngIf="modalError" class="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800">
              {{ modalError }}
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                [(ngModel)]="editForm.fullName"
                class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                [(ngModel)]="editForm.email"
                class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                <select
                  [(ngModel)]="editForm.role"
                  class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="TECHNICIAN">TECHNICIAN</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <select
                  [(ngModel)]="editForm.departmentId"
                  class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option [ngValue]="null">None</option>
                  <option *ngFor="let d of departments" [value]="d.id">{{ d.name }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Branch</label>
                <select
                  [(ngModel)]="editForm.branchId"
                  class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option [ngValue]="null">None</option>
                  <option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</option>
                </select>
              </div>
            </div>

            <div class="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="editUserActive"
                [(ngModel)]="editForm.isActive"
                class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label for="editUserActive" class="text-xs font-medium text-slate-700 dark:text-slate-300">
                Account Active
              </label>
            </div>
          </div>

          <div class="mt-6 flex justify-end space-x-2">
            <button
              (click)="showEditModal = false"
              class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              (click)="updateUser()"
              [disabled]="saving"
              class="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded text-xs font-semibold transition"
            >
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div *ngIf="showDeleteModal && selectedUser" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700">
          <h2 class="text-base font-bold text-red-600 flex items-center">
            <span class="mr-2 text-lg">⚠️</span> Delete User Account
          </h2>

          <p class="mt-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to remove <strong>{{ selectedUser.fullName }}</strong> ({{ selectedUser.email }})?
          </p>

          <p class="mt-2 text-[11px] text-slate-400 leading-normal">
            Note: If this user has submitted tickets, worked on tickets, or written comments, their account will be deactivated and active sessions revoked rather than hard-deleted to preserve organizational audit compliance.
          </p>

          <div *ngIf="modalError" class="mt-3 p-3 text-xs bg-red-50 text-red-700 rounded border border-red-200">
            {{ modalError }}
          </div>

          <div class="mt-6 flex justify-end space-x-2">
            <button
              (click)="showDeleteModal = false"
              class="px-3.5 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              (click)="confirmDelete()"
              [disabled]="saving"
              class="px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs font-semibold transition"
            >
              {{ saving ? 'Processing...' : 'Confirm Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminUsersComponent implements OnInit {
  private adminService = inject(AdminService);

  users: User[] = [];
  departments: Department[] = [];
  branches: Branch[] = [];

  searchQuery = '';
  filterRole: string = 'ALL';
  filterStatus: string = 'ALL';

  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;
  saving = false;
  modalError = '';

  selectedUser: User | null = null;

  userForm: {
    fullName: string;
    email: string;
    role: Role;
    departmentId: string | null;
    branchId: string | null;
    isActive: boolean;
  } = {
    fullName: '',
    email: '',
    role: 'EMPLOYEE',
    departmentId: null,
    branchId: null,
    isActive: true,
  };

  editForm: {
    id: string;
    fullName: string;
    email: string;
    role: Role;
    departmentId: string | null;
    branchId: string | null;
    isActive: boolean;
  } = {
    id: '',
    fullName: '',
    email: '',
    role: 'EMPLOYEE',
    departmentId: null,
    branchId: null,
    isActive: true,
  };

  ngOnInit() {
    this.loadUsers();
    this.loadMasterData();
  }

  loadUsers() {
    this.adminService.getUsers().subscribe(res => {
      this.users = res.users;
    });
  }

  loadMasterData() {
    this.adminService.getDepartments().subscribe({
      next: res => this.departments = res.departments,
      error: () => {}
    });
    this.adminService.getBranches().subscribe({
      next: res => this.branches = res.branches,
      error: () => {}
    });
  }

  get filteredUsers(): User[] {
    return this.users.filter(u => {
      const matchesSearch = !this.searchQuery.trim() ||
        u.fullName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(this.searchQuery.toLowerCase());

      const matchesRole = this.filterRole === 'ALL' || u.role === this.filterRole;

      const matchesStatus = this.filterStatus === 'ALL' ||
        (this.filterStatus === 'ACTIVE' && u.isActive) ||
        (this.filterStatus === 'DEACTIVATED' && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  openAddModal() {
    this.userForm = {
      fullName: '',
      email: '',
      role: 'EMPLOYEE',
      departmentId: null,
      branchId: null,
      isActive: true,
    };
    this.modalError = '';
    this.showAddModal = true;
  }

  createUser() {
    if (!this.userForm.fullName.trim() || !this.userForm.email.trim()) {
      this.modalError = 'Full name and email address are required.';
      return;
    }

    this.saving = true;
    this.modalError = '';

    this.adminService.createUser(this.userForm).subscribe({
      next: (res) => {
        this.users.unshift(res.user);
        this.saving = false;
        this.showAddModal = false;
      },
      error: (err) => {
        this.saving = false;
        this.modalError = err.error?.message || 'Failed to create user account';
      }
    });
  }

  openEditModal(user: User) {
    this.selectedUser = user;
    this.editForm = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      departmentId: user.department?.id || null,
      branchId: user.branch?.id || null,
      isActive: user.isActive !== false,
    };
    this.modalError = '';
    this.showEditModal = true;
  }

  updateUser() {
    if (!this.editForm.fullName.trim() || !this.editForm.email.trim()) {
      this.modalError = 'Full name and email address cannot be empty.';
      return;
    }

    this.saving = true;
    this.modalError = '';

    this.adminService.updateUser(this.editForm.id, this.editForm).subscribe({
      next: (res) => {
        const idx = this.users.findIndex(u => u.id === res.user.id);
        if (idx !== -1) {
          this.users[idx] = res.user;
        }
        this.saving = false;
        this.showEditModal = false;
      },
      error: (err) => {
        this.saving = false;
        this.modalError = err.error?.message || 'Failed to update user';
      }
    });
  }

  openDeleteModal(user: User) {
    this.selectedUser = user;
    this.modalError = '';
    this.showDeleteModal = true;
  }

  confirmDelete() {
    if (!this.selectedUser) return;

    this.saving = true;
    this.modalError = '';

    this.adminService.deleteUser(this.selectedUser.id).subscribe({
      next: (res) => {
        if (res.deactivated && res.user) {
          // Updated to deactivated in place
          const idx = this.users.findIndex(u => u.id === res.user!.id);
          if (idx !== -1) {
            this.users[idx] = res.user;
          }
          alert(res.message);
        } else {
          // Hard removed
          this.users = this.users.filter(u => u.id !== this.selectedUser!.id);
        }
        this.saving = false;
        this.showDeleteModal = false;
        this.selectedUser = null;
      },
      error: (err) => {
        this.saving = false;
        this.modalError = err.error?.message || 'Failed to delete user';
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
