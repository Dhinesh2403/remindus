// src/app/core/services/push.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { environment } from '../../../environments/environment';

// Persistent logging for debugging
class PushLogger {
  private logs: string[] = [];
  private maxLogs = 100;

  log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data) : ''}`;
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.shift();
    localStorage.setItem('rm_push_logs', JSON.stringify(this.logs));
    console.log('[Push]', entry);
  }

  getLogs(): string[] {
    try {
      return JSON.parse(localStorage.getItem('rm_push_logs') || '[]');
    } catch {
      return [];
    }
  }

  clear() {
    this.logs = [];
    localStorage.removeItem('rm_push_logs');
  }
}

const pushLogger = new PushLogger();

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

  constructor() {
    pushLogger.log('🔧 PushService constructor called');

    // Expose debugging functions to window
    (window as any).rmPushDebug = {
      getFcmToken: () => localStorage.getItem('rm_fcm_token') || 'Not set yet',
      isSynced: () => localStorage.getItem('rm_fcm_token_synced') === 'true',
      getLogs: () => pushLogger.getLogs(),
      printLogs: () => {
        const logs = pushLogger.getLogs();
        console.log('=== FCM LOGS ===');
        logs.forEach(log => console.log(log));
        console.log('================');
        return logs.join('\n');
      },
      clearLogs: () => {
        pushLogger.clear();
        console.log('Logs cleared');
      },
      getEnvironment: () => ({
        apiUrl: environment.apiUrl,
        socketUrl: environment.socketUrl,
        platform: Capacitor.getPlatform(),
        isNative: Capacitor.isNativePlatform(),
      }),
    };
    console.log('✅ rmPushDebug exposed to window');
  }

  async init(): Promise<void> {
    pushLogger.log('🚀 init() called');
    pushLogger.log('Platform:', Capacitor.getPlatform());
    pushLogger.log('isNativePlatform:', Capacitor.isNativePlatform());

    if (!Capacitor.isNativePlatform()) {
      pushLogger.log('⏭️ Skipping — not a native platform');
      return;
    }

    try {
      // Attach listeners BEFORE register() — register() fires the `registration`
      // event asynchronously, and any listener added afterwards would miss the
      // token entirely (it would never reach the backend).

      pushLogger.log('📍 Adding registration listener...');
      // Token received → send to backend
      await PushNotifications.addListener('registration', ({ value: token }) => {
        pushLogger.log('✅ FCM token received', { token, length: token?.length });
        // Store locally for debugging
        localStorage.setItem('rm_fcm_token', token);

        pushLogger.log('📤 Uploading token to backend', { endpoint: this.API });
        this.http.patch(this.API, { token }).subscribe({
          next: (res) => {
            pushLogger.log('✅ Token uploaded to backend successfully', res);
            localStorage.setItem('rm_fcm_token_synced', 'true');
          },
          error: (e) => {
            pushLogger.log('❌ Token upload failed', {
              status: e?.status,
              statusText: e?.statusText,
              message: e?.error?.message || e.message,
            });
            localStorage.setItem('rm_fcm_token_synced', 'false');
          },
        });
      });

      pushLogger.log('📍 Adding registrationError listener...');
      await PushNotifications.addListener('registrationError', (err) => {
        pushLogger.log('❌ Registration error', { error: err.error });
      });

      pushLogger.log('📍 Adding pushNotificationReceived listener...');
      // Foreground notification received
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        pushLogger.log('✅ Foreground notification received', {
          title: notification.notification?.title,
          body: notification.notification?.body,
          data: notification.notification?.data,
        });
      });

      pushLogger.log('📍 Adding pushNotificationActionPerformed listener...');
      // Notification tapped (background / killed state)
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        pushLogger.log('✅ Notification action performed (tapped)', {
          title: action.notification?.title,
          data: action.notification?.data,
        });
        const data         = action.notification?.data ?? {};
        const type         = String(data['type'] ?? '');
        const reminderId   = data['reminderId'];
        const friendshipId = data['friendshipId'];

        pushLogger.log('📱 Routing notification', { type, reminderId, friendshipId });

        switch (type) {
          case 'friend_request':
            this.router.navigate(['/app/friends'],
              friendshipId ? { queryParams: { accept: friendshipId } } : undefined);
            break;
          case 'friend_accepted':
            this.router.navigate(['/app/friends']);
            break;
          case 'reminder_due':
            this.router.navigate(reminderId ? ['/app/reminders', reminderId] : ['/app/reminders']);
            break;
          case 'reminder_assigned':
          case 'reminder_pre_alert':
          case 'friend_reminder_due':
            this.router.navigate(['/app/reminders']);
            break;
          case 'reminder_response':
          case 'reminder_status_update':
            this.router.navigate(['/app/reminders']);
            break;
          default:
            this.router.navigate(['/app/home']);
        }
      });

      // Listeners are attached — now request permission and register with FCM.
      pushLogger.log('🔐 Checking notification permissions...');
      let permission = await PushNotifications.checkPermissions();
      pushLogger.log('🔐 Permission state', { receive: permission.receive });

      if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
        pushLogger.log('🔐 Requesting notification permissions...');
        permission = await PushNotifications.requestPermissions();
        pushLogger.log('🔐 Permission after request', { receive: permission.receive });
      }

      if (permission.receive !== 'granted') {
        pushLogger.log('❌ Notification permission NOT granted', { receive: permission.receive });
        return;
      }

      // Create the Android notification channel the backend targets.
      // Without this, Android 8+ has no 'remindus_default' channel and pushes
      // sent with that channelId are dropped or degraded.
      if (Capacitor.getPlatform() === 'android') {
        try {
          await PushNotifications.createChannel({
            id:          'remindus_default',
            name:        'Reminders & Messages',
            description: 'Reminders, chat messages and friend activity',
            importance:  5,           // IMPORTANCE_HIGH → heads-up + sound
            visibility:  1,           // VISIBILITY_PUBLIC
            sound:       'default',
            vibration:   true,
            lights:      true,
          });
          pushLogger.log('✅ Notification channel "remindus_default" created');
        } catch (chErr) {
          pushLogger.log('❌ createChannel failed', {
            message: chErr instanceof Error ? chErr.message : String(chErr),
          });
        }
      }

      // Register with FCM — fires the `registration` listener above with the token.
      pushLogger.log('📡 Calling PushNotifications.register()...');
      await PushNotifications.register();
      pushLogger.log('✅ PushNotifications.register() completed (token coming via listener)');

    } catch (error) {
      pushLogger.log('❌ Error during init', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /** Call on logout to remove the token from the backend */
  async deregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    this.http.patch(this.API, { token: null }).subscribe();
    await PushNotifications.removeAllListeners();
  }
}
