import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TicketService } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';
import { Ticket, Comment, Attachment } from '../../core/models';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" *ngIf="ticket">
      <!-- Breadcrumb -->
      <nav class="flex text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
        <a routerLink="/employee/dashboard" class="hover:underline">Dashboard</a>
        <span class="mx-2">/</span>
        <a routerLink="/employee/tickets" class="hover:underline">Tickets</a>
        <span class="mx-2">/</span>
        <span class="text-slate-800 dark:text-slate-200 font-mono font-medium">{{ ticket.ticketNumber }}</span>
      </nav>

      <!-- Ticket Header & Quick Status Actions -->
      <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center space-x-3">
            <span class="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800">
              {{ ticket.ticketNumber }}
            </span>
            <span
              [class.bg-slate-100]="ticket.status === 'OPEN'"
              [class.text-slate-700]="ticket.status === 'OPEN'"
              [class.bg-blue-100]="ticket.status === 'IN_PROGRESS'"
              [class.text-blue-700]="ticket.status === 'IN_PROGRESS'"
              [class.bg-amber-100]="ticket.status === 'PENDING'"
              [class.text-amber-700]="ticket.status === 'PENDING'"
              [class.bg-emerald-100]="ticket.status === 'RESOLVED'"
              [class.text-emerald-700]="ticket.status === 'RESOLVED'"
              [class.bg-gray-100]="ticket.status === 'CLOSED'"
              [class.text-gray-500]="ticket.status === 'CLOSED'"
              [class.bg-purple-100]="ticket.status === 'REOPENED'"
              [class.text-purple-700]="ticket.status === 'REOPENED'"
              class="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider"
            >
              {{ ticket.status }}
            </span>
            <span
              [class.bg-red-100]="ticket.priority === 'CRITICAL'"
              [class.text-red-800]="ticket.priority === 'CRITICAL'"
              [class.bg-amber-100]="ticket.priority === 'HIGH'"
              [class.text-amber-800]="ticket.priority === 'HIGH'"
              [class.bg-blue-100]="ticket.priority === 'MEDIUM'"
              [class.text-blue-800]="ticket.priority === 'MEDIUM'"
              [class.bg-emerald-100]="ticket.priority === 'LOW'"
              [class.text-emerald-800]="ticket.priority === 'LOW'"
              class="px-2 py-0.5 rounded text-xs font-bold"
            >
              {{ ticket.priority }} Priority
            </span>
          </div>
          <h1 class="text-xl font-bold text-slate-900 dark:text-white mt-2">{{ ticket.title }}</h1>
        </div>

        <!-- Employee Status Actions on Resolved Tickets -->
        <div class="flex items-center space-x-2" *ngIf="ticket.status === 'RESOLVED'">
          <button
            (click)="confirmResolution()"
            class="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-sm transition"
          >
            Confirm & Close Ticket
          </button>
          <button
            (click)="showReopenModal = true"
            class="px-3.5 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold transition"
          >
            Reopen Ticket
          </button>
        </div>
      </div>

      <!-- Main Layout Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: Ticket Content, Comments & Attachments (2 Cols) -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Description Card -->
          <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Issue Description</h2>
            <div class="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {{ ticket.description }}
            </div>
          </div>

          <!-- Attachments Card -->
          <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">Attachments</h2>
              <label class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
                + Upload File
                <input type="file" (change)="uploadFile($event)" class="hidden" accept=".png,.jpg,.jpeg,.pdf,.txt,.log,.docx" />
              </label>
            </div>

            <div *ngIf="attachments.length === 0" class="text-xs text-slate-400 italic">
              No files attached to this ticket.
            </div>

            <div *ngIf="attachments.length > 0" class="space-y-2">
              <div *ngFor="let a of attachments" class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-xs">
                <div class="flex items-center space-x-2 truncate">
                  <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span class="font-medium text-slate-900 dark:text-slate-100 truncate">{{ a.originalName }}</span>
                  <span class="text-slate-400 text-[10px]">({{ (a.sizeBytes / 1024).toFixed(1) }} KB)</span>
                </div>
                <button (click)="downloadAttachment(a.id)" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex-shrink-0 ml-3">
                  Download
                </button>
              </div>
            </div>
          </div>

          <!-- Conversation Thread -->
          <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Conversation History</h2>

            <!-- Comments List -->
            <div class="space-y-4 mb-6">
              <div *ngIf="comments.length === 0" class="text-xs text-slate-400 italic text-center py-4">
                No replies posted yet.
              </div>

              <div *ngFor="let c of comments" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80">
                <div class="flex justify-between items-center mb-1.5">
                  <div class="flex items-center space-x-2">
                    <span class="text-xs font-bold text-slate-900 dark:text-white">{{ c.author?.fullName }}</span>
                    <span
                      [class.bg-emerald-100]="c.author?.role === 'TECHNICIAN'"
                      [class.text-emerald-800]="c.author?.role === 'TECHNICIAN'"
                      [class.bg-slate-200]="c.author?.role === 'EMPLOYEE'"
                      [class.text-slate-700]="c.author?.role === 'EMPLOYEE'"
                      class="px-1.5 py-0.2 rounded text-[10px] font-bold"
                    >
                      {{ c.author?.role }}
                    </span>
                  </div>
                  <span class="text-[10px] text-slate-400">{{ c.createdAt | date:'short' }}</span>
                </div>
                <div class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {{ c.content }}
                </div>
              </div>
            </div>

            <!-- Add Public Comment Form -->
            <div class="pt-4 border-t border-slate-200 dark:border-slate-700">
              <div class="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded mb-2 text-[11px]">
                Notice: Do not enter card numbers or account passwords in comments.
              </div>

              <div *ngIf="commentError" class="mb-2 text-xs text-red-600">
                {{ commentError }}
              </div>

              <textarea
                rows="3"
                [(ngModel)]="newComment"
                placeholder="Type your message to the IT technician..."
                class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              ></textarea>
              <div class="flex justify-end mt-2">
                <button
                  (click)="postComment()"
                  [disabled]="!newComment.trim() || sendingComment"
                  class="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded text-xs font-semibold transition"
                >
                  <span *ngIf="sendingComment">Sending...</span>
                  <span *ngIf="!sendingComment">Send Reply</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Ticket Metadata & Audit Timeline (1 Col) -->
        <div class="space-y-6">
          <!-- Metadata Card -->
          <div class="bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Ticket Details</h3>
            <dl class="space-y-3 text-xs">
              <div>
                <dt class="text-slate-400">Requester</dt>
                <dd class="font-medium text-slate-900 dark:text-white">{{ ticket.requester?.fullName }}</dd>
              </div>
              <div>
                <dt class="text-slate-400">Assigned Technician</dt>
                <dd class="font-medium text-slate-900 dark:text-white">
                  {{ ticket.assignedTo ? ticket.assignedTo.fullName : 'Awaiting claim by technician' }}
                </dd>
              </div>
              <div>
                <dt class="text-slate-400">Department</dt>
                <dd class="font-medium text-slate-900 dark:text-white">{{ ticket.department?.name }}</dd>
              </div>
              <div>
                <dt class="text-slate-400">Branch Location</dt>
                <dd class="font-medium text-slate-900 dark:text-white">{{ ticket.branch?.name }} ({{ ticket.branch?.city }})</dd>
              </div>
              <div>
                <dt class="text-slate-400">Category</dt>
                <dd class="font-medium text-slate-900 dark:text-white">{{ ticket.category?.name }}</dd>
              </div>
              <div *ngIf="ticket.deviceAssetTag">
                <dt class="text-slate-400">Device Asset Tag</dt>
                <dd class="font-mono text-slate-900 dark:text-white">{{ ticket.deviceAssetTag }}</dd>
              </div>
              <div>
                <dt class="text-slate-400">Created</dt>
                <dd class="text-slate-700 dark:text-slate-300">{{ ticket.createdAt | date:'medium' }}</dd>
              </div>
            </dl>
          </div>

          <!-- Activity History Timeline -->
          <div class="bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Activity Timeline</h3>
            <div class="space-y-3 border-l border-slate-200 dark:border-slate-700 ml-2 pl-4">
              <div *ngFor="let h of ticket.history" class="relative">
                <div class="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-emerald-500"></div>
                <div class="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {{ h.fromStatus }} &rarr; {{ h.toStatus }}
                </div>
                <div class="text-[11px] text-slate-500" *ngIf="h.reason">{{ h.reason }}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">{{ h.createdAt | date:'short' }} by {{ h.actor?.fullName }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Reopen Modal -->
      <div *ngIf="showReopenModal" class="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
        <div class="bg-white dark:bg-slate-800 max-w-md w-full rounded-lg p-6 shadow-xl border border-slate-200 dark:border-slate-700">
          <h3 class="text-base font-bold text-slate-900 dark:text-white mb-2">Reopen Ticket</h3>
          <p class="text-xs text-slate-500 mb-4">Please provide a reason why this technical issue needs to be reopened:</p>
          <textarea
            rows="3"
            [(ngModel)]="reopenReason"
            placeholder="e.g. Issue re-occurred upon second reboot..."
            class="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          ></textarea>
          <div class="flex justify-end space-x-2">
            <button
              (click)="showReopenModal = false"
              class="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
            >
              Cancel
            </button>
            <button
              (click)="reopenTicket()"
              [disabled]="!reopenReason.trim()"
              class="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded text-xs font-semibold transition"
            >
              Confirm Reopen
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class TicketDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private ticketService = inject(TicketService);
  public authService = inject(AuthService);

  ticket: Ticket | null = null;
  comments: Comment[] = [];
  attachments: Attachment[] = [];
  newComment = '';
  commentError = '';
  sendingComment = false;
  showReopenModal = false;
  reopenReason = '';

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTicket(id);
    }
  }

  loadTicket(id: string) {
    this.ticketService.getTicketById(id).subscribe({
      next: (res) => {
        this.ticket = res.ticket;
        this.loadComments(id);
      }
    });
  }

  loadComments(ticketId: string) {
    this.ticketService.getComments(ticketId).subscribe({
      next: (res) => {
        this.comments = res.comments;
        // Collect attachments
        const allAtts: Attachment[] = [];
        this.comments.forEach(c => {
          if (c.attachments) allAtts.push(...c.attachments);
        });
        this.attachments = allAtts;
      }
    });
  }

  postComment() {
    if (!this.ticket || !this.newComment.trim()) return;

    this.sendingComment = true;
    this.commentError = '';

    this.ticketService.addComment(this.ticket.id, this.newComment, 'PUBLIC').subscribe({
      next: (res) => {
        this.comments.push(res.comment);
        this.newComment = '';
        this.sendingComment = false;
      },
      error: (err) => {
        this.sendingComment = false;
        this.commentError = err.error?.message || 'Failed to post comment. Ensure no sensitive cards/passwords are entered.';
      }
    });
  }

  uploadFile(event: any) {
    const file = event.target.files?.[0];
    if (!file || !this.ticket) return;

    this.ticketService.uploadAttachment(this.ticket.id, file).subscribe({
      next: (res) => {
        this.attachments.push(res.attachment);
      },
      error: (err) => {
        alert(err.error?.message || 'File upload rejected');
      }
    });
  }

  downloadAttachment(id: string) {
    this.ticketService.getAttachmentDownloadUrl(id).subscribe({
      next: (res) => {
        window.open(res.url, '_blank');
      },
      error: (err) => {
        alert(err.error?.message || 'Could not download attachment');
      }
    });
  }

  confirmResolution() {
    if (!this.ticket) return;
    this.ticketService.transitionStatus(this.ticket.id, 'CLOSED', 'Resolution confirmed by employee').subscribe({
      next: (res) => {
        this.ticket = res.ticket;
      }
    });
  }

  reopenTicket() {
    if (!this.ticket || !this.reopenReason.trim()) return;
    this.ticketService.transitionStatus(this.ticket.id, 'REOPENED', this.reopenReason).subscribe({
      next: (res) => {
        this.ticket = res.ticket;
        this.showReopenModal = false;
        this.reopenReason = '';
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to reopen ticket');
      }
    });
  }
}
