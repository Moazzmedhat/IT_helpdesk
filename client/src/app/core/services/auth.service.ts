import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of, shareReplay } from 'rxjs';
import { User } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public csrfToken: string | null = null;
  public isInitialized$ = new BehaviorSubject<boolean>(false);
  private devUsers$?: Observable<{ users: User[] }>;

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  checkAuth(): Observable<any> {
    return this.http.get<any>('/api/auth/me', { withCredentials: true }).pipe(
      tap(res => {
        if (res.authenticated && res.user) {
          this.currentUserSubject.next(res.user);
        } else {
          this.currentUserSubject.next(null);
        }
        if (res.csrfToken) {
          this.csrfToken = res.csrfToken;
        }
        this.isInitialized$.next(true);
      }),
      catchError(() => {
        this.currentUserSubject.next(null);
        this.isInitialized$.next(true);
        return of({ authenticated: false, user: null });
      })
    );
  }

  getDevUsers(): Observable<{ users: User[] }> {
    if (!this.devUsers$) {
      this.devUsers$ = this.http.get<{ users: User[] }>('/api/auth/dev-users', { withCredentials: true }).pipe(shareReplay(1));
    }
    return this.devUsers$;
  }

  devLogin(email: string): Observable<any> {
    return this.http.post<any>('/api/auth/dev-login', { email }, { withCredentials: true }).pipe(
      tap(res => {
        if (res.success && res.user) {
          this.currentUserSubject.next(res.user);
          if (res.csrfToken) {
            this.csrfToken = res.csrfToken;
          }
        }
      })
    );
  }

  clearLocalAuth(): void {
    this.currentUserSubject.next(null);
    this.csrfToken = null;
  }

  logout(): Observable<any> {
    return this.http.post<any>('/api/auth/logout', {}, { withCredentials: true }).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
      })
    );
  }
}
