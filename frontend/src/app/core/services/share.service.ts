// src/app/core/services/share.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/**
 * Shares a user's friend code along with the Play Store link.
 *
 * Uses the Web Share API where available (Android WebView / mobile browsers),
 * falling back to copying the message to the clipboard on desktop.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  buildMessage(refId: string): string {
    return (
      `Add me on Remindus! 🔔\n\n` +
      `My friend code: ${refId}\n\n` +
      `Don't have the app? Download it here:\n${environment.playStoreUrl}\n\n` +
      `Already have it? Open Remindus → Friends → enter my code to send a request.`
    );
  }

  async shareRefId(refId: string): Promise<ShareOutcome> {
    const text = this.buildMessage(refId);

    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'Add me on Remindus', text });
        return 'shared';
      } catch (err) {
        // AbortError = user dismissed the sheet; treat as a no-op, not a failure.
        if ((err as DOMException)?.name === 'AbortError') return 'failed';
        // fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}
