import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Notification } from '../models';

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private http = inject(HttpClient);
  private socket: Socket | null = null;

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  public ticketEvents$ = new Subject<{ event: string; payload: any }>();

  init() {
    if (this.socket) return;

    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '4200';
    const targetUrl = isDev ? 'http://localhost:3000' : '/';

    this.socket = io(targetUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 5000,
    });

    this.socket.on('ticket:created', (payload) => {
      this.ticketEvents$.next({ event: 'ticket:created', payload });
      this.fetchNotifications();
    });

    this.socket.on('ticket:claimed', (payload) => {
      this.ticketEvents$.next({ event: 'ticket:claimed', payload });
      this.fetchNotifications();
    });

    this.socket.on('ticket:status_changed', (payload) => {
      this.ticketEvents$.next({ event: 'ticket:status_changed', payload });
      this.fetchNotifications();
    });

    this.socket.on('comment:added', (payload) => {
      this.ticketEvents$.next({ event: 'comment:added', payload });
      this.fetchNotifications();
    });

    this.fetchNotifications();
  }

  fetchNotifications() {
    this.http.get<{ success: boolean; notifications: Notification[]; unreadCount: number }>('/api/notifications')
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationsSubject.next(res.notifications);
            this.unreadCountSubject.next(res.unreadCount);
          }
        },
        error: () => {}
      });
  }

  markAsRead(id: string): Observable<any> {
    return this.http.patch(`/api/notifications/${id}/read`, {});
  }

  markAllAsRead(): Observable<any> {
    return this.http.patch('/api/notifications/read-all', {});
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
