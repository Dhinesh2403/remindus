// src/app/friends/friends.component.ts
import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar,
  IonIcon, IonRefresher, IonRefresherContent,
  IonSearchbar, IonSkeletonText,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personAddOutline, chatbubbleOutline, callOutline,
  ellipseOutline, checkmarkCircle, closeOutline, searchOutline,
} from 'ionicons/icons';
import { Subject, EMPTY } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { FriendService, Friend, UserSearchResult } from '../core/services/friend.service';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar,
    IonIcon, IonRefresher, IonRefresherContent,
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
          <button class="btn-add-friend" (click)="openAddPanel()">
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

      @if (showAddPanel()) {
        <div class="add-panel">
          <div class="add-panel-header">
            <ion-icon name="search-outline" class="panel-icon"></ion-icon>
            <span class="panel-title">Find Friends</span>
            <button class="btn-close-panel" (click)="closeAddPanel()">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <div class="add-panel-input-wrap">
            <input
              class="friend-search-input"
              type="text"
              placeholder="Search by name..."
              autocomplete="off"
              (input)="onFriendSearch($event)"
            />
          </div>
          @if (addQuery().length === 1) {
            <div class="panel-hint">Type one more character to search</div>
          }
          @if (isSearching()) {
            <div class="panel-loading">
              <div class="loader-ring"></div>
              <span>Searching...</span>
            </div>
          } @else if (searchResults().length > 0) {
            <div class="search-results">
              @for (user of searchResults(); track user._id) {
                <div class="result-row">
                  <div class="result-avatar">{{ user.name[0].toUpperCase() }}</div>
                  <div class="result-info">
                    <div class="result-name">{{ user.name }}</div>
                    <div class="result-email">{{ user.email }}</div>
                  </div>
                  <button class="btn-add-user" [disabled]="sending() === user._id" (click)="addFriend(user)">
                    {{ sending() === user._id ? '...' : 'Add' }}
                  </button>
                </div>
              }
            </div>
          } @else if (addQuery().length >= 2 && !isSearching()) {
            <div class="panel-hint">No users found for "{{ addQuery() }}"</div>
          }
        </div>
      }

      <div class="search-wrap">
        <ion-searchbar placeholder="Search friends..." [debounce]="300"
          (ionInput)="onSearch($event)" mode="ios" class="custom-searchbar">
        </ion-searchbar>
      </div>

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
          <button class="btn-empty-add" (click)="openAddPanel()">
            <ion-icon name="person-add-outline"></ion-icon>
            Add Your First Friend
          </button>
        </div>
      } @else {
        <div class="friends-list">
          @for (friend of filtered(); track friend._id) {
            <div class="friend-card">
              <div class="friend-top">
                <div class="friend-avatar-wrap">
                  <div class="friend-avatar">{{ getInitials(friend.name) }}</div>
                  <span class="status-dot" [class.online]="friend.isOnline"></span>
                </div>
                <div class="friend-meta">
                  <div class="friend-name">{{ friend.name }}</div>
                  <div class="friend-username">&#64;{{ friend.username }}</div>
                </div>
              </div>
              <div class="friend-stats">
                <div class="fstat" style="background:rgba(59,130,246,0.12)">
                  <div class="fstat-num" style="color:#3B82F6">{{ friend.responseRate }}%</div>
                  <div class="fstat-label">Response</div>
                </div>
                <div class="fstat" style="background:rgba(124,58,237,0.12)">
                  <div class="fstat-num" style="color:#7C3AED">{{ friend.sharedCount }}</div>
                  <div class="fstat-label">Shared</div>
                </div>
                <div class="fstat" [style.background]="friend.pendingCount > 0 ? 'rgba(234,88,12,0.12)' : 'var(--rm-surface)'">
                  <div class="fstat-num" [style.color]="friend.pendingCount > 0 ? '#EA580C' : 'var(--rm-text-muted)'">{{ friend.pendingCount }}</div>
                  <div class="fstat-label">Pending</div>
                </div>
              </div>
              <div class="friend-actions">
                <button class="btn-send-reminder" (click)="sendReminder(friend)">Send Reminder</button>
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
    .friends-content{--background:var(--rm-bg)}
    ion-toolbar{--background:var(--rm-card);--padding-start:0;--padding-end:0;--padding-top:0;--padding-bottom:0}
    .friends-header-row{display:flex;align-items:center;justify-content:space-between;padding:20px 16px 16px}
    .page-title{font-size:22px;font-weight:800;color:var(--rm-text-primary)}
    .page-sub{font-size:13px;color:var(--rm-text-secondary);margin-top:2px}
    .btn-add-friend{display:flex;align-items:center;gap:6px;padding:10px 16px;background:var(--rm-purple);color:white;border:none;border-radius:14px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit}
    .btn-add-friend ion-icon{font-size:16px}
    .add-panel{margin:12px 16px 0;background:var(--rm-card);border-radius:20px;padding:16px;box-shadow:var(--rm-shadow-sm);border:1.5px solid var(--rm-purple-light)}
    .add-panel-header{display:flex;align-items:center;gap:8px;margin-bottom:12px}
    .panel-icon{font-size:18px;color:var(--rm-purple)}
    .panel-title{flex:1;font-size:15px;font-weight:700;color:var(--rm-text-primary)}
    .btn-close-panel{width:30px;height:30px;border:none;background:var(--rm-surface);border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--rm-text-secondary);padding:0}
    .btn-close-panel ion-icon{font-size:18px;pointer-events:none}
    .add-panel-input-wrap{margin-bottom:4px}
    .friend-search-input{width:100%;padding:12px 14px;border:1.5px solid var(--rm-border);border-radius:12px;background:var(--rm-surface);color:var(--rm-text-primary);font-size:15px;font-family:inherit;outline:none;box-sizing:border-box}
    .friend-search-input:focus{border-color:var(--rm-purple)}
    .friend-search-input::placeholder{color:var(--rm-text-muted)}
    .panel-hint{font-size:13px;color:var(--rm-text-muted);padding:10px 2px;text-align:center}
    .panel-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;color:var(--rm-text-secondary);font-size:14px}
    .loader-ring{width:18px;height:18px;border:2.5px solid var(--rm-border);border-top-color:var(--rm-purple);border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0}
    @keyframes spin{to{transform:rotate(360deg)}}
    .search-results{display:flex;flex-direction:column;gap:2px;margin-top:8px}
    .result-row{display:flex;align-items:center;gap:10px;padding:10px 6px;border-radius:12px;transition:background 0.15s}
    .result-row:active{background:var(--rm-surface)}
    .result-avatar{width:40px;height:40px;border-radius:50%;background:var(--rm-purple-light);color:var(--rm-purple);font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .result-info{flex:1;min-width:0}
    .result-name{font-size:14px;font-weight:700;color:var(--rm-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .result-email{font-size:12px;color:var(--rm-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .btn-add-user{padding:8px 16px;background:var(--rm-purple);color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0}
    .btn-add-user:disabled{opacity:0.6;cursor:default}
    .search-wrap{padding:8px 12px 0}
    .custom-searchbar{--background:var(--rm-surface);--border-radius:14px;--box-shadow:var(--rm-shadow-sm);--color:var(--rm-text-primary);--placeholder-color:var(--rm-text-muted);padding:0}
    .requests-banner{margin:12px 16px;background:rgba(234,88,12,0.08);border-radius:16px;padding:14px;border:1.5px solid rgba(234,88,12,0.2)}
    .requests-title{font-size:13px;font-weight:700;color:#C2410C;display:flex;align-items:center;gap:6px;margin-bottom:10px}
    .request-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
    .req-avatar{width:32px;height:32px;border-radius:50%;background:var(--rm-purple-light);color:var(--rm-purple);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .req-name{flex:1;font-size:14px;font-weight:600}
    .btn-accept{padding:6px 12px;background:var(--rm-green);color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
    .btn-reject{padding:6px 12px;background:var(--rm-surface);color:var(--rm-text-secondary);border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
    .friend-card-skeleton{display:flex;align-items:center;padding:16px;background:var(--rm-card);border-radius:20px;margin:8px 16px;box-shadow:var(--rm-shadow-sm)}
    .skeleton-avatar{width:52px;height:52px;border-radius:50%;background:var(--rm-surface);flex-shrink:0;animation:pulse 1.5s ease-in-out infinite}
    .skeleton-lines{flex:1;padding-left:12px}
    .skeleton-line{height:12px;border-radius:6px;background:var(--rm-surface);margin-bottom:8px;animation:pulse 1.5s ease-in-out infinite}
    .w70{width:70%}.w40{width:40%}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
    .empty-state{text-align:center;padding:64px 32px}
    .empty-emoji{font-size:64px;margin-bottom:16px}
    .empty-state h3{font-size:18px;font-weight:700;color:var(--rm-text-primary);margin-bottom:8px}
    .empty-state p{font-size:14px;color:var(--rm-text-muted);margin-bottom:24px}
    .btn-empty-add{display:inline-flex;align-items:center;gap:8px;padding:14px 24px;background:var(--rm-purple);color:white;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
    .friends-list{padding:8px 16px 24px;display:flex;flex-direction:column;gap:14px}
    .friend-card{background:var(--rm-card);border-radius:20px;padding:18px;box-shadow:var(--rm-shadow-sm)}
    .friend-top{display:flex;align-items:center;gap:12px;margin-bottom:14px}
    .friend-avatar-wrap{position:relative;flex-shrink:0}
    .friend-avatar{width:52px;height:52px;border-radius:50%;background:var(--rm-purple-light);color:var(--rm-purple);font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center}
    .status-dot{width:13px;height:13px;border-radius:50%;border:2.5px solid var(--rm-card);position:absolute;bottom:1px;right:1px;background:var(--rm-border)}
    .status-dot.online{background:#10B981}
    .friend-name{font-size:16px;font-weight:800;color:var(--rm-text-primary)}
    .friend-username{font-size:12px;color:var(--rm-text-muted);margin-top:2px}
    .friend-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
    .fstat{text-align:center;padding:10px 4px;border-radius:12px}
    .fstat-num{font-size:18px;font-weight:800;line-height:1}
    .fstat-label{font-size:10px;color:var(--rm-text-muted);margin-top:3px;font-weight:500}
    .friend-actions{display:flex;align-items:center;gap:8px}
    .btn-send-reminder{flex:1;padding:11px;background:var(--rm-purple-light);color:var(--rm-purple);border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
    .btn-icon{width:42px;height:42px;border:1.5px solid var(--rm-border);border-radius:12px;background:var(--rm-surface);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--rm-text-secondary)}
    .btn-icon ion-icon{font-size:18px}
  `],
})
export class FriendsComponent implements OnInit, OnDestroy {
  private friendService = inject(FriendService);
  private toastCtrl    = inject(ToastController);

  isLoading       = signal(true);
  searchQuery     = signal('');
  friends         = signal<Friend[]>([]);
  pendingRequests = signal<any[]>([]);

  showAddPanel  = signal(false);
  addQuery      = signal('');
  searchResults = signal<UserSearchResult[]>([]);
  isSearching   = signal(false);
  sending       = signal<string | null>(null);

  private search$ = new Subject<string>();
  private searchSub: any;

  readonly filtered = () => {
    const q = this.searchQuery().toLowerCase();
    return this.friends().filter(f =>
      !q || f.name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)
    );
  };

  constructor() {
    addIcons({ personAddOutline, chatbubbleOutline, callOutline,
               ellipseOutline, checkmarkCircle, closeOutline, searchOutline });
  }

  ngOnInit() {
    this.load();
    this.searchSub = this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2) {
          this.searchResults.set([]);
          this.isSearching.set(false);
          return EMPTY;
        }
        this.isSearching.set(true);
        return this.friendService.searchUsers(q);
      }),
    ).subscribe({
      next: (res: any) => {
        this.searchResults.set(res.users ?? []);
        this.isSearching.set(false);
      },
      error: () => this.isSearching.set(false),
    });
  }

  ngOnDestroy() { this.searchSub?.unsubscribe(); }

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

  openAddPanel() {
    this.showAddPanel.set(true);
    this.addQuery.set('');
    this.searchResults.set([]);
    this.isSearching.set(false);
    setTimeout(() => {
      (document.querySelector('.friend-search-input') as HTMLInputElement)?.focus();
    }, 100);
  }

  closeAddPanel() {
    this.showAddPanel.set(false);
    this.addQuery.set('');
    this.searchResults.set([]);
    this.isSearching.set(false);
    this.sending.set(null);
  }

  onFriendSearch(event: Event) {
    const q = (event.target as HTMLInputElement).value.trim();
    this.addQuery.set(q);
    this.search$.next(q);
  }

  async addFriend(user: UserSearchResult) {
    this.sending.set(user._id);
    this.friendService.sendRequest(user.email).subscribe({
      next: async () => {
        this.sending.set(null);
        this.closeAddPanel();
        const toast = await this.toastCtrl.create({
          message: `Friend request sent to ${user.name}!`,
          duration: 2500, color: 'success', position: 'top',
        });
        toast.present();
        this.load();
      },
      error: async (err) => {
        this.sending.set(null);
        const toast = await this.toastCtrl.create({
          message: err?.error?.message || 'Could not send request',
          duration: 2500, color: 'danger', position: 'top',
        });
        toast.present();
      },
    });
  }

  accept(id: string) { this.friendService.accept(id).subscribe(() => this.load()); }
  reject(id: string) { this.friendService.reject(id).subscribe(() => this.load()); }

  async sendReminder(friend: Friend) { console.log('Remind', friend._id); }
  openChat(friend: Friend)   { console.log('Chat', friend.name); }
  callFriend(friend: Friend) { console.log('Call', friend.name); }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
}
