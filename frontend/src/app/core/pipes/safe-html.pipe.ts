// src/app/core/pipes/safe-html.pipe.ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Marks an author-controlled HTML string (inline SVG icons, formatted labels)
 * as trusted so Angular renders it through [innerHTML] without stripping the
 * <svg> markup the redesign relies on.
 *
 * Only ever pass strings we author ourselves — never raw user input.
 */
@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value ?? '');
  }
}
