// src/app/chat/chat.component.ts
import { Component, inject, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../core/services/auth.service';

interface ChatMessage {
  id: string;
  senderId: string;
  text?: string;
  type: 'text' | 'task' | 'reminder';
  embed?: { title: string; subtitle?: string; dueDate?: string; status?: string };
  sentAt: Date;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
  template: `
    <ion-content class="chat-content">
      <!-- Header -->
      <div class="chat-header">
        <button class="chat-back" (click)="nav.navigate(['/app/friends'])">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div class="chat-avatar-wrap">
          <div class="chat-avatar">{{ friendName()[0] }}</div>
          <div class="chat-online-dot"></div>
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">{{ friendName() }}</div>
          <div class="chat-header-status">Online now</div>
        </div>
        <button class="chat-header-action" (click)="nav.navigate(['/app/friends', friendId, 'activity'])">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3h18v13H3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 21h8M12 16v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </button>
      </div>

      <!-- Messages -->
      <div class="chat-messages" #scrollArea>
        <div class="chat-date-divider">Today</div>

        @for (msg of messages(); track msg.id) {
          <div class="chat-msg-row" [class.me]="msg.senderId === myId()">
            @if (msg.type === 'task' || msg.type === 'reminder') {
              <!-- Embed card -->
              <div class="chat-embed" [class.task]="msg.type === 'task'" [class.reminder]="msg.type === 'reminder'">
                <div class="chat-embed-label">{{ msg.type === 'task' ? '✓ Task' : '🔔 Reminder' }}</div>
                <div class="chat-embed-title">{{ msg.embed?.title }}</div>
                @if (msg.embed?.subtitle) {
                  <div class="chat-embed-sub">{{ msg.embed?.subtitle }}</div>
                }
                @if (msg.embed?.dueDate) {
                  <div class="chat-embed-date">Due {{ msg.embed?.dueDate }}</div>
                }
              </div>
            } @else {
              <div class="chat-bubble" [class.me]="msg.senderId === myId()">{{ msg.text }}</div>
            }
          </div>
        }
      </div>

      <!-- Input bar -->
      <div class="chat-input-bar">
        <button class="chat-attach" (click)="showActions = !showActions">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <input class="chat-input" [(ngModel)]="draft" placeholder="Message…" (keyup.enter)="send()" />
        <button class="chat-send" [disabled]="!draft.trim()" (click)="send()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <!-- Quick action panel -->
      @if (showActions) {
        <div class="chat-quick-actions">
          <button class="chat-qa-btn task" (click)="sendEmbed('task')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            Send Task
          </button>
          <button class="chat-qa-btn reminder" (click)="sendEmbed('reminder')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            Send Reminder
          </button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    :host { display: block; }
    .chat-content { --background: #F5F6FA; }
    .chat-header { display: flex; align-items: center; gap: 10px; padding: calc(env(safe-area-inset-top) + 10px) 16px 10px; background: #fff; border-bottom: 1px solid #E5E7EB; position: sticky; top: 0; z-index: 10; }
    .chat-back { width: 34px; height: 34px; border: none; background: #F3F4F6; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #1F2937; flex-shrink: 0; }
    .chat-avatar-wrap { position: relative; flex-shrink: 0; }
    .chat-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--rm-purple); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #fff; font-family: 'Nunito', sans-serif; }
    .chat-online-dot { position: absolute; bottom: 1px; right: 1px; width: 10px; height: 10px; border-radius: 50%; background: #10B981; border: 2px solid #fff; }
    .chat-header-info { flex: 1; }
    .chat-header-name   { font-size: 15px; font-weight: 700; color: #1F2937; }
    .chat-header-status { font-size: 11.5px; color: #10B981; font-weight: 600; }
    .chat-header-action { width: 34px; height: 34px; border: none; background: #F3F4F6; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #6B7280; }
    .chat-messages { padding: 12px 12px 80px; min-height: 100%; }
    .chat-date-divider { text-align: center; font-size: 11.5px; font-weight: 700; color: #9CA3AF; margin: 8px 0 16px; }
    .chat-msg-row { display: flex; margin-bottom: 10px; }
    .chat-msg-row.me { justify-content: flex-end; }
    .chat-bubble { max-width: 72%; padding: 10px 14px; border-radius: 18px; font-size: 14.5px; line-height: 1.5; background: #fff; color: #1F2937; box-shadow: 0 1px 3px rgba(0,0,0,.06); border-bottom-left-radius: 4px; }
    .chat-bubble.me { background: var(--rm-purple); color: #fff; border-bottom-left-radius: 18px; border-bottom-right-radius: 4px; }
    .chat-embed { max-width: 72%; border-radius: 14px; padding: 12px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.08); border-left: 4px solid #6B7280; }
    .chat-embed.task     { border-left-color: #3D5AF1; }
    .chat-embed.reminder { border-left-color: #F59E0B; }
    .chat-embed-label { font-size: 10.5px; font-weight: 700; color: #6B7280; letter-spacing: .4px; text-transform: uppercase; margin-bottom: 4px; }
    .chat-embed-title { font-size: 14px; font-weight: 700; color: #1F2937; }
    .chat-embed-sub   { font-size: 12.5px; color: #6B7280; margin-top: 3px; }
    .chat-embed-date  { font-size: 11.5px; color: #9CA3AF; margin-top: 6px; }
    .chat-input-bar { position: fixed; bottom: 0; left: 0; right: 0; padding: 10px 12px calc(env(safe-area-inset-bottom) + 10px); background: #fff; border-top: 1px solid #E5E7EB; display: flex; align-items: center; gap: 8px; z-index: 20; }
    .chat-attach { width: 38px; height: 38px; border-radius: 50%; border: none; background: #F3F4F6; display: flex; align-items: center; justify-content: center; color: #6B7280; cursor: pointer; flex-shrink: 0; }
    .chat-input { flex: 1; height: 42px; border-radius: 21px; border: 1.5px solid #E5E7EB; background: #F9FAFB; padding: 0 16px; font-size: 15px; color: #1F2937; font-family: inherit; outline: none; }
    .chat-input:focus { border-color: var(--rm-purple); }
    .chat-send { width: 42px; height: 42px; border-radius: 50%; border: none; background: var(--rm-purple); display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; flex-shrink: 0; &:disabled { opacity: .5; } }
    .chat-quick-actions { position: fixed; bottom: 70px; left: 0; right: 0; background: #fff; border-top: 1px solid #E5E7EB; display: flex; gap: 12px; padding: 12px 16px; z-index: 19; }
    .chat-qa-btn { flex: 1; height: 48px; border-radius: 14px; border: none; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .chat-qa-btn.task     { background: rgba(61,90,241,.10); color: var(--rm-purple); }
    .chat-qa-btn.reminder { background: rgba(245,158,11,.10); color: #D97706; }
  `],
})
export class ChatComponent {
  protected nav = inject(Router);
  private route = inject(ActivatedRoute);
  private auth  = inject(AuthService);

  protected friendId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly myId = computed(() => (this.auth.currentUser() as any)?._id ?? '');
  readonly friendName = signal('Alex Johnson');

  draft = '';
  showActions = false;

  readonly messages = signal<ChatMessage[]>([
    { id: '1', senderId: 'friend', text: 'Hey! Did you finish the project report?', type: 'text', sentAt: new Date() },
    { id: '2', senderId: 'me', text: 'Almost! Sending you the task so you can track it.', type: 'text', sentAt: new Date() },
    { id: '3', senderId: 'me', type: 'task', embed: { title: 'Complete project report', subtitle: 'Work · High priority', dueDate: 'Today, 5:00 PM', status: 'active' }, sentAt: new Date() },
    { id: '4', senderId: 'friend', text: 'Got it! I\'ll set a reminder too.', type: 'text', sentAt: new Date() },
  ]);

  send(): void {
    if (!this.draft.trim()) return;
    this.messages.update(m => [...m, {
      id: Date.now().toString(),
      senderId: 'me',
      text: this.draft.trim(),
      type: 'text',
      sentAt: new Date(),
    }]);
    this.draft = '';
    this.showActions = false;
  }

  sendEmbed(type: 'task' | 'reminder'): void {
    this.messages.update(m => [...m, {
      id: Date.now().toString(),
      senderId: 'me',
      type,
      embed: type === 'task'
        ? { title: 'New shared task', subtitle: 'Tap to view details', dueDate: 'Tomorrow' }
        : { title: 'Reminder: Team meeting', subtitle: '3:00 PM', dueDate: 'Today' },
      sentAt: new Date(),
    }]);
    this.showActions = false;
  }
}
