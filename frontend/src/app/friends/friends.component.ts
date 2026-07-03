// src/app/friends/friends.component.ts
import { Component, inject, OnInit, OnDestroy, signal, computed, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar,
  IonIcon, IonRefresher, IonRefresherContent,
  ToastController, AlertController,
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  personAddOutline, closeOutline, addOutline, copyOutline,
  chatbubbleEllipsesOutline, arrowBackOutline, send,
  checkmarkOutline, checkmarkDoneOutline, timeOutline,
  createOutline, notificationsOutline, checkboxOutline,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { FriendService, Friend, PendingRequest } from '../core/services/friend.service';
import { FriendAvatarComponent } from '../core/components/friend-avatar.component';
import { SocketService } from '../core/services/socket.service';
import { ChatService, ChatMessage } from '../core/services/chat.service';
import { AuthService } from '../core/services/auth.service';
import { ShareService } from '../core/services/share.service';
import { UiService } from '../core/services/ui.service';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [
    CommonModule, FormsModule, FriendAvatarComponent,
    IonContent, IonHeader, IonToolbar,
    IonIcon, IonRefresher, IonRefresherContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="friends-header-row" [class.pg-in]="pageIn()">
          <div class="page-title a-fd">Friends</div>
          <button class="btn-add a-fd rm-press" [style.--i]="1" (click)="openAddSheet()">
            <ion-icon name="add-outline"></ion-icon>
            Add
          </button>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="friends-content" [class.pg-in]="pageIn()">
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Your Ref ID -->
      <div class="refid-card a-fu" [style.--i]="1">
        <div class="refid-left">
          <div class="refid-label">Your Ref ID</div>
          <div class="refid-value">{{ myRefId() || '••••••••' }}</div>
        </div>
        <button class="refid-copy rm-press" (click)="copyMyCode()" [disabled]="!myRefId()" title="Copy">
          <ion-icon name="copy-outline"></ion-icon>
        </button>
      </div>

      <!-- Requests -->
      @if (pendingRequests().length > 0) {
        <div class="section-label a-fu" [style.--i]="2">Requests</div>
        <div class="list-card a-fu" [style.--i]="2">
          @for (req of pendingRequests(); track req._id) {
            <div class="req-row" [class.highlight]="highlightId() === req._id">
              <app-friend-avatar [name]="req.name" [avatar]="req.avatar" [gender]="req.gender" [size]="46" />
              <div class="req-info">
                <div class="req-name">{{ req.name }}</div>
                <div class="req-sub">wants to connect</div>
              </div>
              <button class="req-accept rm-press" (click)="accept(req._id)" title="Accept">
                <ion-icon name="checkmark-outline"></ion-icon>
              </button>
              <button class="req-decline rm-press" (click)="reject(req._id)" title="Decline">
                <ion-icon name="close-outline"></ion-icon>
              </button>
            </div>
          }
        </div>
      }

      <!-- All friends -->
      <div class="section-label a-fu" [style.--i]="3">All Friends</div>

      @if (isLoading()) {
        <div class="list-card">
          @for (i of [1,2,3]; track i) {
            <div class="friend-row-skel">
              <div class="skel-avatar"></div>
              <div class="skel-lines">
                <div class="skel-line w60"></div>
                <div class="skel-line w30"></div>
              </div>
            </div>
          }
        </div>
      } @else if (friends().length === 0) {
        <div class="empty-state a-fu" [style.--i]="3">
          <div class="empty-emoji">👥</div>
          <h3>No friends yet</h3>
          <p>Add a friend by their Ref ID to hold each other accountable.</p>
          <button class="btn-empty-add" (click)="openAddSheet()">
            <ion-icon name="person-add-outline"></ion-icon>
            Add Your First Friend
          </button>
        </div>
      } @else {
        <div class="list-card">
          @for (friend of friends(); track friend._id) {
            <div class="friend-row a-fu" [style.--i]="($index > 6 ? 6 : $index) + 4"
              (click)="openChat(friend)">
              <div class="avatar-wrap">
                <app-friend-avatar [name]="friend.name" [avatar]="friend.avatar" [gender]="friend.gender" [size]="50" />
                <span class="row-dot" [class.online]="chatService.isOnline(friend._id)"></span>
              </div>
              <div class="friend-info">
                <div class="friend-name">{{ friend.name }}</div>
                <div class="friend-status" [class.online]="chatService.isOnline(friend._id)">
                  {{ presenceLabel(friend) }}
                </div>
              </div>
              @if (chatService.unreadFor(friend._id) > 0) {
                <span class="unread-badge">{{ chatService.unreadFor(friend._id) }}</span>
              }
              <button class="assign-btn rm-press" title="Shared tasks & reminders"
                (click)="goToActivity(friend); $event.stopPropagation()">
                <ion-icon name="checkbox-outline"></ion-icon>
                @if (friend.pendingCount > 0) {
                  <span class="assign-badge">{{ friend.pendingCount > 99 ? '99+' : friend.pendingCount }}</span>
                }
              </button>
            </div>
          }
        </div>
      }
      <div class="list-bottom-space"></div>
    </ion-content>

    <!-- ── Add a friend (bottom sheet) ─────────────────────────────────── -->
    @if (showAddPanel()) {
      <div class="sheet-backdrop" (click)="closeAddSheet()"></div>
      <div class="add-sheet">
        <div class="sheet-grip"></div>
        <div class="sheet-title">Add a friend</div>
        <div class="sheet-sub">Enter your friend's Ref ID. They'll get a request to connect with you.</div>
        <div class="sheet-field-label">Friend's Ref ID</div>
        <input
          class="sheet-input"
          type="text"
          placeholder="e.g. RMD-4827"
          autocomplete="off"
          autocapitalize="characters"
          maxlength="16"
          [value]="codeInput()"
          (input)="onCodeInput($event)"
          (keyup.enter)="submitAdd()"
        />
        @if (lookupError()) {
          <div class="sheet-error">{{ lookupError() }}</div>
        }
        <button class="sheet-send" [disabled]="codeInput().length < 4 || sending() !== null" (click)="submitAdd()">
          {{ sending() ? 'Sending...' : 'Send request' }}
        </button>
      </div>
    }

    <!-- ── Full-screen chat ─────────────────────────────────────────────── -->
    @if (activeChat(); as chat) {
      <div class="chat-overlay">
        <div class="chat-head">
          <button class="chat-back" (click)="closeChat()">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </button>
          <div class="avatar-wrap">
            <app-friend-avatar [name]="chat.name" [avatar]="chat.avatar" [gender]="chat.gender" [size]="42" />
            <span class="chat-head-dot" [class.online]="chatService.isOnline(chat._id)"></span>
          </div>
          <div class="chat-head-meta">
            <div class="chat-head-name">{{ chat.name }}</div>
            <div class="chat-head-status">
              @if (chatService.isTyping(chat._id)) {
                <span class="typing-text">typing…</span>
              } @else if (chatService.isOnline(chat._id)) {
                <span class="online-text">Online</span>
              } @else {
                <span class="offline-text">{{ presenceLabel(chat) }}</span>
              }
            </div>
          </div>
          <button class="chat-head-action" title="Shared tasks & reminders"
            (click)="goToActivityFromChat(chat)">
            <ion-icon name="checkbox-outline"></ion-icon>
          </button>
        </div>

        <div class="chat-body" #chatBody>
          <div class="chat-day-pill">Today</div>
          @for (m of chatService.messagesFor(chat._id); track m._id) {
            <div class="bubble-row" [class.mine]="isOwn(m)">
              <div class="bubble" [class.bubble-mine]="isOwn(m)">
                <span class="bubble-text">{{ m.text }}</span>
                <span class="bubble-meta">
                  {{ m.createdAt | date:'shortTime' }}
                  @if (isOwn(m)) {
                    <ion-icon class="tick" [class.tick-read]="m.status === 'read'"
                      [name]="m.status === 'sending' ? 'time-outline'
                            : (m.status === 'sent' ? 'checkmark-outline' : 'checkmark-done-outline')">
                    </ion-icon>
                  }
                </span>
              </div>
            </div>
          } @empty {
            <div class="chat-empty">Say hi to {{ chat.name.split(' ')[0] }} 👋</div>
          }
        </div>

        @if (showChatActions) {
          <div class="chat-quick">
            <button class="chat-qa task" (click)="assignFromChat(chat, 'task')">
              <ion-icon name="create-outline"></ion-icon>
              Send task
            </button>
            <button class="chat-qa reminder" (click)="assignFromChat(chat, 'reminder')">
              <ion-icon name="notifications-outline"></ion-icon>
              Send reminder
            </button>
          </div>
        }

        <div class="chat-input-bar">
          <button class="chat-plus" [class.open]="showChatActions" (click)="showChatActions = !showChatActions">
            <ion-icon [name]="showChatActions ? 'close-outline' : 'add-outline'"></ion-icon>
          </button>
          <input class="chat-input" type="text" placeholder="Message…"
            autocomplete="off"
            [(ngModel)]="draft" (input)="onDraftInput()" (keyup.enter)="send()" />
          <button class="chat-send" [disabled]="!draft.trim()" (click)="send()">
            <ion-icon name="send"></ion-icon>
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .friends-content{--background:var(--rm-bg)}
    ion-toolbar{--background:var(--rm-card);--padding-start:0;--padding-end:0;--padding-top:0;--padding-bottom:0}
    .friends-header-row{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 12px}
    .page-title{font-size:26px;font-weight:800;color:var(--rm-text-primary);letter-spacing:-.3px}
    .btn-add{display:flex;align-items:center;gap:5px;padding:9px 16px;background:var(--rm-purple);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
    .btn-add ion-icon{font-size:17px}

    /* Your Ref ID card */
    .refid-card{display:flex;align-items:center;gap:12px;margin:4px 20px 4px;padding:16px 18px;background:var(--rm-purple-light);border-radius:16px}
    .refid-left{flex:1;min-width:0}
    .refid-label{font-size:11px;font-weight:700;color:var(--rm-purple);text-transform:uppercase;letter-spacing:.6px}
    .refid-value{font-size:22px;font-weight:800;color:var(--rm-text-primary);letter-spacing:1px;margin-top:3px}
    .refid-copy{width:40px;height:40px;border:1.5px solid var(--rm-purple);background:transparent;border-radius:11px;color:var(--rm-purple);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .refid-copy ion-icon{font-size:19px;pointer-events:none}
    .refid-copy:disabled{opacity:.5}

    /* Section labels */
    .section-label{font-size:12px;font-weight:700;color:var(--rm-text-muted);text-transform:uppercase;letter-spacing:.6px;padding:16px 24px 8px}

    /* Card that wraps each list — gives the page its premium feel */
    .list-card{margin:0 16px;background:var(--rm-card);border-radius:18px;box-shadow:var(--rm-shadow-sm);overflow:hidden}
    .list-bottom-space{height:96px}

    /* Avatar + presence dot */
    .avatar-wrap{position:relative;flex-shrink:0}
    .row-dot{position:absolute;bottom:1px;right:1px;width:13px;height:13px;border-radius:50%;border:2.5px solid var(--rm-card);background:var(--rm-border)}
    .row-dot.online{background:#10B981;animation:rmDotPulse 2.4s ease-out infinite}

    /* Requests */
    .req-row{display:flex;align-items:center;gap:12px;padding:12px 14px;transition:background .3s}
    .req-row:not(:last-child){border-bottom:1px solid var(--rm-border)}
    .req-row.highlight{background:var(--rm-purple-light)}
    .req-info{flex:1;min-width:0}
    .req-name{font-size:15px;font-weight:700;color:var(--rm-text-primary)}
    .req-sub{font-size:12.5px;color:var(--rm-text-muted);margin-top:1px}
    .req-accept{width:38px;height:38px;border:none;border-radius:11px;background:var(--rm-success);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .req-decline{width:38px;height:38px;border:1.5px solid var(--rm-border);border-radius:11px;background:var(--rm-card);color:var(--rm-text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .req-accept ion-icon,.req-decline ion-icon{font-size:19px;pointer-events:none}

    /* Friend rows — WhatsApp-style: the row opens the chat */
    .friend-row{display:flex;align-items:center;gap:13px;padding:13px 14px;cursor:pointer;transition:background .2s}
    .friend-row:not(:last-child){border-bottom:1px solid var(--rm-border)}
    .friend-row:active{background:var(--rm-surface)}
    .friend-info{flex:1;min-width:0}
    .friend-name{font-size:16px;font-weight:700;color:var(--rm-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .friend-status{font-size:13px;color:var(--rm-text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .friend-status.online{color:#10B981;font-weight:600}

    /* Unread chat count — green, WhatsApp style */
    .unread-badge{min-width:22px;height:22px;padding:0 6px;background:var(--rm-success);color:#fff;border-radius:11px;font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;animation:rmBadgePop .35s var(--rm-ease-spring)}

    /* Assign button — opens the shared tasks & reminders page */
    .assign-btn{position:relative;width:40px;height:40px;border:none;border-radius:12px;background:var(--rm-purple-light);color:var(--rm-purple);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .assign-btn ion-icon{font-size:20px;pointer-events:none}
    .assign-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;background:var(--rm-warning);color:#fff;border-radius:9px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--rm-card);pointer-events:none}

    /* Skeleton */
    .friend-row-skel{display:flex;align-items:center;gap:12px;padding:13px 14px}
    .skel-avatar{width:50px;height:50px;border-radius:50%;background:var(--rm-surface);flex-shrink:0;animation:pulse 1.5s ease-in-out infinite}
    .skel-lines{flex:1}
    .skel-line{height:12px;border-radius:6px;background:var(--rm-surface);margin-bottom:8px;animation:pulse 1.5s ease-in-out infinite}
    .w60{width:60%}.w30{width:30%}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}

    /* Empty */
    .empty-state{text-align:center;padding:56px 32px}
    .empty-emoji{font-size:60px;margin-bottom:14px}
    .empty-state h3{font-size:18px;font-weight:700;color:var(--rm-text-primary);margin-bottom:8px}
    .empty-state p{font-size:14px;color:var(--rm-text-muted);margin-bottom:22px}
    .btn-empty-add{display:inline-flex;align-items:center;gap:8px;padding:14px 24px;background:var(--rm-purple);color:white;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}

    /* Add-friend sheet */
    .sheet-backdrop{position:fixed;inset:0;background:rgba(15,15,26,.45);backdrop-filter:blur(2px);z-index:900;animation:fade .25s ease}
    @keyframes fade{from{opacity:0}to{opacity:1}}
    .add-sheet{position:fixed;left:0;right:0;bottom:0;z-index:901;background:var(--rm-card);border-radius:24px 24px 0 0;padding:14px 20px calc(env(safe-area-inset-bottom) + 22px);box-shadow:0 -8px 30px rgba(0,0,0,.18);animation:sheetUp .4s var(--rm-ease-out)}
    @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    .sheet-grip{width:40px;height:4px;border-radius:2px;background:var(--rm-border);margin:0 auto 16px}
    .sheet-title{font-size:20px;font-weight:800;color:var(--rm-text-primary)}
    .sheet-sub{font-size:13.5px;color:var(--rm-text-muted);margin-top:6px;line-height:1.45}
    .sheet-field-label{font-size:11px;font-weight:700;color:var(--rm-text-muted);text-transform:uppercase;letter-spacing:.6px;margin:18px 0 8px}
    .sheet-input{width:100%;padding:15px 16px;border:1.5px solid var(--rm-border);border-radius:14px;background:var(--rm-surface);color:var(--rm-text-primary);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;text-transform:uppercase;letter-spacing:1px}
    .sheet-input:focus{border-color:var(--rm-purple)}
    .sheet-error{color:#DC2626;font-size:13px;margin-top:8px}
    .sheet-send{width:100%;margin-top:18px;padding:16px;background:var(--rm-purple);color:#fff;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit}
    .sheet-send:disabled{opacity:.5}

    /* Chat overlay — full-screen, WhatsApp-style */
    .chat-overlay{position:fixed;inset:0;z-index:1000;background:var(--rm-surface);display:flex;flex-direction:column;animation:chatSlideIn .32s var(--rm-ease-out)}
    @keyframes chatSlideIn{from{transform:translateX(100%);opacity:.6}to{transform:translateX(0);opacity:1}}
    .bubble{animation:bubbleIn .28s var(--rm-ease-spring) backwards}
    @keyframes bubbleIn{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
    .chat-head{display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top) + 10px) 14px 10px;background:var(--rm-card);box-shadow:0 1px 8px rgba(0,0,0,.06);flex-shrink:0}
    .chat-back{width:36px;height:36px;border:none;background:transparent;color:var(--rm-text-primary);border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
    .chat-head-dot{position:absolute;bottom:0;right:0;width:11px;height:11px;border-radius:50%;border:2px solid var(--rm-card);background:var(--rm-border)}
    .chat-head-dot.online{background:#10B981}
    .chat-head-meta{flex:1;min-width:0}
    .chat-head-name{font-size:16px;font-weight:800;color:var(--rm-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .chat-head-status{font-size:12.5px;margin-top:1px;height:16px}
    .typing-text{color:var(--rm-purple);font-weight:600}
    .online-text{color:#10B981;font-weight:600}
    .offline-text{color:var(--rm-text-muted)}
    .chat-head-action{width:38px;height:38px;border:none;background:var(--rm-purple-light);color:var(--rm-purple);border-radius:11px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .chat-head-action ion-icon{font-size:19px}
    .chat-body{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:8px}
    .chat-day-pill{align-self:center;background:var(--rm-card);color:var(--rm-text-muted);font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:6px}
    .chat-empty{margin:auto;color:var(--rm-text-muted);font-size:14px;text-align:center}
    .bubble-row{display:flex;justify-content:flex-start}
    .bubble-row.mine{justify-content:flex-end}
    .bubble{max-width:78%;padding:9px 13px 7px;border-radius:16px;background:var(--rm-card);box-shadow:0 1px 2px rgba(0,0,0,.05);border-top-left-radius:6px}
    .bubble-mine{background:linear-gradient(135deg,#4F6BFF,var(--rm-purple));border-top-left-radius:16px;border-top-right-radius:6px;box-shadow:0 2px 8px rgba(61,90,241,.25)}
    .bubble-text{font-size:15px;line-height:1.4;color:var(--rm-text-primary);word-break:break-word;white-space:pre-wrap}
    .bubble-mine .bubble-text{color:#fff}
    .bubble-meta{display:flex;align-items:center;justify-content:flex-end;gap:3px;font-size:10.5px;color:var(--rm-text-muted);margin-top:3px}
    .bubble-mine .bubble-meta{color:rgba(255,255,255,.8)}
    .tick{font-size:14px}
    .tick-read{color:#7DD3FC}
    .chat-quick{display:flex;gap:12px;padding:10px 14px 4px;background:var(--rm-card);flex-shrink:0;animation:quickUp .25s var(--rm-ease-out)}
    @keyframes quickUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .chat-qa{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:13px;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
    .chat-qa ion-icon{font-size:17px}
    .chat-qa.task{background:var(--rm-purple-light);color:var(--rm-purple)}
    .chat-qa.reminder{background:rgba(245,158,11,.14);color:#D97706}
    .chat-input-bar{display:flex;align-items:center;gap:10px;padding:10px 14px calc(env(safe-area-inset-bottom) + 10px);background:var(--rm-card);flex-shrink:0}
    .chat-plus{width:42px;height:42px;border:none;border-radius:50%;background:var(--rm-purple-light);color:var(--rm-purple);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;flex-shrink:0;transition:transform .25s var(--rm-ease-spring),background .2s,color .2s}
    .chat-plus.open{background:var(--rm-purple);color:#fff;transform:rotate(90deg)}
    .chat-input{flex:1;padding:12px 16px;border:none;border-radius:22px;background:var(--rm-surface);color:var(--rm-text-primary);font-size:15px;font-family:inherit;outline:none}
    .chat-send{width:44px;height:44px;border:none;border-radius:50%;background:linear-gradient(135deg,#4F6BFF,var(--rm-purple));color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:19px;flex-shrink:0;box-shadow:0 3px 10px rgba(61,90,241,.35)}
    .chat-send:disabled{opacity:.45;cursor:default;box-shadow:none}
  `],
})
export class FriendsComponent implements OnInit, OnDestroy {
  private friendService = inject(FriendService);
  private socketService = inject(SocketService);
  protected chatService = inject(ChatService);
  private authService   = inject(AuthService);
  private shareService  = inject(ShareService);
  private ui            = inject(UiService);
  private route         = inject(ActivatedRoute);
  protected router      = inject(Router);
  private toastCtrl     = inject(ToastController);
  private alertCtrl     = inject(AlertController);

  isLoading       = signal(true);
  friends         = signal<Friend[]>([]);
  pendingRequests = signal<PendingRequest[]>([]);

  // Replays entrance animations on every tab visit (see .pg-in in global.scss)
  readonly pageIn = signal(true);

  ionViewWillEnter(): void {
    this.pageIn.set(true);
    this.load();   // refresh pending counts when returning from the activity page
    this.initializeSocketListeners();
  }
  ionViewDidLeave(): void {
    this.pageIn.set(false);
    this.socketSub?.unsubscribe();
    // Always return to the friends list when the tab is next opened — close any
    // chat that was left open (and the add sheet) so we never re-show it.
    if (this.activeChat()) this.closeChat();
    this.showAddPanel.set(false);
  }

  // Add-by-code sheet
  showAddPanel  = signal(false);
  codeInput     = signal('');
  lookupError   = signal<string>('');
  sending       = signal<string | null>(null);

  // The signed-in user's own shareable code
  myRefId = () => this.authService.currentUser()?.refId ?? '';

  // A pending request to flash when arriving via a notification tap
  highlightId    = signal<string | null>(null);
  private pendingAcceptId: string | null = null;
  // A chat to open when arriving via a chat-message notification tap
  private pendingChatId: string | null = null;

  // Derived from the auth state so it's always current (fixes own messages
  // rendering on the left when the user was set after the component loaded).
  currentUserId = computed(() => this.authService.currentUser()?._id ?? '');

  // Chat
  @ViewChild('chatBody') private chatBody?: ElementRef<HTMLDivElement>;
  activeChat = signal<Friend | null>(null);
  draft = '';
  showChatActions = false;
  private typingTimer: ReturnType<typeof setTimeout> | undefined;

  private socketSub: Subscription | undefined;
  private querySub: Subscription | undefined;

  constructor() {
    addIcons({ personAddOutline, closeOutline, addOutline, copyOutline,
               chatbubbleEllipsesOutline, arrowBackOutline, send,
               checkmarkOutline, checkmarkDoneOutline, timeOutline,
               createOutline, notificationsOutline, checkboxOutline });

    // Auto-scroll the chat to the newest message whenever it changes.
    effect(() => {
      const chat = this.activeChat();
      if (!chat) return;
      this.chatService.messagesFor(chat._id);   // track message changes
      this.chatService.isTyping(chat._id);       // keep view pinned when typing shows
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  ngOnInit() {
    this.load();

    // Arriving from a notification tap:
    //   ?accept=<friendshipId> → flash + prompt to accept the request
    //   ?chat=<friendId>       → open that conversation
    this.querySub = this.route.queryParams.subscribe(params => {
      const acceptId = params['accept'];
      const chatId   = params['chat'];
      if (acceptId) {
        this.pendingAcceptId = acceptId;
        this.maybePromptAccept();
      }
      if (chatId) {
        this.pendingChatId = chatId;
        this.maybeOpenPendingChat();
      }
      if (acceptId || chatId) {
        // Clear the params so a refresh doesn't re-trigger.
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });

    this.initializeSocketListeners();
  }

  private initializeSocketListeners(): void {
    // Reload when a new friend request arrives while this tab is open
    this.socketSub?.unsubscribe();
    this.socketSub = this.socketService.on<{ type: string }>('notification:new').pipe(
      filter(n => n.type === 'friend_request' || n.type === 'friend_accepted')
    ).subscribe(() => this.load());
  }

  ngOnDestroy() {
    this.querySub?.unsubscribe();
    this.socketSub?.unsubscribe();
  }

  private load() {
    this.friendService.getFriends().subscribe({
      next: ({ friends, pending }) => {
        this.friends.set(friends);
        this.pendingRequests.set(pending);
        this.isLoading.set(false);
        this.maybePromptAccept();
        this.maybeOpenPendingChat();
      },
      error: () => this.isLoading.set(false),
    });
  }

  // If we arrived via a chat notification and that friend is loaded, open it.
  private maybeOpenPendingChat(): void {
    const id = this.pendingChatId;
    if (!id) return;
    const friend = this.friends().find(f => f._id === id);
    if (!friend) return;       // not loaded yet — load() will retry
    this.pendingChatId = null;
    this.openChat(friend);
  }

  // If we arrived via a notification and the matching request is loaded, prompt.
  private async maybePromptAccept(): Promise<void> {
    const id = this.pendingAcceptId;
    if (!id) return;
    const req = this.pendingRequests().find(r => r._id === id);
    if (!req) return;          // not loaded yet — load() will retry
    this.pendingAcceptId = null;

    this.highlightId.set(id);
    setTimeout(() => this.highlightId.set(null), 3000);

    const alert = await this.alertCtrl.create({
      header: 'Friend Request',
      message: `${req.name} wants to be your accountability buddy. Accept?`,
      buttons: [
        { text: 'Later', role: 'cancel' },
        { text: 'Decline', role: 'destructive', handler: () => this.reject(id) },
        { text: 'Accept', handler: () => this.accept(id) },
      ],
    });
    await alert.present();
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

  /** "Online" / "Last seen 2h ago" / "Offline" for a friend row. */
  presenceLabel(friend: Friend): string {
    if (this.chatService.isOnline(friend._id)) return 'Online';
    const iso = friend.lastSeenAt;
    if (!iso) return 'Offline';
    const seen = new Date(iso);
    const mins = Math.floor((Date.now() - seen.getTime()) / 60000);
    if (mins < 1)   return 'Last seen just now';
    if (mins < 60)  return `Last seen ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Last seen ${hours}h ago`;
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    if (seen.toDateString() === yest.toDateString()) return 'Last seen yesterday';
    return `Last seen ${seen.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }

  goToActivity(friend: Friend): void {
    this.router.navigate(['/app/friends', friend._id, 'activity']);
  }

  // ── Add-friend sheet ────────────────────────────────────────────────────
  openAddSheet() {
    this.showAddPanel.set(true);
    this.codeInput.set('');
    this.lookupError.set('');
    this.sending.set(null);
    setTimeout(() => {
      (document.querySelector('.sheet-input') as HTMLInputElement)?.focus();
    }, 120);
  }

  closeAddSheet() {
    this.showAddPanel.set(false);
  }

  onCodeInput(event: Event) {
    // Normalise as the user types: uppercase, keep A–Z / 0–9 and dashes.
    const cleaned = (event.target as HTMLInputElement).value
      .toUpperCase().replace(/[^A-Z0-9-]/g, '');
    this.codeInput.set(cleaned);
    this.lookupError.set('');
  }

  submitAdd() {
    const code = this.codeInput().trim();
    if (code.length < 4 || this.sending() !== null) return;
    this.sending.set('sheet');
    this.lookupError.set('');
    this.friendService.sendRequest(code).subscribe({
      next: async () => {
        this.sending.set(null);
        this.closeAddSheet();
        const toast = await this.toastCtrl.create({
          message: 'Friend request sent!',
          duration: 2500, color: 'success', position: 'top',
        });
        toast.present();
        this.load();
      },
      error: async (err) => {
        this.sending.set(null);
        this.lookupError.set(err?.error?.message || 'Could not send request. Check the Ref ID.');
      },
    });
  }

  async copyMyCode() {
    const code = this.myRefId();
    if (!code) return;
    try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
    const t = await this.toastCtrl.create({
      message: 'Ref ID copied!', duration: 1800, color: 'success', position: 'top',
    });
    t.present();
  }

  async shareMyCode() {
    const code = this.myRefId();
    if (!code) return;
    const outcome = await this.shareService.shareRefId(code);
    if (outcome === 'failed') return;
    const t = await this.toastCtrl.create({
      message: outcome === 'copied' ? 'Invite copied to clipboard!' : 'Thanks for sharing!',
      duration: 1800, color: 'success', position: 'top',
    });
    t.present();
  }

  accept(id: string) { this.friendService.accept(id).subscribe(() => this.load()); }
  reject(id: string) { this.friendService.reject(id).subscribe(() => this.load()); }

  // ── Chat ──────────────────────────────────────────────────────────────
  openChat(friend: Friend): void {
    this.draft = '';
    this.showChatActions = false;
    this.activeChat.set(friend);
    this.ui.overlayOpen.set(true);   // hide the bottom tab bar behind the chat
    this.chatService.openChat(friend._id);
    setTimeout(() => this.scrollToBottom(), 80);
  }

  closeChat(): void {
    const chat = this.activeChat();
    if (chat) this.chatService.setTyping(chat._id, false);
    clearTimeout(this.typingTimer);
    this.showChatActions = false;
    this.chatService.closeChat();
    this.activeChat.set(null);
    this.ui.overlayOpen.set(false);  // restore the bottom tab bar
  }

  send(): void {
    const chat = this.activeChat();
    if (!chat || !this.draft.trim()) return;
    this.chatService.sendMessage(chat._id, this.draft);
    this.draft = '';
    this.showChatActions = false;
    this.chatService.setTyping(chat._id, false);
    clearTimeout(this.typingTimer);
    setTimeout(() => this.scrollToBottom(), 50);
  }

  /** Header button in chat → the friend's shared activity page. */
  goToActivityFromChat(friend: Friend): void {
    this.closeChat();
    this.router.navigate(['/app/friends', friend._id, 'activity']);
  }

  /** Chat quick actions → activity page with the assign sheet pre-opened. */
  assignFromChat(friend: Friend, kind: 'task' | 'reminder'): void {
    this.closeChat();
    this.router.navigate(['/app/friends', friend._id, 'activity'], {
      queryParams: { assign: kind },
    });
  }

  onDraftInput(): void {
    const chat = this.activeChat();
    if (!chat) return;
    this.chatService.setTyping(chat._id, true);
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.chatService.setTyping(chat._id, false), 1500);
  }

  isOwn(m: ChatMessage): boolean {
    return m.sender === this.currentUserId();
  }

  private scrollToBottom(): void {
    const el = this.chatBody?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
