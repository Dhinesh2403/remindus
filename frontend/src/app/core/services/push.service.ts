// src/app/core/services/push.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { environment } from '../../../environments/environment';

/**
 * Handles Firebase Cloud Messaging (FCM) token registration and
 * incoming push notification routing on native (Android/iOS) platforms.
 *
 * Call init() once after the user has logged in.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private http   = inject(HttpClient);
  private router = inject(Router);
  private readonly API = `${environment.apiUrl}/users/me/fcm-token`;

  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    // Attach listeners BEFORE register() — register() fires the `registration`
    // event asynchronously, and any listener added afterwards would miss the
    // token entirely (it would never reach the backend).

    // Token received → send to backend
    await PushNotifications.addListener('registration', ({ value: token }) => {
      console.log('[Push] FCM token:', token);
      this.http.patch(this.API, { token }).subscribe({
        error: (e) => console.warn('[Push] Token upload failed', e.message),
      });
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err.error);
    });

    // Foreground notification received
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Foreground notification:', notification);
      // The in-app notification bell (Socket.IO) already handles real-time
      // updates, so no extra UI action is needed here.
    });

    // Notification tapped (background / killed state)
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data         = action.notification.data ?? {};
      const type         = String(data['type'] ?? '');
      const reminderId   = data['reminderId'];
      const friendshipId = data['friendshipId'];

      switch (type) {
        // Incoming request → Friends tab, auto-prompt to accept the sender.
        case 'friend_request':
          this.router.navigate(['/app/friends'],
            friendshipId ? { queryParams: { accept: friendshipId } } : undefined);
          break;

        // Request I sent was accepted → Friends tab.
        case 'friend_accepted':
          this.router.navigate(['/app/friends']);
          break;

        // Own reminder fired → detail page
        case 'reminder_due':
          this.router.navigate(reminderId ? ['/app/reminders', reminderId] : ['/app/reminders']);
          break;

        // Friend assigned a reminder to me / pre-alert / fire-time for assignedTo → Reminders tab
        case 'reminder_assigned':
        case 'reminder_pre_alert':
        case 'friend_reminder_due':
          this.router.navigate(['/app/reminders']);
          break;

        // Status update (friend acted on reminder I sent them) → Reminders tab
        case 'reminder_response':
        case 'reminder_status_update':
          this.router.navigate(['/app/reminders']);
          break;

        default:
          this.router.navigate(['/app/home']);
      }
    });

    // Listeners are attached — now request permission and register with FCM.
    // On Android 13+ this shows the POST_NOTIFICATIONS runtime prompt; on
    // earlier versions / iOS it resolves the OS-level permission.
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') {
      console.warn('[Push] Notification permission denied');
      return;
    }

    // Register with FCM — fires the `registration` listener above with the token.
    await PushNotifications.register();
  }

  /** Call on logout to remove the token from the backend */
  async deregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    this.http.patch(this.API, { token: null }).subscribe();
    await PushNotifications.removeAllListeners();
  }
}
