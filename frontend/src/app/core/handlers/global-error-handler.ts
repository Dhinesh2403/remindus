// src/app/core/handlers/global-error-handler.ts
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggerService } from '../services/logger.service';

/**
 * Catches otherwise-uncaught runtime errors from anywhere in the Angular app and
 * forwards them to the device-log pipeline (for the admin dashboard), while
 * preserving the default console behaviour.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggerService);

  handleError(error: unknown): void {
    const err = error as { message?: string; stack?: string } | undefined;
    const message = err?.message ?? String(error);
    this.logger.error(message, { source: 'angular' }, err?.stack ?? null);

    // Preserve default dev experience.
    // eslint-disable-next-line no-console
    console.error(error);
  }
}
