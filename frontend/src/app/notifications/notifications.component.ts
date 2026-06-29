// src/app/notifications/notifications.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon,
  IonRefresher, IonRefresherContent, IonButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkDoneOutline, notificationsOutline, trashOutline } from 'ionicons/icons';
import { NotificationService, AppNotification } from '../core/services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonRefresher, IonRefresherContent, IonButton],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="notif-header-row">
          <div class="page-title">Notifications</div>
          @if (notifications().length > 0) {
            <button class="btn-mark-all" (click)="markAll()">
              <ion-icon name="checkmark-done-outline"></ion-icon> Mark all read
            </button>
          }
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content class="notif-content">
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>
      @if (notifications().length === 0) {
        <div class="empty-state">
          <div style="font-size:64px;margin-bottom:16px">🔔</div>
          <h3>All caught up!</h3>
          <p>No notifications yet</p>
        </div>
      } @else {
        <div class="notif-list">
          @for (n of notifications(); track n._id) {
            <div class="notif-card" [class.unread]="!n.isRead" (click)="markRead(n)">
              <div class="notif-icon">{{ typeEmoji(n.type) }}</div>
              <div class="notif-body">
                <div class="notif-title">{{ n.title }}</div>
                <div class="notif-message">{{ n.message }}</div>
                <div class="notif-time">{{ n.createdAt | date:'MMM d, h:mm a' }}</div>
              </div>
              @if (!n.isRead) { <div class="unread-dot"></div> }
            </div>
          }
        </div>
      }
    </ion-content>`,
  styles: [`
    .notif-content { --background:var(--rm-bg); }
    ion-toolbar { --background:var(--rm-card); }
    .notif-header-row { display:flex; align-items:center; justify-content:space-between; padding:20px 16px 16px; }
    .page-title { font-size:22px; font-weight:800; color:var(--rm-text-primary); }
    .btn-mark-all { display:flex; align-items:center; gap:4px; padding:8px 12px; background:var(--rm-purple-light); color:var(--rm-purple); border:none; border-radius:12px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; }
    .empty-state { text-align:center; padding:80px 32px; }
    .empty-state h3 { font-size:18px; font-weight:700; margin-bottom:8px; }
    .empty-state p { color:var(--rm-text-muted); }
    .notif-list { padding:8px 16px 24px; display:flex; flex-direction:column; gap:8px; }
    .notif-card { background:var(--rm-card); border-radius:16px; padding:14px; display:flex; align-items:flex-start; gap:12px; box-shadow:var(--rm-shadow-sm); cursor:pointer; position:relative; }
    .notif-card.unread { background:rgba(61,90,241,0.08); border-left:3px solid var(--rm-purple); }
    .notif-icon { font-size:28px; flex-shrink:0; }
    .notif-body { flex:1; }
    .notif-title { font-size:14px; font-weight:700; color:var(--rm-text-primary); margin-bottom:3px; }
    .notif-message { font-size:13px; color:var(--rm-text-muted); margin-bottom:4px; }
    .notif-time { font-size:11px; color:var(--rm-text-muted); }
    .unread-dot { width:8px; height:8px; border-radius:50%; background:var(--rm-purple); flex-shrink:0; margin-top:4px; }
  `],
})
export class NotificationsComponent implements OnInit {
  private notifService = inject(NotificationService);
  readonly notifications = this.notifService.notifications;

  constructor() { addIcons({ checkmarkDoneOutline, notificationsOutline, trashOutline }); }
  ngOnInit() { this.notifService.getAll().subscribe(); }

  doRefresh(event: CustomEvent) {
    this.notifService.getAll().subscribe({ complete: () => (event.target as HTMLIonRefresherElement).complete() });
  }

  markRead(n: AppNotification) { if (!n.isRead) this.notifService.markRead(n._id).subscribe(); }
  markAll() { this.notifService.markAllRead().subscribe(); }

  typeEmoji(type: string): string {
    const map: Record<string, string> = {
      reminder_due: '⏰', reminder_assigned: '📌', reminder_response: '✅',
      friend_request: '👋', friend_accepted: '🎉', system: '📢',
    };
    return map[type] ?? '🔔';
  }
}
