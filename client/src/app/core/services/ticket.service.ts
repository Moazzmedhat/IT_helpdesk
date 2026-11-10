import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { Ticket, Comment, Attachment, Department, Branch, Category, Priority, CommentVisibility, TicketStatus } from '../models';

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private http = inject(HttpClient);

  private categories$?: Observable<{ categories: Category[] }>;
  private departments$?: Observable<{ departments: Department[] }>;
  private branches$?: Observable<{ branches: Branch[] }>;
  private priorities$?: Observable<{ priorities: Priority[] }>;

  getDepartments(): Observable<{ departments: Department[] }> {
    if (!this.departments$) {
      this.departments$ = this.http.get<{ departments: Department[] }>('/api/admin/departments').pipe(shareReplay(1));
    }
    return this.departments$;
  }

  getBranches(): Observable<{ branches: Branch[] }> {
    if (!this.branches$) {
      this.branches$ = this.http.get<{ branches: Branch[] }>('/api/admin/branches').pipe(shareReplay(1));
    }
    return this.branches$;
  }

  getCategories(): Observable<{ categories: Category[] }> {
    if (!this.categories$) {
      this.categories$ = this.http.get<{ categories: Category[] }>('/api/admin/categories').pipe(shareReplay(1));
    }
    return this.categories$;
  }

  getPriorities(): Observable<{ priorities: Priority[] }> {
    if (!this.priorities$) {
      this.priorities$ = this.http.get<{ priorities: Priority[] }>('/api/admin/priorities').pipe(shareReplay(1));
    }
    return this.priorities$;
  }

  createTicket(payload: {
    title: string;
    description: string;
    categoryId: string;
    subcategoryId?: string | null;
    priority?: string;
    departmentId?: string;
    branchId?: string;
    deviceAssetTag?: string | null;
  }): Observable<{ success: boolean; ticket: Ticket }> {
    return this.http.post<{ success: boolean; ticket: Ticket }>('/api/tickets', payload);
  }

  listTickets(options: {
    queueTab?: string;
    status?: string;
    priority?: string;
    departmentId?: string;
    branchId?: string;
    categoryId?: string;
    search?: string;
    myAssigned?: boolean;
    assignedToId?: string;
    limit?: number;
    offset?: number;
  }): Observable<{ success: boolean; tickets: Ticket[]; total: number; limit: number; offset: number }> {
    let params = new HttpParams();
    Object.entries(options).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, v.toString());
      }
    });
    return this.http.get<{ success: boolean; tickets: Ticket[]; total: number; limit: number; offset: number }>('/api/tickets', { params });
  }

  getTicketById(id: string): Observable<{ success: boolean; ticket: Ticket }> {
    return this.http.get<{ success: boolean; ticket: Ticket }>(`/api/tickets/${id}`);
  }

  claimTicket(id: string): Observable<{ success: boolean; ticket: Ticket; message: string }> {
    return this.http.post<{ success: boolean; ticket: Ticket; message: string }>(`/api/tickets/${id}/claim`, {});
  }

  releaseTicket(id: string, reason: string): Observable<{ success: boolean; ticket: Ticket; message: string }> {
    return this.http.post<{ success: boolean; ticket: Ticket; message: string }>(`/api/tickets/${id}/release`, { reason });
  }

  transitionStatus(id: string, status: TicketStatus, reason?: string): Observable<{ success: boolean; ticket: Ticket; message: string }> {
    return this.http.post<{ success: boolean; ticket: Ticket; message: string }>(`/api/tickets/${id}/transition`, { status, reason });
  }

  reassignTicket(id: string, technicianId: string, reason: string): Observable<{ success: boolean; ticket: Ticket; message: string }> {
    return this.http.post<{ success: boolean; ticket: Ticket; message: string }>(`/api/tickets/${id}/reassign`, { technicianId, reason });
  }

  getComments(ticketId: string): Observable<{ success: boolean; comments: Comment[] }> {
    return this.http.get<{ success: boolean; comments: Comment[] }>(`/api/tickets/${ticketId}/comments`);
  }

  addComment(ticketId: string, content: string, visibility: CommentVisibility = 'PUBLIC'): Observable<{ success: boolean; comment: Comment }> {
    return this.http.post<{ success: boolean; comment: Comment }>(`/api/tickets/${ticketId}/comments`, { content, visibility });
  }

  uploadAttachment(ticketId: string, file: File, commentId?: string): Observable<{ success: boolean; attachment: Attachment }> {
    const formData = new FormData();
    formData.append('file', file);
    if (commentId) {
      formData.append('commentId', commentId);
    }
    return this.http.post<{ success: boolean; attachment: Attachment }>(`/api/tickets/${ticketId}/attachments/upload`, formData);
  }

  getAttachmentDownloadUrl(attachmentId: string): Observable<{ success: boolean; url: string; attachment: Attachment }> {
    return this.http.get<{ success: boolean; url: string; attachment: Attachment }>(`/api/attachments/${attachmentId}/url`);
  }
}
