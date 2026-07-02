// src/app/core/services/chat.service.ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SocketService } from './socket.service';
import { AuthService } from './auth.service';

export type ChatStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  _id:        string;        // real id, or a temp id while optimistic
  tempId?:    string;
  sender:     string;
  recipient:  string;
  text:       string;
  status:     ChatStatus;
  deliveredAt?: string | null;
  readAt?:    string | null;
  createdAt:  string;
}

export interface Conversation {
  friendId:    string;
  name:        string;
  avatar:      string | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http   = inject(HttpClient);
  private socket = inject(SocketService);
  private auth   = inject(AuthService);
  private readonly API = `${environment.apiUrl}/chat`;

  // ── Reactive state ────────────────────────────────────────────────────
  private _messages    = signal<Record<string, ChatMessage[]>>({});
  private _unread      = signal<Record<string, number>>({});
  private _typing      = signal<Record<string, boolean>>({});
  private _online      = signal<Set<string>>(new Set());
  private _conversations = signal<Conversation[]>([]);

  /** Which friend's chat is currently open (null = none). */
  readonly activeFriendId = signal<string | null>(null);

  readonly conversations = this._conversations.asReadonly();
  readonly onlineUsers   = this._online.asReadonly();

  /** Total unread across all conversations — drives the badges. */
  readonly totalUnread = computed(() =>
    Object.values(this._unread()).reduce((sum, n) => sum + n, 0)
  );

  private initialised = false;
  private typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  private get myId(): string {
    return this.auth.currentUser()?._id ?? '';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  /** Wire socket listeners (once) + hydrate unread counts. Safe to call repeatedly. */
  init(): void {
    if (this.initialised) { this.loadConversations(); return; }
    this.initialised = true;

    this.socket.on<{ message: ChatMessage }>('chat:message')
      .subscribe(({ message }) => this.onIncoming(message));

    this.socket.on<{ tempId: string; message: ChatMessage }>('chat:ack')
      .subscribe(({ tempId, message }) => this.onAck(tempId, message));

    this.socket.on<{ messageId: string }>('chat:delivered')
      .subscribe(({ messageId }) => this.updateStatus(messageId, 'delivered'));

    this.socket.on<{ byUserId: string }>('chat:read')
      .subscribe(({ byUserId }) => this.markMineRead(byUserId));

    this.socket.on<{ fromUserId: string; isTyping: boolean }>('chat:typing')
      .subscribe(({ fromUserId, isTyping }) => this.setRemoteTyping(fromUserId, isTyping));

    this.socket.on<{ userId: string; online: boolean }>('presence:update')
      .subscribe(({ userId, online }) => this.setOnline(userId, online));

    this.socket.on<{ online: string[] }>('presence:state')
      .subscribe(({ online }) => this._online.set(new Set(online)));

    this.loadConversations();
    // Request initial presence state
    this.socket.emit('presence:get', {});
  }

  /** Reset on logout. */
  reset(): void {
    this._messages.set({});
    this._unread.set({});
    this._typing.set({});
    this._online.set(new Set());
    this._conversations.set([]);
    this.activeFriendId.set(null);
  }

  // ── Selectors ─────────────────────────────────────────────────────────
  messagesFor(friendId: string): ChatMessage[] { return this._messages()[friendId] ?? []; }
  unreadFor(friendId: string): number { return this._unread()[friendId] ?? 0; }
  isTyping(friendId: string): boolean { return !!this._typing()[friendId]; }
  isOnline(friendId: string): boolean { return this._online().has(friendId); }

  // ── Loading ───────────────────────────────────────────────────────────
  loadConversations(): void {
    this.http.get<{ conversations: Conversation[] }>(`${this.API}/conversations`).subscribe({
      next: ({ conversations }) => {
        this._conversations.set(conversations);
        const unread: Record<string, number> = {};
        conversations.forEach(c => { if (c.unreadCount > 0) unread[c.friendId] = c.unreadCount; });
        this._unread.set(unread);
      },
      error: () => {},
    });
  }

  loadMessages(friendId: string): void {
    this.http.get<{ messages: ChatMessage[] }>(`${this.API}/${friendId}/messages`).subscribe({
      next: ({ messages }) => {
        this._messages.update(prev => ({ ...prev, [friendId]: messages }));
      },
      error: () => {},
    });
  }

  // ── Open / close a conversation ───────────────────────────────────────
  openChat(friendId: string): void {
    this.activeFriendId.set(friendId);
    this.loadMessages(friendId);
    this.markRead(friendId);
  }

  closeChat(): void {
    this.activeFriendId.set(null);
  }

  // ── Sending ───────────────────────────────────────────────────────────
  sendMessage(friendId: string, raw: string): void {
    const text = raw.trim();
    if (!text) return;

    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMessage = {
      _id:       tempId,
      tempId,
      sender:    this.myId,
      recipient: friendId,
      text,
      status:    'sending',
      createdAt: new Date().toISOString(),
    };
    this.appendMessage(friendId, optimistic);

    if (this.socket.isConnected()) {
      this.socket.emit('chat:send', { toUserId: friendId, tempId, text });
    } else {
      // REST fallback when the socket is unavailable.
      this.http.post<{ message: ChatMessage }>(`${this.API}/${friendId}/messages`, { text }).subscribe({
        next: ({ message }) => this.onAck(tempId, message),
        error: () => {},
      });
    }
  }

  // ── Typing ────────────────────────────────────────────────────────────
  setTyping(friendId: string, isTyping: boolean): void {
    this.socket.emit('chat:typing', { toUserId: friendId, isTyping });
  }

  // ── Read receipts ─────────────────────────────────────────────────────
  markRead(friendId: string): void {
    this.clearUnread(friendId);
    this.socket.emit('chat:read', { fromUserId: friendId });
    // Belt-and-braces REST call (covers a missed socket emit).
    this.http.patch(`${this.API}/${friendId}/read`, {}).subscribe({ error: () => {} });
  }

  // ── Socket event handlers ─────────────────────────────────────────────
  private onIncoming(message: ChatMessage): void {
    const friendId = message.sender;          // the other party in this thread
    this.appendMessage(friendId, message);
    this.touchConversation(friendId, message);

    if (this.activeFriendId() === friendId) {
      this.markRead(friendId);                // open chat → instantly read
    } else {
      this.bumpUnread(friendId);
    }
  }

  private onAck(tempId: string, message: ChatMessage): void {
    const friendId = message.recipient;
    this._messages.update(prev => {
      const list = prev[friendId] ?? [];
      const next = list.map(m => (m.tempId === tempId || m._id === tempId) ? message : m);
      return { ...prev, [friendId]: next };
    });
    this.touchConversation(friendId, message);
  }

  private updateStatus(messageId: string, status: ChatStatus): void {
    this._messages.update(prev => {
      const next: Record<string, ChatMessage[]> = {};
      for (const [fid, list] of Object.entries(prev)) {
        next[fid] = list.map(m => m._id === messageId ? { ...m, status } : m);
      }
      return next;
    });
  }

  private markMineRead(friendId: string): void {
    this._messages.update(prev => {
      const list = prev[friendId];
      if (!list) return prev;
      const next = list.map(m => m.sender === this.myId ? { ...m, status: 'read' as ChatStatus } : m);
      return { ...prev, [friendId]: next };
    });
  }

  private setRemoteTyping(friendId: string, isTyping: boolean): void {
    this._typing.update(prev => ({ ...prev, [friendId]: isTyping }));
    clearTimeout(this.typingTimers[friendId]);
    if (isTyping) {
      // Auto-clear if the "stopped typing" event never arrives.
      this.typingTimers[friendId] = setTimeout(() => {
        this._typing.update(prev => ({ ...prev, [friendId]: false }));
      }, 4000);
    }
  }

  private setOnline(userId: string, online: boolean): void {
    this._online.update(prev => {
      const next = new Set(prev);
      if (online) next.add(userId); else next.delete(userId);
      return next;
    });
  }

  // ── Internal helpers ──────────────────────────────────────────────────
  private appendMessage(friendId: string, message: ChatMessage): void {
    this._messages.update(prev => {
      const list = prev[friendId] ?? [];
      if (message._id && list.some(m => m._id === message._id)) return prev;  // de-dupe
      return { ...prev, [friendId]: [...list, message] };
    });
  }

  private hasUnreadLoaded(friendId: string): boolean {
    return friendId in this._unread();
  }

  private bumpUnread(friendId: string): void {
    this._unread.update(prev => ({ ...prev, [friendId]: (prev[friendId] ?? 0) + 1 }));
  }

  private clearUnread(friendId: string): void {
    this._unread.update(prev => {
      if (!prev[friendId]) return prev;
      const next = { ...prev };
      delete next[friendId];
      return next;
    });
  }

  private touchConversation(friendId: string, message: ChatMessage): void {
    this._conversations.update(prev => {
      const idx = prev.findIndex(c => c.friendId === friendId);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], lastMessage: message };
      const next = [...prev];
      next.splice(idx, 1);
      return [updated, ...next];
    });
  }
}
