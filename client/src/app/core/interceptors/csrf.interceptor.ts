import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

function getCookie(name: string): string | null {
  const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return matches ? decodeURIComponent(matches[1]) : null;
}

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.csrfToken || getCookie('XSRF-TOKEN');

  const cloned = req.clone({
    withCredentials: true,
    setHeaders: token && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ? { 'X-CSRF-Token': token }
      : {},
  });

  return next(cloned).pipe(
    catchError(err => {
      if (err.status === 401 && !req.url.includes('/api/auth/me') && !req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/dev-login')) {
        authService.clearLocalAuth();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
