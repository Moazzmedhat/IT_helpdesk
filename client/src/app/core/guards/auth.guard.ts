import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, filter, take } from 'rxjs';
import { Role } from '../models';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isInitialized$.pipe(
    filter(init => init),
    take(1),
    map(() => {
      if (authService.currentUser) {
        return true;
      }
      router.navigate(['/login']);
      return false;
    })
  );
};

export function roleGuard(...allowedRoles: Role[]): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.isInitialized$.pipe(
      filter(init => init),
      take(1),
      map(() => {
        const user = authService.currentUser;
        if (!user) {
          router.navigate(['/login']);
          return false;
        }

        if (allowedRoles.includes(user.role)) {
          return true;
        }

        // Redirect based on user's actual role
        if (user.role === 'EMPLOYEE') router.navigate(['/employee/dashboard']);
        else if (user.role === 'TECHNICIAN') router.navigate(['/technician/dashboard']);
        else if (user.role === 'ADMIN') router.navigate(['/admin/dashboard']);
        return false;
      })
    );
  };
}
