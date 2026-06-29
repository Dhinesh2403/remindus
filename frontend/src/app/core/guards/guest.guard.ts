// src/app/core/guards/guest.guard.ts
import { inject }                from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService }          from '../services/token.service';

export const guestGuard: CanActivateFn = () => {
  const token  = inject(TokenService);
  const router = inject(Router);
  if (token.hasValidSession()) {
    router.navigate(['/app/home']);
    return false;
  }
  return true;
};
