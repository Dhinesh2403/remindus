// src/app/core/interceptors/error.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectivityService } from '../services/connectivity.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const connectivity = inject(ConnectivityService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (environment.enableLogging) {
        console.error(`[HTTP Error] ${req.method} ${req.url}`, {
          status:  err.status,
          message: err.error?.message ?? err.message,
        });
      }

      // Status 0 = network unreachable; 5xx = server error. Either means the
      // backend is effectively down. The device-log endpoint is excluded so a
      // failing log upload can't itself flip the app into "server down".
      const serverDown = (err.status === 0 || err.status >= 500);
      if (serverDown && !req.url.includes('/logs/device')) {
        connectivity.markServerDown();
      } else if (err.status > 0 && err.status < 500) {
        // A real HTTP response came back — the server is reachable.
        connectivity.markServerUp();
      }

      return throwError(() => err);
    })
  );
};
