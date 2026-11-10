import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TicketService } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';
import { Category, Subcategory, Department, Branch, Priority } from '../../core/models';

@Component({
  selector: 'app-create-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="max-w-3xl mx-auto px-4 py-8">
      <!-- Breadcrumb -->
      <nav class="flex text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
        <a routerLink="/employee/dashboard" class="hover:underline">Dashboard</a>
        <span class="mx-2">/</span>
        <span class="text-slate-800 dark:text-slate-200 font-medium">Create Ticket</span>
      </nav>

      <!-- Sensitive Data Guard Compliance Warning Banner -->
      <div class="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-4 rounded-r mb-6 shadow-sm">
        <div class="flex items-start">
          <svg class="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div>
            <h3 class="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
              Financial Compliance & Sensitive Data Notice
            </h3>
            <p class="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
              Currency exchange regulatory policies strictly prohibit submitting payment card numbers (PAN), customer PINs, or plaintext passwords in technical support requests. The server automatically rejects any ticket containing credit card patterns (Luhn verification) or authentication credentials.
            </p>
          </div>
        </div>
      </div>

      <!-- Main Form Container -->
      <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8">
        <h1 class="text-xl font-bold text-slate-900 dark:text-white mb-6">Submit Technical Support Ticket</h1>

        <div *ngIf="errorMessage" class="mb-5 p-3 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
          {{ errorMessage }}
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-5">
          <!-- Title -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Issue Title <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              formControlName="title"
              placeholder="e.g. Dealing workstation dual-display blackout"
              class="w-full text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div *ngIf="form.get('title')?.touched && form.get('title')?.invalid" class="text-[11px] text-red-500 mt-1">
              Title must be between 5 and 200 characters.
            </div>
          </div>

          <!-- Category & Subcategory Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Category <span class="text-red-500">*</span>
              </label>
              <select
                formControlName="categoryId"
                (change)="onCategoryChange()"
                class="w-full text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Category</option>
                <option *ngFor="let c of categories" [value]="c.id">{{ c.name }}</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Subcategory
              </label>
              <select
                formControlName="subcategoryId"
                class="w-full text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Subcategory (optional)</option>
                <option *ngFor="let s of subcategories" [value]="s.id">{{ s.name }}</option>
              </select>
            </div>
          </div>

          <!-- Priority & Device Asset Tag Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                formControlName="priority"
                class="w-full text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="LOW">Low - General inquiry or non-blocking</option>
                <option value="MEDIUM">Medium - Normal workflow affected</option>
                <option value="HIGH">High - Urgent trading / cash counter issue</option>
                <option value="CRITICAL">Critical - System down / branch halted</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Asset / Device Tag
              </label>
              <input
                type="text"
                formControlName="deviceAssetTag"
                placeholder="e.g. FX-WS-0942 or POS-BR1-03"
                class="w-full text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Detailed Description <span class="text-red-500">*</span>
            </label>
            <textarea
              rows="5"
              formControlName="description"
              placeholder="Describe the issue, error messages observed, and steps taken so far..."
              class="w-full text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
            ></textarea>
            <div *ngIf="form.get('description')?.touched && form.get('description')?.invalid" class="text-[11px] text-red-500 mt-1">
              Description must be at least 10 characters.
            </div>
          </div>

          <!-- Optional File Attachment -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Attach Screenshot or Log File (Optional)
            </label>
            <input
              type="file"
              (change)="onFileSelected($event)"
              accept=".png,.jpg,.jpeg,.pdf,.txt,.log,.docx"
              class="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
            <p class="text-[10px] text-slate-400 mt-1">
              Allowed: PNG, JPG, PDF, TXT, LOG, DOCX. Max 10MB. Magic byte verified.
            </p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <a
              routerLink="/employee/dashboard"
              class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </a>
            <button
              type="submit"
              [disabled]="form.invalid || submitting"
              class="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded text-sm font-semibold shadow-sm transition flex items-center space-x-2"
            >
              <span *ngIf="submitting">Submitting...</span>
              <span *ngIf="!submitting">Submit Ticket</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class CreateTicketComponent implements OnInit {
  private fb = inject(FormBuilder);
  private ticketService = inject(TicketService);
  private authService = inject(AuthService);
  private router = inject(Router);

  categories: Category[] = [];
  subcategories: Subcategory[] = [];
  selectedFile: File | null = null;
  submitting = false;
  errorMessage = '';

  form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    categoryId: ['', Validators.required],
    subcategoryId: [''],
    priority: ['MEDIUM', Validators.required],
    deviceAssetTag: [''],
  });

  ngOnInit() {
    this.ticketService.getCategories().subscribe({
      next: (res) => {
        this.categories = res.categories;
      }
    });
  }

  onCategoryChange() {
    const catId = this.form.get('categoryId')?.value;
    const cat = this.categories.find(c => c.id === catId);
    this.subcategories = cat?.subcategories || [];
    this.form.patchValue({ subcategoryId: '' });
  }

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.submitting = true;
    this.errorMessage = '';

    const val = this.form.value;
    const payload = {
      title: val.title?.trim(),
      description: val.description?.trim(),
      categoryId: val.categoryId,
      subcategoryId: val.subcategoryId ? val.subcategoryId : undefined,
      priority: val.priority || 'MEDIUM',
      deviceAssetTag: val.deviceAssetTag?.trim() || undefined,
      departmentId: this.authService.currentUser?.department?.id,
      branchId: this.authService.currentUser?.branch?.id,
    };

    this.ticketService.createTicket(payload).subscribe({
      next: (res) => {
        if (this.selectedFile && res.ticket?.id) {
          this.ticketService.uploadAttachment(res.ticket.id, this.selectedFile).subscribe({
            next: () => {
              this.router.navigate(['/employee/tickets', res.ticket.id]);
            },
            error: () => {
              // Ticket was created, redirect to ticket page
              this.router.navigate(['/employee/tickets', res.ticket.id]);
            }
          });
        } else {
          this.router.navigate(['/employee/tickets', res.ticket.id]);
        }
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || err.error?.error || 'Failed to submit ticket. Please check your inputs.';
      }
    });
  }
}
