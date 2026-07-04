// src/app/core/services/push.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { environment } from '../../../environments/environment';
import { ChatService } from './chat.service';
import { TokenService } from './token.service';

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
  private chat   = inject(ChatService);
  private tokens = inject(TokenService);
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
      // init() runs again on every login (logout resets the guard in
      // AppComponent). Drop any listeners from a previous session first —
      // otherwise each login stacks another pushNotificationReceived handler
      // and every foreground push gets mirrored twice, three times, …
      await PushNotifications.removeAllListeners();
      await LocalNotifications.removeAllListeners();

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
        this.http.patch(this.API, { token }, { headers: { 'X-Skip-Loading': '1' } }).subscribe({
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
      // Foreground push received. Android does NOT display FCM notifications
      // while the app is in the foreground (presentationOptions is iOS-only),
      // so mirror it as a local notification or the user sees nothing.
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        pushLogger.log('✅ Foreground notification received', {
          title: notification.title,
          body: notification.body,
          data: notification.data,
        });
        if (!this.tokens.getAccessToken()) {
          pushLogger.log('⏭️ Push received while logged out — not shown');
          return;
        }
        const type = String(notification.data?.['type'] ?? '');
        if (type === 'chat_message') {
          // App is in the foreground — the user sees messages live in the UI,
          // so no notification. This push means the socket was down when the
          // server sent it, so pull the missed message(s) into the chat state.
          pushLogger.log('💬 Chat push in foreground — refreshing chat instead of notifying');
          this.chat.refresh();
          return;
        }
        this.showForegroundNotification(notification.title, notification.body, notification.data);
      });

      pushLogger.log('📍 Adding pushNotificationActionPerformed listener...');
      // Notification tapped (background / killed state)
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        pushLogger.log('✅ Notification action performed (tapped)', {
          title: action.notification?.title,
          data: action.notification?.data,
        });
        this.routeFromData(action.notification?.data ?? {});
      });

      // Taps on the local notifications we mirror in the foreground.
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        pushLogger.log('✅ Local notification tapped', { extra: action.notification?.extra });
        this.routeFromData(action.notification?.extra ?? {});
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

  /**
   * Navigate to the page a notification is about (shared by FCM + local taps).
   *
   * Convention for ALL notification types, current and future:
   *  - the payload's `data.type` picks the destination, and the entity id in
   *    the payload (`reminderId` / `senderId` / `friendshipId`) deep-links to
   *    the specific record, falling back to the section list without one;
   *  - alternatively the backend can set `data.route` to an absolute app path
   *    (e.g. "/app/goals/123") and get deep-linking with no app update.
   */
  private routeFromData(data: Record<string, unknown>): void {
    const type         = String(data['type'] ?? '');
    const reminderId   = data['reminderId'] ? String(data['reminderId']) : null;
    const friendshipId = data['friendshipId'] ? String(data['friendshipId']) : null;
    const senderId     = data['senderId'] ? String(data['senderId']) : null;
    const route        = data['route'] ? String(data['route']) : null;

    pushLogger.log('📱 Routing notification', { type, reminderId, friendshipId, senderId, route });

    // Explicit backend-provided destination wins.
    if (route && route.startsWith('/')) {
      this.router.navigateByUrl(route);
      return;
    }

    switch (type) {
      // Incoming request → Friends tab + auto-prompt to accept the sender.
      case 'friend_request':
        this.router.navigate(['/app/friends'],
          friendshipId ? { queryParams: { accept: friendshipId } } : undefined);
        break;
      case 'friend_accepted':
        this.router.navigate(['/app/friends']);
        break;
      // Chat → open the conversation with the sender directly.
      case 'chat_message':
        this.router.navigate(['/app/friends'],
          senderId ? { queryParams: { chat: senderId } } : undefined);
        break;
      // All reminder events → that reminder's detail page (list as fallback).
      case 'reminder_due':
      case 'reminder_assigned':
      case 'reminder_pre_alert':
      case 'friend_reminder_due':
      case 'reminder_response':
      case 'reminder_status_update':
        this.router.navigate(reminderId ? ['/app/reminders', reminderId] : ['/app/reminders']);
        break;
      default:
        this.router.navigate(['/app/home']);
    }
  }

  /** Mirror a foreground FCM push as a local notification (Android shows nothing otherwise). */
  private async showForegroundNotification(
    title?: string,
    body?: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!title && !body) return;   // data-only message — nothing to show
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id:        Date.now() % 2147483647,   // Android needs a Java-int id
          title:     title ?? 'Remindus',
          body:      body ?? '',
          extra:     data ?? {},
          channelId: 'remindus_default',
        }],
      });
      pushLogger.log('✅ Foreground push mirrored as local notification', { title });
    } catch (err) {
      pushLogger.log('❌ Local notification failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Call on logout — BEFORE tokens are cleared, so the PATCH below still goes
   * out authenticated (the interceptor reads the token synchronously when the
   * request is dispatched). Clears the token server-side, invalidates the
   * device's FCM token, and detaches all listeners.
   */
  async deregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    pushLogger.log('🚪 deregister() — logout push cleanup');

    this.http.patch(this.API, { token: null }, { headers: { 'X-Skip-Loading': '1' } }).subscribe({
      next:  () => pushLogger.log('✅ FCM token cleared on backend'),
      error: (e) => pushLogger.log('❌ Backend token clear failed', { status: e?.status }),
    });

    localStorage.removeItem('rm_fcm_token');
    localStorage.removeItem('rm_fcm_token_synced');

    try {
      // Invalidates this device's FCM token entirely — even a token the server
      // failed to forget can no longer be delivered to.
      await PushNotifications.unregister();
      pushLogger.log('✅ FCM unregistered (device token invalidated)');
    } catch (err) {
      pushLogger.log('❌ FCM unregister failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    await PushNotifications.removeAllListeners();
    await LocalNotifications.removeAllListeners();
  }
}
