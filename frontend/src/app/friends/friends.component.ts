// src/app/friends/friends.component.ts
import { Component, inject, OnInit, OnDestroy, signal, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar,
  IonIcon, IonRefresher, IonRefresherContent,
  IonSearchbar, IonSkeletonText,
  ToastController, AlertController,
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  personAddOutline, personRemoveOutline, closeOutline, searchOutline,
  addCircleOutline, chevronDownOutline, chevronUpOutline,
  shareSocialOutline, copyOutline, keyOutline, checkmarkCircle,
  chatbubbleEllipsesOutline, arrowBackOutline, send,
  checkmarkOutline, checkmarkDoneOutline, timeOutline,
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

      <!-- Your shareable friend code -->
      <div class="mycode-card">
        <div class="mycode-left">
          <div class="mycode-label">Your friend code</div>
          <div class="mycode-value">{{ myRefId() || '••••••••' }}</div>
        </div>
        <button class="btn-copy" (click)="copyMyCode()" [disabled]="!myRefId()" title="Copy">
          <ion-icon name="copy-outline"></ion-icon>
        </button>
        <button class="btn-share" (click)="shareMyCode()" [disabled]="!myRefId()">
          <ion-icon name="share-social-outline"></ion-icon>
          Share
        </button>
      </div>

      @if (showAddPanel()) {
        <div class="add-panel">
          <div class="add-panel-header">
            <ion-icon name="key-outline" class="panel-icon"></ion-icon>
            <span class="panel-title">Add by Friend Code</span>
            <button class="btn-close-panel" (click)="closeAddPanel()">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>

          <div class="code-entry-row">
            <input
              class="friend-search-input code-input"
              type="text"
              placeholder="e.g. K7P2X9Q4"
              autocomplete="off"
              autocapitalize="characters"
              maxlength="12"
              [value]="codeInput()"
              (input)="onCodeInput($event)"
              (keyup.enter)="lookup()"
            />
            <button class="btn-lookup" [disabled]="codeInput().length < 6 || isLookingUp()" (click)="lookup()">
              {{ isLookingUp() ? '...' : 'Find' }}
            </button>
          </div>

          @if (lookupError()) {
            <div class="panel-hint error-hint">{{ lookupError() }}</div>
          }

          @if (lookupResult(); as r) {
            <div class="preview-card">
              <div class="preview-avatar">
                @if (r.user.avatar) {
                  <img [src]="r.user.avatar" [alt]="r.user.name" />
                } @else {
                  {{ r.user.name[0].toUpperCase() }}
                }
              </div>
              <div class="preview-info">
                <div class="preview-name">{{ r.user.name }}</div>
                <div class="preview-sub">{{ relationshipLabel(r.relationship) }}</div>
              </div>
              @switch (r.relationship) {
                @case ('none') {
                  <button class="btn-add-user" [disabled]="sending() === r.user._id" (click)="sendRequest(r)">
                    {{ sending() === r.user._id ? '...' : 'Send Request' }}
                  </button>
                }
                @case ('friends') {
                  <span class="rel-pill rel-ok"><ion-icon name="checkmark-circle"></ion-icon> Friends</span>
                }
                @case ('request_sent') {
                  <span class="rel-pill">Requested</span>
                }
                @case ('request_received') {
                  <span class="rel-pill rel-action">Check requests below</span>
                }
              }
            </div>
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
            <div class="request-row" [class.highlight]="highlightId() === req._id">
              <div class="req-avatar">
                @if (req.avatar) {
                  <img [src]="req.avatar" [alt]="req.name" />
                } @else {
                  {{ req.name[0] }}
                }
              </div>
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

              <!-- Top row -->
              <div class="friend-top">
                <div class="friend-avatar-wrap">
                  <div class="friend-avatar">{{ getInitials(friend.name) }}</div>
                  <span class="status-dot" [class.online]="chatService.isOnline(friend._id)"></span>
                </div>
                <div class="friend-meta">
                  <div class="friend-name">{{ friend.name }}</div>
                  <div class="friend-username">&#64;{{ friend.username }}</div>
                </div>
                <button class="btn-chat" (click)="openChat(friend)" title="Chat">
                  <ion-icon name="chatbubble-ellipses-outline"></ion-icon>
                  @if (chatService.unreadFor(friend._id) > 0) {
                    <span class="chat-unread">{{ chatService.unreadFor(friend._id) }}</span>
                  }
                </button>
                <button class="btn-unfriend" (click)="confirmUnfriend(friend)" title="Unfriend">
                  <ion-icon name="person-remove-outline"></ion-icon>
                </button>
              </div>

              <!-- Stats -->
              <div class="friend-stats">
                <div class="fstat" style="background:rgba(16,185,129,0.12)">
                  <div class="fstat-num" style="color:#10B981">{{ friend.completedCount }}</div>
                  <div class="fstat-label">Completed</div>
                </div>
                <div class="fstat" style="background:rgba(61,90,241,0.12)">
                  <div class="fstat-num" style="color:#3D5AF1">{{ friend.sharedCount }}</div>
                  <div class="fstat-label">Shared</div>
                </div>
                <div class="fstat" [style.background]="friend.pendingCount > 0 ? 'rgba(234,88,12,0.12)' : 'var(--rm-surface)'">
                  <div class="fstat-num" [style.color]="friend.pendingCount > 0 ? '#EA580C' : 'var(--rm-text-muted)'">{{ friend.pendingCount }}</div>
                  <div class="fstat-label">Pending</div>
                </div>
              </div>

              <!-- Send Reminder button -->
              <button class="btn-send-reminder" (click)="toggleReminderForm(friend._id)">
                <ion-icon name="add-circle-outline"></ion-icon>
                Send Reminder
                <ion-icon [name]="openFormId() === friend._id ? 'chevron-up-outline' : 'chevron-down-outline'" class="chevron"></ion-icon>
              </button>

              <!-- Inline reminder form -->
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

              <!-- Shared reminders with status -->
              @if (sharedFor(friend._id).length) {
                <div class="shared-list">
                  <div class="shared-list-title">Shared Reminders</div>
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

                      <!-- Action buttons — only for the recipient, only when not done/skipped -->
                      @if (r.assignedTo === currentUserId() && r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped') {
                        <div class="action-row">
                          <button class="act-btn act-start"
                            (click)="onStatusChange(r, 'processing')">
                            ▶ Start
                          </button>
                          <button class="act-btn act-done"
                            (click)="onStatusChange(r, 'completed')">
                            ✅ Done
                          </button>
                          <button class="act-btn act-snooze"
                            (click)="snooze(r, 10)">
                            ⏰ 10 min
                          </button>
                          <button class="act-btn act-snooze"
                            (click)="snooze(r, 60)">
                            ⏰ 1 hr
                          </button>
                          <button class="act-btn act-skip"
                            (click)="onStatusChange(r, 'skipped')">
                            ⏭ Skip
                          </button>
                        </div>
                      }
                    </div>
                  }
                </div>
              }

            </div>
          }
        </div>
      }
    </ion-content>

    <!-- ── Full-screen chat (WhatsApp-style) ───────────────────────────── -->
    @if (activeChat(); as chat) {
      <div class="chat-overlay">
        <div class="chat-head">
          <button class="chat-back" (click)="closeChat()">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </button>
          <div class="chat-head-avatar">
            {{ getInitials(chat.name) }}
            <span class="chat-head-dot" [class.online]="chatService.isOnline(chat._id)"></span>
          </div>
          <div class="chat-head-meta">
            <div class="chat-head-name">{{ chat.name }}</div>
            <div class="chat-head-status">
              @if (chatService.isTyping(chat._id)) {
                <span class="typing-text">typing…</span>
              } @else if (chatService.isOnline(chat._id)) {
                <span class="online-text">online</span>
              } @else {
                <span class="offline-text">offline</span>
              }
            </div>
          </div>
        </div>

        <div class="chat-body" #chatBody>
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

        <div class="chat-input-bar">
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
    /* My friend code card */
    .mycode-card{display:flex;align-items:center;gap:10px;margin:12px 16px 0;padding:14px 16px;background:linear-gradient(135deg,var(--rm-purple),#5B7CFF);border-radius:18px;box-shadow:var(--rm-shadow-sm)}
    .mycode-left{flex:1;min-width:0}
    .mycode-label{font-size:11px;font-weight:600;color:rgba(255,255,255,0.8);text-transform:uppercase;letter-spacing:0.5px}
    .mycode-value{font-size:22px;font-weight:800;color:#fff;letter-spacing:2px;font-family:'Courier New',monospace;margin-top:2px}
    .btn-copy{width:38px;height:38px;border:none;border-radius:11px;background:rgba(255,255,255,0.18);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .btn-copy ion-icon{font-size:18px;pointer-events:none}
    .btn-copy:disabled{opacity:0.5}
    .btn-share{display:flex;align-items:center;gap:6px;padding:9px 14px;border:none;border-radius:11px;background:#fff;color:var(--rm-purple);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0}
    .btn-share ion-icon{font-size:16px}
    .btn-share:disabled{opacity:0.6}
    /* Code entry */
    .code-entry-row{display:flex;gap:8px}
    .code-input{flex:1;text-transform:uppercase;letter-spacing:2px;font-family:'Courier New',monospace;font-weight:700}
    .btn-lookup{padding:0 18px;background:var(--rm-purple);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0}
    .btn-lookup:disabled{opacity:0.5;cursor:default}
    .error-hint{color:#DC2626}
    /* Lookup preview */
    .preview-card{display:flex;align-items:center;gap:12px;margin-top:12px;padding:12px;background:var(--rm-surface);border-radius:14px;border:1.5px solid var(--rm-purple-light)}
    .preview-avatar{width:48px;height:48px;border-radius:50%;background:var(--rm-purple-light);color:var(--rm-purple);font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
    .preview-avatar img{width:100%;height:100%;object-fit:cover}
    .preview-info{flex:1;min-width:0}
    .preview-name{font-size:15px;font-weight:700;color:var(--rm-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .preview-sub{font-size:12px;color:var(--rm-text-muted);margin-top:2px}
    .rel-pill{padding:7px 12px;border-radius:10px;font-size:12px;font-weight:700;background:var(--rm-card);color:var(--rm-text-secondary);display:flex;align-items:center;gap:4px;flex-shrink:0}
    .rel-pill ion-icon{font-size:15px}
    .rel-ok{color:#047857;background:rgba(16,185,129,0.12)}
    .rel-action{color:#C2410C;background:rgba(234,88,12,0.12)}
    .search-wrap{padding:8px 12px 0}
    .custom-searchbar{--background:var(--rm-surface);--border-radius:14px;--box-shadow:var(--rm-shadow-sm);--color:var(--rm-text-primary);--placeholder-color:var(--rm-text-muted);padding:0}
    .requests-banner{margin:12px 16px;background:rgba(234,88,12,0.08);border-radius:16px;padding:14px;border:1.5px solid rgba(234,88,12,0.2)}
    .requests-title{font-size:13px;font-weight:700;color:#C2410C;display:flex;align-items:center;gap:6px;margin-bottom:10px}
    .request-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;border-radius:10px;transition:background 0.3s}
    .request-row.highlight{background:rgba(234,88,12,0.16);box-shadow:0 0 0 2px rgba(234,88,12,0.35);padding:6px}
    .req-avatar{width:32px;height:32px;border-radius:50%;background:var(--rm-purple-light);color:var(--rm-purple);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
    .req-avatar img{width:100%;height:100%;object-fit:cover}
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
    .btn-unfriend{margin-left:auto;flex-shrink:0;width:34px;height:34px;border:none;background:rgba(239,68,68,0.1);color:#EF4444;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:17px;padding:0;transition:background 0.15s}
    .btn-unfriend:active{background:rgba(239,68,68,0.22)}
    .friend-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
    .fstat{text-align:center;padding:10px 4px;border-radius:12px}
    .fstat-num{font-size:18px;font-weight:800;line-height:1}
    .fstat-label{font-size:10px;color:var(--rm-text-muted);margin-top:3px;font-weight:500}
    .btn-send-reminder{width:100%;padding:11px 14px;background:var(--rm-purple-light);color:var(--rm-purple);border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px}
    .btn-send-reminder ion-icon{font-size:16px}
    .chevron{margin-left:auto;font-size:14px}
    .reminder-form{margin-top:12px;display:flex;flex-direction:column;gap:8px;padding:14px;background:var(--rm-surface);border-radius:14px;border:1.5px solid var(--rm-border)}
    .rf-input{width:100%;padding:10px 12px;border:1.5px solid var(--rm-border);border-radius:10px;background:var(--rm-card);color:var(--rm-text-primary);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box}
    .rf-input:focus{border-color:var(--rm-purple)}
    .rf-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .rf-half{}
    .rf-priority-row{display:flex;gap:6px;flex-wrap:wrap}
    .rf-priority{padding:6px 12px;border:1.5px solid var(--rm-border);border-radius:8px;background:var(--rm-card);color:var(--rm-text-secondary);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
    .rf-priority.active{border-color:var(--rm-purple);background:var(--rm-purple-light);color:var(--rm-purple)}
    .btn-rf-send{padding:12px;background:var(--rm-purple);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
    .btn-rf-send:disabled{opacity:0.6;cursor:default}
    .shared-list{margin-top:12px;border-top:1px solid var(--rm-border);padding-top:12px;display:flex;flex-direction:column;gap:10px}
    .shared-list-title{font-size:11px;font-weight:700;color:var(--rm-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px}
    .shared-item{display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--rm-surface);border-radius:12px}
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
    /* Chat button on friend card */
    .btn-chat{position:relative;margin-left:auto;flex-shrink:0;width:34px;height:34px;border:none;background:rgba(61,90,241,0.1);color:var(--rm-purple);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:17px;padding:0;transition:background 0.15s}
    .btn-chat:active{background:rgba(61,90,241,0.22)}
    .chat-unread{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;padding:0 4px;background:#EF4444;color:#fff;border-radius:8px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--rm-card)}
    /* Chat overlay */
    .chat-overlay{position:fixed;inset:0;z-index:1000;background:var(--rm-bg);display:flex;flex-direction:column;animation:chatSlideIn 0.22s ease}
    @keyframes chatSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
    .chat-head{display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top) + 10px) 14px 10px;background:var(--rm-card);box-shadow:var(--rm-shadow-sm);flex-shrink:0}
    .chat-back{width:38px;height:38px;border:none;background:transparent;color:var(--rm-text-primary);border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;padding:0;flex-shrink:0}
    .chat-head-avatar{position:relative;width:42px;height:42px;border-radius:50%;background:var(--rm-purple-light);color:var(--rm-purple);font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .chat-head-dot{position:absolute;bottom:0;right:0;width:11px;height:11px;border-radius:50%;border:2px solid var(--rm-card);background:var(--rm-border)}
    .chat-head-dot.online{background:#10B981}
    .chat-head-meta{flex:1;min-width:0}
    .chat-head-name{font-size:16px;font-weight:800;color:var(--rm-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .chat-head-status{font-size:12px;margin-top:1px;height:15px}
    .typing-text{color:var(--rm-purple);font-weight:600}
    .online-text{color:#10B981;font-weight:600}
    .offline-text{color:var(--rm-text-muted)}
    .chat-body{flex:1;overflow-y:auto;padding:16px 12px;display:flex;flex-direction:column;gap:6px;background:var(--rm-bg)}
    .chat-empty{margin:auto;color:var(--rm-text-muted);font-size:14px;text-align:center}
    .bubble-row{display:flex;justify-content:flex-start}
    .bubble-row.mine{justify-content:flex-end}
    .bubble{max-width:78%;padding:8px 11px 6px;border-radius:14px;background:var(--rm-card);box-shadow:var(--rm-shadow-sm);border-bottom-left-radius:4px}
    .bubble-mine{background:var(--rm-purple);border-bottom-left-radius:14px;border-bottom-right-radius:4px}
    .bubble-text{font-size:14.5px;line-height:1.35;color:var(--rm-text-primary);word-break:break-word;white-space:pre-wrap}
    .bubble-mine .bubble-text{color:#fff}
    .bubble-meta{display:flex;align-items:center;justify-content:flex-end;gap:3px;font-size:10px;color:var(--rm-text-muted);margin-top:3px}
    .bubble-mine .bubble-meta{color:rgba(255,255,255,0.75)}
    .tick{font-size:14px}
    .tick-read{color:#38BDF8}
    .chat-input-bar{display:flex;align-items:center;gap:8px;padding:10px 12px calc(env(safe-area-inset-bottom) + 10px);background:var(--rm-card);flex-shrink:0}
    .chat-input{flex:1;padding:11px 14px;border:1.5px solid var(--rm-border);border-radius:22px;background:var(--rm-surface);color:var(--rm-text-primary);font-size:15px;font-family:inherit;outline:none}
    .chat-input:focus{border-color:var(--rm-purple)}
    .chat-send{width:44px;height:44px;border:none;border-radius:50%;background:var(--rm-purple);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:19px;flex-shrink:0;transition:opacity 0.15s}
    .chat-send:disabled{opacity:0.45;cursor:default}
  `],
})
export class FriendsComponent implements OnInit, OnDestroy {
  private friendService = inject(FriendService);
  private socketService = inject(SocketService);
  protected chatService = inject(ChatService);
  private authService   = inject(AuthService);
  private shareService  = inject(ShareService);
  private route         = inject(ActivatedRoute);
  private router        = inject(Router);
  private toastCtrl     = inject(ToastController);
  private alertCtrl     = inject(AlertController);

  isLoading       = signal(true);
  searchQuery     = signal('');
  friends         = signal<Friend[]>([]);
  pendingRequests = signal<PendingRequest[]>([]);

  // Add-by-code panel
  showAddPanel  = signal(false);
  codeInput     = signal('');
  isLookingUp   = signal(false);
  lookupResult  = signal<RefIdLookup | null>(null);
  lookupError   = signal<string>('');
  sending       = signal<string | null>(null);

  // The signed-in user's own shareable code
  myRefId = () => this.authService.currentUser()?.refId ?? '';

  // A pending request to flash when arriving via a notification tap
  highlightId    = signal<string | null>(null);
  private pendingAcceptId: string | null = null;

  // Send reminder
  openFormId      = signal<string | null>(null);
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
  private typingTimer: ReturnType<typeof setTimeout> | undefined;

  private socketSub: Subscription | undefined;
  private socketSub2: Subscription | undefined;
  private querySub: Subscription | undefined;

  readonly filtered = () => {
    const q = this.searchQuery().toLowerCase();
    return this.friends().filter(f =>
      !q || f.name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)
    );
  };

  constructor() {
    addIcons({ personAddOutline, personRemoveOutline, closeOutline, searchOutline,
               addCircleOutline, chevronDownOutline, chevronUpOutline,
               shareSocialOutline, copyOutline, keyOutline, checkmarkCircle,
               chatbubbleEllipsesOutline, arrowBackOutline, send,
               checkmarkOutline, checkmarkDoneOutline, timeOutline });

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
    this.socketSub?.unsubscribe();
    this.socketSub2?.unsubscribe();
    this.querySub?.unsubscribe();
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

  onSearch(event: CustomEvent) {
    this.searchQuery.set(event.detail.value ?? '');
  }

  openAddPanel() {
    this.showAddPanel.set(true);
    this.resetAddPanel();
    setTimeout(() => {
      (document.querySelector('.code-input') as HTMLInputElement)?.focus();
    }, 100);
  }

  closeAddPanel() {
    this.showAddPanel.set(false);
    this.resetAddPanel();
  }

  private resetAddPanel() {
    this.codeInput.set('');
    this.lookupResult.set(null);
    this.lookupError.set('');
    this.isLookingUp.set(false);
    this.sending.set(null);
  }

  onCodeInput(event: Event) {
    // Normalise as the user types: uppercase, strip anything that isn't A–Z/0–9.
    const cleaned = (event.target as HTMLInputElement).value
      .toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.codeInput.set(cleaned);
    this.lookupResult.set(null);
    this.lookupError.set('');
  }

  lookup() {
    const code = this.codeInput();
    if (code.length < 6 || this.isLookingUp()) return;
    this.isLookingUp.set(true);
    this.lookupError.set('');
    this.lookupResult.set(null);
    this.friendService.lookupByRefId(code).subscribe({
      next: (res) => {
        this.lookupResult.set(res);
        this.isLookingUp.set(false);
      },
      error: (err) => {
        this.isLookingUp.set(false);
        this.lookupError.set(err?.error?.message || 'No one found with that code');
      },
    });
  }

  sendRequest(r: RefIdLookup) {
    this.sending.set(r.user._id);
    this.friendService.sendRequest(this.codeInput()).subscribe({
      next: async () => {
        this.sending.set(null);
        this.closeAddPanel();
        const toast = await this.toastCtrl.create({
          message: `Friend request sent to ${r.user.name}!`,
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
      message: 'Friend code copied!', duration: 1800, color: 'success', position: 'top',
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
      header: 'Unfriend',
      message: `Remove ${friend.name} from your accountability buddies?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Unfriend',
          role: 'destructive',
          handler: () => {
            this.friendService.remove(friend.friendshipId).subscribe({
              next: async () => {
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
      this.reminderForm = { title: '', date: this.todayStr(), time: this.nowTimeStr(), priority: 'medium' };
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

  // ── Chat ──────────────────────────────────────────────────────────────
  openChat(friend: Friend): void {
    this.draft = '';
    this.activeChat.set(friend);
    this.chatService.openChat(friend._id);
    setTimeout(() => this.scrollToBottom(), 80);
  }

  closeChat(): void {
    const chat = this.activeChat();
    if (chat) this.chatService.setTyping(chat._id, false);
    clearTimeout(this.typingTimer);
    this.chatService.closeChat();
    this.activeChat.set(null);
  }

  send(): void {
    const chat = this.activeChat();
    if (!chat || !this.draft.trim()) return;
    this.chatService.sendMessage(chat._id, this.draft);
    this.draft = '';
    this.chatService.setTyping(chat._id, false);
    clearTimeout(this.typingTimer);
    setTimeout(() => this.scrollToBottom(), 50);
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
