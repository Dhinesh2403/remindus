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

    // Request permission
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.warn('[Push] Notification permission denied');
      return;
    }

    // Register with FCM — triggers registration event below
    await PushNotifications.register();

    // Token received → send to backend
    PushNotifications.addListener('registration', ({ value: token }) => {
      console.log('[Push] FCM token:', token);
      this.http.patch(this.API, { token }).subscribe({
        error: (e) => console.warn('[Push] Token upload failed', e.message),
      });
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err.error);
    });

    // Foreground notification received
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Foreground notification:', notification);
      // The in-app notification bell (Socket.IO) already handles real-time
      // updates, so no extra UI action is needed here.
    });

    // Notification tapped (background / killed state)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data ?? {};
      const type = data['type'] as string;

      if (type === 'friend_request' || type === 'friend_accepted') {
        this.router.navigate(['/app/friends']);
      } else if (type === 'reminder:due' || type === 'reminder:assigned') {
        const id = data['reminderId'];
        this.router.navigate(id ? ['/app/reminders', id] : ['/app/home']);
      } else {
        this.router.navigate(['/app/home']);
      }
    });
  }

  /** Call on logout to remove the token from the backend */
  async deregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    this.http.patch(this.API, { token: null }).subscribe();
    await PushNotifications.removeAllListeners();
  }
}
