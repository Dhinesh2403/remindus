// src/app/friends/friends.component.ts
import { Component, inject, OnInit, OnDestroy, signal, effect, ViewChild, ElementRef } from '@angular/core';
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
  personAddOutline, personRemoveOutline, closeOutline, searchOutline,
  addOutline, addCircleOutline, chevronDownOutline, chevronUpOutline,
  shareSocialOutline, copyOutline, keyOutline, checkmarkCircle,
  chatbubbleEllipsesOutline, arrowBackOutline, send,
  checkmarkOutline, checkmarkDoneOutline, timeOutline,
  createOutline, cubeOutline, notificationsOutline,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { FriendService, Friend, PendingRequest, RefIdLookup, FriendRelationship, SharedReminder, SharedStatus } from '../core/services/friend.service';
import { TimeAmPmPipe } from '../core/pipes/time-ampm.pipe';
import { SocketService } from '../core/services/socket.service';
import { ChatService, ChatMessage } from '../core/services/chat.service';
import { AuthService } from '../core/services/auth.service';
import { ShareService } from '../core/services/share.service';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TimeAmPmPipe,
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
        <div class="req-list">
          @for (req of pendingRequests(); track req._id) {
            <div class="req-row a-fu" [style.--i]="$index + 3" [class.highlight]="highlightId() === req._id">
              <div class="row-avatar" [style.background]="avatarColor(req.name)">
                @if (req.avatar) {
                  <img [src]="req.avatar" [alt]="req.name" />
                } @else {
                  {{ getInitials(req.name) }}
                }
              </div>
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
        @for (i of [1,2,3]; track i) {
          <div class="friend-row-skel">
            <div class="skel-avatar"></div>
            <div class="skel-lines">
              <div class="skel-line w60"></div>
              <div class="skel-line w30"></div>
            </div>
          </div>
        }
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
        <div class="friend-list">
          @for (friend of friends(); track friend._id) {
            <div class="friend-entry a-fu" [style.--i]="($index > 6 ? 6 : $index) + 4">
              <div class="friend-row" (click)="openChat(friend)">
                <div class="row-avatar" [style.background]="avatarColor(friend.name)">
                  @if (friend.avatar) {
                    <img [src]="friend.avatar" [alt]="friend.name" />
                  } @else {
                    {{ getInitials(friend.name) }}
                  }
                  <span class="row-dot" [class.online]="chatService.isOnline(friend._id)"></span>
                </div>
                <div class="friend-info">
                  <div class="friend-name">{{ friend.name }}</div>
                  <div class="friend-status" [class.online]="chatService.isOnline(friend._id)">
                    {{ chatService.isOnline(friend._id) ? 'Online' : 'Offline' }}
                  </div>
                </div>
                <button class="row-icon blue" title="Assign reminder"
                  (click)="toggleReminderForm(friend._id); $event.stopPropagation()">
                  <ion-icon name="create-outline"></ion-icon>
                </button>
                <button class="row-icon green" title="Shared activity"
                  (click)="toggleShared(friend._id); $event.stopPropagation()">
                  <ion-icon name="cube-outline"></ion-icon>
                </button>
                <div class="row-end">
                  @if (lastMsgLabel(friend._id); as t) {
                    <div class="row-time">{{ t }}</div>
                  }
                  @if (chatService.unreadFor(friend._id) > 0) {
                    <span class="row-badge">{{ chatService.unreadFor(friend._id) }}</span>
                  }
                </div>
              </div>

              <!-- Assign reminder (blue icon) -->
              @if (openFormId() === friend._id) {
                <div class="reminder-form">
                  <input class="rf-input" type="text" placeholder="Reminder title..."
                    [(ngModel)]="reminderForm.title" />
                  <div class="rf-row">
                    <input class="rf-input rf-half" type="date" [(ngModel)]="reminderForm.date" />
                    <input class="rf-input rf-half" type="time" [(ngModel)]="reminderForm.time" />
                  </div>
                  <div class="rf-priority-row">
                    @for (p of priorities; track p.value) {
                      <button class="rf-priority"
                        [class.active]="reminderForm.priority === p.value"
                        (click)="reminderForm.priority = p.value">
                        {{ p.label }}
                      </button>
                    }
                  </div>
                  <button class="btn-rf-send" [disabled]="sendingReminder()"
                    (click)="submitReminder(friend)">
                    {{ sendingReminder() ? 'Sending...' : 'Send to ' + friend.name.split(' ')[0] }}
                  </button>
                </div>
              }

              <!-- Shared activity (green icon) -->
              @if (openSharedId() === friend._id) {
                <div class="shared-panel">
                  <div class="shared-list-title">Shared Reminders</div>
                  @if (sharedFor(friend._id).length) {
                    @for (r of sharedFor(friend._id); track r._id) {
                      <div class="shared-item">
                        <div class="shared-row">
                          <div class="shared-info">
                            <div class="shared-title">{{ r.title }}</div>
                            <div class="shared-date">{{ r.date | date:'MMM d' }} · {{ r.time | timeAmPm }}</div>
                          </div>
                          <span class="status-badge" [class]="'status-' + (r.sharedStatus || 'sent')">
                            {{ statusLabel(r.sharedStatus) }}
                          </span>
                        </div>

                        @if (r.assignedTo === currentUserId() && r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped') {
                          <div class="action-row">
                            <button class="act-btn act-start" (click)="onStatusChange(r, 'processing')">▶ Start</button>
                            <button class="act-btn act-done" (click)="onStatusChange(r, 'completed')">✅ Done</button>
                            <button class="act-btn act-snooze" (click)="snooze(r, 10)">⏰ 10 min</button>
                            <button class="act-btn act-snooze" (click)="snooze(r, 60)">⏰ 1 hr</button>
                            <button class="act-btn act-skip" (click)="onStatusChange(r, 'skipped')">⏭ Skip</button>
                          </div>
                        }
                      </div>
                    }
                  } @else {
                    <div class="shared-empty">Nothing shared with {{ friend.name.split(' ')[0] }} yet.</div>
                  }
                  <button class="btn-remove-friend" (click)="confirmUnfriend(friend)">
                    <ion-icon name="person-remove-outline"></ion-icon>
                    Remove friend
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }
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
          <div class="chat-head-avatar" [style.background]="avatarColor(chat.name)">
            {{ getInitials(chat.name) }}
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
                <span class="offline-text">Offline</span>
              }
            </div>
          </div>
          <button class="chat-head-action" title="Shared activity"
            (click)="router.navigate(['/app/friends', chat._id, 'activity'])">
            <ion-icon name="cube-outline"></ion-icon>
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
            <button class="chat-qa task" (click)="sendTaskFromChat()">
              <ion-icon name="create-outline"></ion-icon>
              Send task
            </button>
            <button class="chat-qa reminder" (click)="sendReminderFromChat()">
              <ion-icon name="notifications-outline"></ion-icon>
              Send reminder
            </button>
          </div>
        }

        <div class="chat-input-bar">
          <button class="chat-plus" (click)="showChatActions = !showChatActions">
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
    .friends-header-row{display:flex;align-items:center;justify-content:space-between;padding:18px 16px 12px}
    .page-title{font-size:26px;font-weight:800;color:var(--rm-text-primary);letter-spacing:-.3px}
    .btn-add{display:flex;align-items:center;gap:5px;padding:9px 16px;background:var(--rm-purple);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
    .btn-add ion-icon{font-size:17px}

    /* Your Ref ID card */
    .refid-card{display:flex;align-items:center;gap:12px;margin:4px 16px 4px;padding:16px 18px;background:var(--rm-purple-light);border-radius:16px}
    .refid-left{flex:1;min-width:0}
    .refid-label{font-size:11px;font-weight:700;color:var(--rm-purple);text-transform:uppercase;letter-spacing:.6px}
    .refid-value{font-size:22px;font-weight:800;color:var(--rm-text-primary);letter-spacing:1px;margin-top:3px}
    .refid-copy{width:40px;height:40px;border:1.5px solid var(--rm-purple);background:transparent;border-radius:11px;color:var(--rm-purple);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .refid-copy ion-icon{font-size:19px;pointer-events:none}
    .refid-copy:disabled{opacity:.5}

    /* Section labels */
    .section-label{font-size:12px;font-weight:700;color:var(--rm-text-muted);text-transform:uppercase;letter-spacing:.6px;padding:16px 20px 6px}

    /* Shared avatar */
    .row-avatar{position:relative;width:48px;height:48px;border-radius:50%;color:#fff;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
    .row-avatar img{width:100%;height:100%;object-fit:cover}
    .row-dot{position:absolute;bottom:1px;right:1px;width:12px;height:12px;border-radius:50%;border:2.5px solid var(--rm-card);background:var(--rm-border)}
    .row-dot.online{background:#10B981;animation:rmDotPulse 2.4s ease-out infinite}

    /* Requests */
    .req-list{padding:0 8px}
    .req-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;transition:background .3s}
    .req-row.highlight{background:var(--rm-purple-light)}
    .req-info{flex:1;min-width:0}
    .req-name{font-size:15px;font-weight:700;color:var(--rm-text-primary)}
    .req-sub{font-size:12.5px;color:var(--rm-text-muted);margin-top:1px}
    .req-accept{width:38px;height:38px;border:none;border-radius:11px;background:var(--rm-green);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .req-decline{width:38px;height:38px;border:1.5px solid var(--rm-border);border-radius:11px;background:var(--rm-card);color:var(--rm-text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .req-accept ion-icon,.req-decline ion-icon{font-size:19px;pointer-events:none}

    /* Friend rows */
    .friend-list{padding:0 8px 96px}
    .friend-row{display:flex;align-items:center;gap:12px;padding:12px;cursor:pointer;border-radius:14px;transition:background .2s,transform .2s var(--rm-ease-spring)}
    .friend-row:active{background:var(--rm-surface);transform:scale(.985)}
    .friend-info{flex:1;min-width:0}
    .friend-name{font-size:16px;font-weight:700;color:var(--rm-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .friend-status{font-size:13px;color:var(--rm-text-muted);margin-top:1px}
    .friend-status.online{color:#10B981;font-weight:600}
    .row-icon{width:36px;height:36px;border:none;border-radius:11px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .row-icon ion-icon{font-size:18px;pointer-events:none}
    .row-icon.blue{background:var(--rm-purple-light);color:var(--rm-purple)}
    .row-icon.green{background:rgba(16,185,129,.12);color:#0f9d63}
    .row-end{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
    .row-time{font-size:11px;color:var(--rm-text-muted);white-space:nowrap}
    .row-badge{min-width:20px;height:20px;padding:0 6px;background:var(--rm-green);color:#fff;border-radius:10px;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;animation:rmBadgePop .35s var(--rm-ease-spring)}

    /* Skeleton */
    .friend-row-skel{display:flex;align-items:center;gap:12px;padding:12px 20px}
    .skel-avatar{width:48px;height:48px;border-radius:50%;background:var(--rm-surface);flex-shrink:0;animation:pulse 1.5s ease-in-out infinite}
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

    /* Assign reminder form */
    .reminder-form{margin:2px 12px 10px;display:flex;flex-direction:column;gap:8px;padding:14px;background:var(--rm-surface);border-radius:14px;border:1.5px solid var(--rm-border)}
    .rf-input{width:100%;padding:10px 12px;border:1.5px solid var(--rm-border);border-radius:10px;background:var(--rm-card);color:var(--rm-text-primary);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box}
    .rf-input:focus{border-color:var(--rm-purple)}
    .rf-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .rf-priority-row{display:flex;gap:6px;flex-wrap:wrap}
    .rf-priority{padding:6px 12px;border:1.5px solid var(--rm-border);border-radius:8px;background:var(--rm-card);color:var(--rm-text-secondary);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
    .rf-priority.active{border-color:var(--rm-purple);background:var(--rm-purple-light);color:var(--rm-purple)}
    .btn-rf-send{padding:12px;background:var(--rm-purple);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
    .btn-rf-send:disabled{opacity:.6;cursor:default}

    /* Shared panel */
    .shared-panel{margin:2px 12px 10px;display:flex;flex-direction:column;gap:10px;padding:14px;background:var(--rm-surface);border-radius:14px;border:1.5px solid var(--rm-border)}
    .shared-list-title{font-size:11px;font-weight:700;color:var(--rm-text-muted);text-transform:uppercase;letter-spacing:.5px}
    .shared-empty{font-size:13px;color:var(--rm-text-muted);text-align:center;padding:6px 0}
    .shared-item{display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--rm-card);border-radius:12px}
    .shared-row{display:flex;align-items:center;gap:8px}
    .shared-info{flex:1;min-width:0}
    .shared-title{font-size:13px;font-weight:600;color:var(--rm-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .shared-date{font-size:11px;color:var(--rm-text-muted);margin-top:1px}
    .status-badge{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0}
    .status-sent{background:rgba(234,179,8,0.15);color:#B45309}
    .status-received{background:rgba(59,130,246,0.15);color:#1D4ED8}
    .status-acknowledged{background:rgba(61,90,241,0.15);color:var(--rm-purple)}
    .status-processing{background:rgba(234,88,12,0.15);color:#C2410C}
    .status-skipped{background:rgba(107,114,128,0.15);color:#6B7280}
    .status-completed{background:rgba(16,185,129,0.15);color:#047857}
    .action-row{display:flex;gap:6px;flex-wrap:wrap}
    .act-btn{padding:6px 10px;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
    .act-start{background:rgba(61,90,241,0.12);color:var(--rm-purple)}
    .act-done{background:rgba(16,185,129,0.12);color:#047857}
    .act-snooze{background:rgba(234,179,8,0.12);color:#B45309}
    .act-skip{background:rgba(107,114,128,0.12);color:#6B7280}
    .btn-remove-friend{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:11px;background:rgba(239,68,68,0.08);color:#EF4444;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
    .btn-remove-friend ion-icon{font-size:16px}

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

    /* Chat overlay */
    .chat-overlay{position:fixed;inset:0;z-index:1000;background:var(--rm-bg);display:flex;flex-direction:column;animation:chatSlideIn .32s var(--rm-ease-out)}
    @keyframes chatSlideIn{from{transform:translateX(100%);opacity:.6}to{transform:translateX(0);opacity:1}}
    .bubble{animation:bubbleIn .28s var(--rm-ease-spring) backwards}
    @keyframes bubbleIn{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
    .chat-head{display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top) + 10px) 14px 10px;background:var(--rm-card);box-shadow:0 1px 6px rgba(0,0,0,.05);flex-shrink:0}
    .chat-back{width:36px;height:36px;border:none;background:transparent;color:var(--rm-text-primary);border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
    .chat-head-avatar{position:relative;width:42px;height:42px;border-radius:50%;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
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
    .bubble{max-width:78%;padding:9px 13px 7px;border-radius:16px;background:var(--rm-card);box-shadow:0 1px 2px rgba(0,0,0,.06);border-top-left-radius:6px}
    .bubble-mine{background:var(--rm-purple);border-top-left-radius:16px;border-top-right-radius:6px}
    .bubble-text{font-size:15px;line-height:1.4;color:var(--rm-text-primary);word-break:break-word;white-space:pre-wrap}
    .bubble-mine .bubble-text{color:#fff}
    .bubble-meta{display:flex;align-items:center;justify-content:flex-end;gap:3px;font-size:10.5px;color:var(--rm-text-muted);margin-top:3px}
    .bubble-mine .bubble-meta{color:rgba(255,255,255,.8)}
    .tick{font-size:14px}
    .tick-read{color:#7DD3FC}
    .chat-quick{display:flex;gap:12px;padding:10px 14px 4px;background:var(--rm-card);flex-shrink:0}
    .chat-qa{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:13px;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
    .chat-qa ion-icon{font-size:17px}
    .chat-qa.task{background:var(--rm-purple-light);color:var(--rm-purple)}
    .chat-qa.reminder{background:rgba(245,158,11,.14);color:#D97706}
    .chat-input-bar{display:flex;align-items:center;gap:10px;padding:10px 14px calc(env(safe-area-inset-bottom) + 10px);background:var(--rm-card);flex-shrink:0}
    .chat-plus{width:42px;height:42px;border:none;border-radius:50%;background:var(--rm-purple);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;flex-shrink:0}
    .chat-input{flex:1;padding:12px 16px;border:none;border-radius:22px;background:var(--rm-surface);color:var(--rm-text-primary);font-size:15px;font-family:inherit;outline:none}
    .chat-send{width:44px;height:44px;border:none;border-radius:50%;background:var(--rm-purple);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:19px;flex-shrink:0}
    .chat-send:disabled{opacity:.45;cursor:default}
  `],
})
export class FriendsComponent implements OnInit, OnDestroy {
  private friendService = inject(FriendService);
  private socketService = inject(SocketService);
  protected chatService = inject(ChatService);
  private authService   = inject(AuthService);
  private shareService  = inject(ShareService);
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
    this.initializeSocketListeners();
  }
  ionViewDidLeave(): void {
    this.pageIn.set(false);
    this.socketSub?.unsubscribe();
    this.socketSub2?.unsubscribe();
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

  // Assign reminder / shared activity
  openFormId      = signal<string | null>(null);
  openSharedId    = signal<string | null>(null);
  sendingReminder = signal(false);
  sharedReminders = signal<Record<string, SharedReminder[]>>({});
  currentUserId   = signal<string>('');
  reminderForm    = { title: '', date: this.todayStr(), time: '09:00', priority: 'medium' };
  priorities      = [
    { value: 'low', label: '🟢 Low' },
    { value: 'medium', label: '🟡 Medium' },
    { value: 'high', label: '🔴 High' },
    { value: 'urgent', label: '🚨 Urgent' },
  ];

  // Chat
  @ViewChild('chatBody') private chatBody?: ElementRef<HTMLDivElement>;
  activeChat = signal<Friend | null>(null);
  draft = '';
  showChatActions = false;
  private typingTimer: ReturnType<typeof setTimeout> | undefined;

  private socketSub: Subscription | undefined;
  private socketSub2: Subscription | undefined;
  private querySub: Subscription | undefined;

  // Deterministic avatar colour per name
  private readonly avatarPalette = ['#D84F7A', '#2F7FD8', '#7A5CD8', '#E07A2F', '#2E9E6A', '#D89B2F', '#C7506B', '#3D5AF1'];

  constructor() {
    addIcons({ personAddOutline, personRemoveOutline, closeOutline, searchOutline,
               addOutline, addCircleOutline, chevronDownOutline, chevronUpOutline,
               shareSocialOutline, copyOutline, keyOutline, checkmarkCircle,
               chatbubbleEllipsesOutline, arrowBackOutline, send,
               checkmarkOutline, checkmarkDoneOutline, timeOutline,
               createOutline, cubeOutline, notificationsOutline });

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
    const uid = this.authService.currentUser()?._id;
    if (uid) this.currentUserId.set(uid);
    this.load();

    // Arriving from a "friend request" notification tap → flash + prompt accept.
    this.querySub = this.route.queryParams.subscribe(params => {
      const acceptId = params['accept'];
      if (acceptId) {
        this.pendingAcceptId = acceptId;
        this.maybePromptAccept();
        // Clear the param so a refresh doesn't re-trigger the prompt.
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });

    this.initializeSocketListeners();
  }

  private initializeSocketListeners(): void {
    // Reload when a new friend request arrives while this tab is open
    this.socketSub = this.socketService.on<{ type: string }>('notification:new').pipe(
      filter(n => n.type === 'friend_request' || n.type === 'friend_accepted')
    ).subscribe(() => this.load());

    // Update shared reminder status in real-time when a friend changes it
    this.socketSub2 = this.socketService
      .on<{ _id: string; sharedStatus: string }>('reminder:sharedStatus')
      .subscribe(({ _id, sharedStatus }) => {
        this.sharedReminders.update(prev => {
          const next = { ...prev };
          for (const friendId of Object.keys(next)) {
            next[friendId] = next[friendId].map(r =>
              r._id === _id ? { ...r, sharedStatus: sharedStatus as SharedStatus } : r
            );
          }
          return next;
        });
      });
  }

  ngOnDestroy() {
    this.querySub?.unsubscribe();
    this.socketSub?.unsubscribe();
    this.socketSub2?.unsubscribe();
  }

  private load() {
    this.isLoading.set(true);
    this.friendService.getFriends().subscribe({
      next: ({ friends, pending }) => {
        this.friends.set(friends);
        this.pendingRequests.set(pending);
        this.isLoading.set(false);
        this.maybePromptAccept();
      },
      error: () => this.isLoading.set(false),
    });
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

  relationshipLabel(rel: FriendRelationship): string {
    switch (rel) {
      case 'friends':          return 'Already your buddy';
      case 'request_sent':     return 'Request already sent';
      case 'request_received': return 'They already requested you';
      default:                 return 'Send a buddy request';
    }
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

  async confirmUnfriend(friend: Friend): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Remove friend',
      message: `Remove ${friend.name} from your accountability buddies?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: () => {
            this.friendService.remove(friend.friendshipId).subscribe({
              next: async () => {
                this.openSharedId.set(null);
                this.load();
                const toast = await this.toastCtrl.create({
                  message: `${friend.name} removed from friends`,
                  duration: 2500, color: 'medium', position: 'top',
                });
                toast.present();
              },
            });
          },
        },
      ],
    });
    await alert.present();
  }

  toggleReminderForm(friendId: string): void {
    if (this.openFormId() === friendId) {
      this.openFormId.set(null);
    } else {
      this.openFormId.set(friendId);
      this.openSharedId.set(null);
      this.reminderForm = { title: '', date: this.todayStr(), time: this.nowTimeStr(), priority: 'medium' };
    }
  }

  toggleShared(friendId: string): void {
    if (this.openSharedId() === friendId) {
      this.openSharedId.set(null);
    } else {
      this.openSharedId.set(friendId);
      this.openFormId.set(null);
      if (!this.sharedReminders()[friendId]) this.loadSharedReminders(friendId);
    }
  }

  sharedFor(friendId: string): SharedReminder[] {
    return this.sharedReminders()[friendId] ?? [];
  }

  private loadSharedReminders(friendId: string): void {
    this.friendService.getSharedReminders(friendId).subscribe({
      next: ({ data }) => {
        this.sharedReminders.update(prev => ({ ...prev, [friendId]: data }));
      },
    });
  }

  async submitReminder(friend: Friend): Promise<void> {
    if (!this.reminderForm.title.trim()) {
      const t = await this.toastCtrl.create({ message: 'Please enter a title', duration: 2000, color: 'warning', position: 'top' });
      t.present(); return;
    }
    this.sendingReminder.set(true);
    this.friendService.sendReminder(friend._id, this.reminderForm).subscribe({
      next: async () => {
        this.sendingReminder.set(false);
        this.openFormId.set(null);
        this.loadSharedReminders(friend._id);
        this.load();
        const t = await this.toastCtrl.create({ message: `Reminder sent to ${friend.name}!`, duration: 2500, color: 'success', position: 'top' });
        t.present();
      },
      error: async () => {
        this.sendingReminder.set(false);
        const t = await this.toastCtrl.create({ message: 'Failed to send reminder', duration: 2500, color: 'danger', position: 'top' });
        t.present();
      },
    });
  }

  onStatusChange(reminder: SharedReminder, status: SharedStatus): void {
    this.friendService.updateSharedStatus(reminder._id, status).subscribe({
      next: () => { reminder.sharedStatus = status; },
    });
  }

  snooze(reminder: SharedReminder, minutes: number): void {
    this.friendService.snoozeAssigned(reminder._id, minutes).subscribe({
      next: async () => {
        const label = minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`;
        const t = await this.toastCtrl.create({
          message: `Snoozed for ${label}`, duration: 2000, color: 'warning', position: 'top',
        });
        t.present();
      },
    });
  }

  statusLabel(status: SharedStatus | null): string {
    const map: Record<string, string> = {
      sent:         '📤 Sent',
      received:     '📬 Received',
      acknowledged: '👀 Acknowledged',
      processing:   '🔄 In Progress',
      skipped:      '⏭ Skipped',
      completed:    '✅ Completed',
    };
    return map[status ?? 'sent'] ?? '📤 Sent';
  }

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private nowTimeStr(): string {
    const d = new Date(); d.setHours(d.getHours() + 1, 0);
    return `${String(d.getHours()).padStart(2,'0')}:00`;
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  avatarColor(name: string): string {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return this.avatarPalette[h % this.avatarPalette.length];
  }

  /** Timestamp of the last message with a friend, for the list row. */
  lastMsgLabel(friendId: string): string {
    const conv = this.chatService.conversations().find(c => c.friendId === friendId);
    const iso = conv?.lastMessage?.createdAt;
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // ── Chat ──────────────────────────────────────────────────────────────
  openChat(friend: Friend): void {
    this.draft = '';
    this.showChatActions = false;
    this.activeChat.set(friend);
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

  /** Chat quick action → jump to the assign-reminder form for this friend. */
  sendReminderFromChat(): void {
    const chat = this.activeChat();
    if (!chat) return;
    this.showChatActions = false;
    this.closeChat();
    this.openFormId.set(chat._id);
    this.openSharedId.set(null);
    this.reminderForm = { title: '', date: this.todayStr(), time: this.nowTimeStr(), priority: 'medium' };
    setTimeout(() => {
      document.querySelector('.reminder-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
  }

  async sendTaskFromChat(): Promise<void> {
    this.showChatActions = false;
    const t = await this.toastCtrl.create({
      message: 'Sharing tasks in chat is coming soon', duration: 2200, color: 'medium', position: 'top',
    });
    t.present();
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
