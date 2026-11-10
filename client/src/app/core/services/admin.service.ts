import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, Setting, AuditLog } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);

  getDashboardReports(): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>('/api/reports/dashboard');
  }

  getSettings(): Observable<{ settings: Setting[] }> {
    return this.http.get<{ settings: Setting[] }>('/api/admin/settings');
  }

  updateSetting(key: string, value: string): Observable<{ success: boolean; setting: Setting }> {
    return this.http.patch<{ success: boolean; setting: Setting }>(`/api/admin/settings/${key}`, { value });
  }

  getUsers(): Observable<{ users: User[] }> {
    return this.http.get<{ users: User[] }>('/api/admin/users');
  }

  updateUserRole(id: string, role: string): Observable<{ success: boolean; user: User }> {
    return this.http.patch<{ success: boolean; user: User }>(`/api/admin/users/${id}/role`, { role });
  }

  toggleUserActive(id: string): Observable<{ success: boolean; user: User }> {
    return this.http.patch<{ success: boolean; user: User }>(`/api/admin/users/${id}/toggle-active`, {});
  }

  getAuditLogs(params: { action?: string; limit?: number; offset?: number }): Observable<{ success: boolean; logs: AuditLog[]; total: number }> {
    let httpParams = new HttpParams();
    if (params.action) httpParams = httpParams.set('action', params.action);
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.offset) httpParams = httpParams.set('offset', params.offset.toString());
    return this.http.get<{ success: boolean; logs: AuditLog[]; total: number }>('/api/admin/audit-logs', { params: httpParams });
  }

  triggerAutoClose(): Observable<{ success: boolean; result: any }> {
    return this.http.post<{ success: boolean; result: any }>('/api/admin/jobs/auto-close', {});
  }
}
