import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

function getCookie(name: string): string | null {
  const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return matches ? decodeURIComponent(matches[1]) : null;
}

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.csrfToken || getCookie('XSRF-TOKEN');

  const cloned = req.clone({
    withCredentials: true,
    setHeaders: token && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ? { 'X-CSRF-Token': token }
      : {},
  });

  return next(cloned);
};
