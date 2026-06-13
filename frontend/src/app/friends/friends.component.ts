// src/app/friends/friends.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonButton, IonIcon, IonRefresher, IonRefresherContent,
  IonSearchbar, IonSkeletonText, IonAvatar,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personAddOutline, chatbubbleOutline, callOutline,
  ellipseOutline, checkmarkCircle,
} from 'ionicons/icons';
import { FriendService, Friend } from '../core/services/friend.service';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonButton, IonIcon, IonRefresher, IonRefresherContent,
    IonSearchbar, IonSkeletonText,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="friends-header-row">
          <div>
            <div class="page-title">Accountability Buddies</div>
            <div class="page-sub">Manage your reminder network</div>
          </div>
          <button class="btn-add-friend" (click)="openAddFriend()">
            <ion-icon name="person-add-outline"></ion-icon>
            Add Friend
          </button>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="friends-content">
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Search -->
      <div class="search-wrap">
        <ion-searchbar
          placeholder="Search friends..."
          [debounce]="300"
          (ionInput)="onSearch($event)"
          mode="ios"
          class="custom-searchbar"
        ></ion-searchbar>
      </div>

      <!-- Pending friend requests banner -->
      @if (pendingRequests().length > 0) {
        <div class="requests-banner">
          <div class="requests-title">
            <ion-icon name="person-add-outline"></ion-icon>
            {{ pendingRequests().length }} pending request{{ pendingRequests().length > 1 ? 's' : '' }}
          </div>
          @for (req of pendingRequests(); track req._id) {
            <div class="request-row">
              <div class="req-avatar">{{ req.name[0] }}</div>
              <span class="req-name">{{ req.name }}</span>
              <button class="btn-accept" (click)="accept(req._id)">Accept</button>
              <button class="btn-reject" (click)="reject(req._id)">Decline</button>
            </div>
          }
        </div>
      }

      <!-- Loading skeleton -->
      @if (isLoading()) {
        @for (i of [1,2,3]; track i) {
          <div class="friend-card-skeleton">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-lines">
              <div class="skeleton-line w70"></div>
              <div class="skeleton-line w40"></div>
            </div>
          </div>
        }
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <div class="empty-emoji">👥</div>
          <h3>No friends yet</h3>
          <p>Add friends to hold each other accountable!</p>
          <button class="btn-empty-add" (click)="openAddFriend()">
            <ion-icon name="person-add-outline"></ion-icon>
            Add Your First Friend
          </button>
        </div>
      } @else {
        <div class="friends-list">
          @for (friend of filtered(); track friend._id) {
            <div class="friend-card">

              <!-- Avatar + name row -->
              <div class="friend-top">
                <div class="friend-avatar-wrap">
                  <div class="friend-avatar">{{ getInitials(friend.name) }}</div>
                  <span
                    class="status-dot"
                    [class.online]="friend.isOnline"
                  ></span>
                </div>
                <div class="friend-meta">
                  <div class="friend-name">{{ friend.name }}</div>
                  <div class="friend-username">&#64;{{ friend.username }}</div>
                </div>
              </div>

              <!-- Stats row -->
              <div class="friend-stats">
                <div class="fstat" style="background:rgba(59,130,246,0.12)">
                  <div class="fstat-num" style="color:#3B82F6">
                    {{ friend.responseRate }}%
                  </div>
                  <div class="fstat-label">Response</div>
                </div>
                <div class="fstat" style="background:rgba(124,58,237,0.12)">
                  <div class="fstat-num" style="color:#7C3AED">
                    {{ friend.sharedCount }}
                  </div>
                  <div class="fstat-label">Shared</div>
                </div>
                <div class="fstat"
                  [style.background]="friend.pendingCount > 0 ? 'rgba(234,88,12,0.12)' : 'var(--rm-surface)'"
                >
                  <div class="fstat-num"
                    [style.color]="friend.pendingCount > 0 ? '#EA580C' : 'var(--rm-text-muted)'"
                  >{{ friend.pendingCount }}</div>
                  <div class="fstat-label">Pending</div>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="friend-actions">
                <button
                  class="btn-send-reminder"
                  (click)="sendReminder(friend)"
                >Send Reminder</button>
                <button class="btn-icon" (click)="openChat(friend)">
                  <ion-icon name="chatbubble-outline"></ion-icon>
                </button>
                <button class="btn-icon" (click)="callFriend(friend)">
                  <ion-icon name="call-outline"></ion-icon>
                </button>
              </div>

            </div>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .friends-content { --background: var(--rm-bg); }
    ion-toolbar { --background: var(--rm-card); --padding-start: 0; --padding-end: 0; --padding-top: 0; --padding-bottom: 0; }
    .friends-header-row { display: flex; align-items: center; justify-content: space-between; padding: 20px 16px 16px; }
    .page-title { font-size: 22px; font-weight: 800; color: var(--rm-text-primary); }
    .page-sub { font-size: 13px; color: var(--rm-text-secondary); margin-top: 2px; }
    .btn-add-friend { display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: var(--rm-purple); color: white; border: none; border-radius: 14px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; font-family: inherit; }
    .btn-add-friend ion-icon { font-size: 16px; }
    .search-wrap { padding: 8px 12px 0; }
    .custom-searchbar { --background: var(--rm-surface); --border-radius: 14px; --box-shadow: var(--rm-shadow-sm); --color: var(--rm-text-primary); --placeholder-color: var(--rm-text-muted); padding: 0; }

    /* Pending requests */
    .requests-banner { margin: 12px 16px; background: rgba(234,88,12,0.08); border-radius: 16px; padding: 14px; border: 1.5px solid rgba(234,88,12,0.2); }
    .requests-title { font-size: 13px; font-weight: 700; color: #C2410C; display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
    .request-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .req-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--rm-purple-light); color: var(--rm-purple); font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .req-name { flex: 1; font-size: 14px; font-weight: 600; }
    .btn-accept { padding: 6px 12px; background: var(--rm-green); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .btn-reject { padding: 6px 12px; background: var(--rm-surface); color: var(--rm-text-secondary); border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }

    /* Skeleton */
    .friend-card-skeleton { display: flex; align-items: center; padding: 16px; background: var(--rm-card); border-radius: 20px; margin: 8px 16px; box-shadow: var(--rm-shadow-sm); }
    .skeleton-avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--rm-surface); flex-shrink: 0; animation: pulse 1.5s ease-in-out infinite; }
    .skeleton-lines { flex: 1; padding-left: 12px; }
    .skeleton-line { height: 12px; border-radius: 6px; background: var(--rm-surface); margin-bottom: 8px; animation: pulse 1.5s ease-in-out infinite; }
    .w70 { width: 70%; }
    .w40 { width: 40%; }
    @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }

    /* Empty state */
    .empty-state { text-align: center; padding: 64px 32px; }
    .empty-emoji { font-size: 64px; margin-bottom: 16px; }
    .empty-state h3 { font-size: 18px; font-weight: 700; color: var(--rm-text-primary); margin-bottom: 8px; }
    .empty-state p { font-size: 14px; color: var(--rm-text-muted); margin-bottom: 24px; }
    .btn-empty-add { display: inline-flex; align-items: center; gap: 8px; padding: 14px 24px; background: var(--rm-purple); color: white; border: none; border-radius: 14px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }

    /* Friend cards */
    .friends-list { padding: 8px 16px 24px; display: flex; flex-direction: column; gap: 14px; }
    .friend-card { background: var(--rm-card); border-radius: 20px; padding: 18px; box-shadow: var(--rm-shadow-sm); }
    .friend-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .friend-avatar-wrap { position: relative; flex-shrink: 0; }
    .friend-avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--rm-purple-light); color: var(--rm-purple); font-size: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
    .status-dot { width: 13px; height: 13px; border-radius: 50%; border: 2.5px solid var(--rm-card); position: absolute; bottom: 1px; right: 1px; background: var(--rm-border); }
    .status-dot.online { background: #10B981; }
    .friend-name { font-size: 16px; font-weight: 800; color: var(--rm-text-primary); }
    .friend-username { font-size: 12px; color: var(--rm-text-muted); margin-top: 2px; }
    .friend-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 14px; }
    .fstat { text-align: center; padding: 10px 4px; border-radius: 12px; }
    .fstat-num { font-size: 18px; font-weight: 800; line-height: 1; }
    .fstat-label { font-size: 10px; color: var(--rm-text-muted); margin-top: 3px; font-weight: 500; }
    .friend-actions { display: flex; align-items: center; gap: 8px; }
    .btn-send-reminder { flex: 1; padding: 11px; background: var(--rm-purple-light); color: var(--rm-purple); border: none; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity .15s; }
    .btn-send-reminder:active { opacity: .8; }
    .btn-icon { width: 42px; height: 42px; border: 1.5px solid var(--rm-border); border-radius: 12px; background: var(--rm-surface); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--rm-text-secondary); }
    .btn-icon ion-icon { font-size: 18px; }
  `],
})
export class FriendsComponent implements OnInit {
  private friendService = inject(FriendService);
  private alertCtrl    = inject(AlertController);
  private toastCtrl    = inject(ToastController);

  isLoading      = signal(true);
  searchQuery    = signal('');
  friends        = signal<Friend[]>([]);
  pendingRequests = signal<any[]>([]);

  readonly filtered = () => {
    const q = this.searchQuery().toLowerCase();
    return this.friends().filter(f =>
      !q || f.name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)
    );
  };

  constructor() {
    addIcons({ personAddOutline, chatbubbleOutline, callOutline, ellipseOutline, checkmarkCircle });
  }

  ngOnInit() { this.load(); }

  private load() {
    this.isLoading.set(true);
    this.friendService.getFriends().subscribe({
      next: ({ friends, pending }) => {
        this.friends.set(friends);
        this.pendingRequests.set(pending);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  doRefresh(event: CustomEvent) {
    this.friendService.getFriends().subscribe({
      next: ({ friends, pending }) => {
        this.friends.set(friends);
        this.pendingRequests.set(pending);
        (event.target as HTMLIonRefresherElement).complete();
      },
      error: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }

  onSearch(event: CustomEvent) {
    this.searchQuery.set(event.detail.value ?? '');
  }

  async openAddFriend() {
    const alert = await this.alertCtrl.create({
      header: 'Add Friend',
      message: 'Enter their email or username',
      inputs: [{ name: 'query', type: 'email', placeholder: 'email@example.com or @username' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Send Request',
          handler: (data) => {
            if (!data.query) return false;
            this.friendService.sendRequest(data.query).subscribe({
              next: async () => {
                const toast = await this.toastCtrl.create({
                  message: '🎉 Friend request sent!',
                  duration: 2500,
                  color: 'success',
                  position: 'top',
                });
                toast.present();
              },
              error: async (err) => {
                const toast = await this.toastCtrl.create({
                  message: err?.error?.message || 'User not found',
                  duration: 2500,
                  color: 'danger',
                  position: 'top',
                });
                toast.present();
              },
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  accept(id: string) {
    this.friendService.accept(id).subscribe(() => this.load());
  }

  reject(id: string) {
    this.friendService.reject(id).subscribe(() => this.load());
  }

  async sendReminder(friend: Friend) {
    const alert = await this.alertCtrl.create({
      header: `Remind ${friend.name}`,
      inputs: [
        { name: 'title',   type: 'text',     placeholder: 'Reminder title' },
        { name: 'message', type: 'textarea',  placeholder: 'Optional message...' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Send',
          handler: (data) => {
            if (!data.title) return false;
            // Dispatch via reminder service (assignToFriend)
            console.log('Sending reminder to', friend._id, data);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  openChat(friend: Friend)  { console.log('Open chat with', friend.name); }
  callFriend(friend: Friend) { console.log('Call', friend.name); }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
}
