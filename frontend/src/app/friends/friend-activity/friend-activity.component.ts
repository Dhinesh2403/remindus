// src/app/friends/friend-activity/friend-activity.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

interface ActivityItem {
  id: string;
  type: 'task_done' | 'reminder_set' | 'habit_checked' | 'goal_progress';
  title: string;
  detail?: string;
  timeAgo: string;
  icon: string;
  iconBg: string;
}

@Component({
  selector: 'app-friend-activity',
  standalone: true,
  imports: [CommonModule, IonContent],
  template: `
    <ion-content class="fa-content">
      <div class="fa-header">
        <button class="fa-back" (click)="nav.navigate(['/app/friends'])">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div class="fa-header-center">
          <div class="fa-avatar">{{ friendName()[0] }}</div>
          <div>
            <div class="fa-name">{{ friendName() }}</div>
            <div class="fa-sub">Shared Activity</div>
          </div>
        </div>
        <button class="fa-chat" (click)="nav.navigate(['/app/friends', friendId, 'chat'])">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <!-- Stats strip -->
      <div class="fa-stats">
        <div class="fa-stat"><div class="fa-stat-num blue">8</div><div class="fa-stat-lbl">TASKS SHARED</div></div>
        <div class="fa-stat"><div class="fa-stat-num green">5</div><div class="fa-stat-lbl">DONE TOGETHER</div></div>
        <div class="fa-stat"><div class="fa-stat-num orange">3</div><div class="fa-stat-lbl">IN PROGRESS</div></div>
      </div>

      <!-- Activity feed -->
      <div class="fa-feed-label">RECENT ACTIVITY</div>
      <div class="fa-feed">
        @for (item of activities(); track item.id) {
          <div class="fa-item">
            <div class="fa-icon" [style.background]="item.iconBg">{{ item.icon }}</div>
            <div class="fa-item-body">
              <div class="fa-item-title">{{ item.title }}</div>
              @if (item.detail) {
                <div class="fa-item-detail">{{ item.detail }}</div>
              }
            </div>
            <div class="fa-time">{{ item.timeAgo }}</div>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    :host { display: block; }
    .fa-content { --background: var(--rm-bg); }
    .fa-header { display: flex; align-items: center; gap: 10px; padding: calc(env(safe-area-inset-top) + 10px) 16px 10px; background: var(--rm-card); border-bottom: 1px solid var(--rm-border); }
    .fa-back { width: 34px; height: 34px; border: none; background: var(--rm-surface); border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--rm-text-primary); flex-shrink: 0; }
    .fa-header-center { flex: 1; display: flex; align-items: center; gap: 10px; }
    .fa-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--rm-purple); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #fff; font-family: 'Nunito', sans-serif; flex-shrink: 0; }
    .fa-name { font-size: 15px; font-weight: 700; color: var(--rm-text-primary); }
    .fa-sub  { font-size: 11.5px; color: var(--rm-text-muted); }
    .fa-chat { width: 34px; height: 34px; border: none; background: rgba(61,90,241,.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--rm-purple); }
    .fa-stats { display: flex; background: var(--rm-card); margin: 12px 16px; border-radius: 16px; padding: 16px; box-shadow: var(--rm-shadow-sm); }
    .fa-stat { flex: 1; text-align: center; }
    .fa-stat:not(:last-child) { border-right: 1px solid var(--rm-border); }
    .fa-stat-num { font-size: 20px; font-weight: 900; font-family: 'Nunito', sans-serif; }
    .fa-stat-num.blue   { color: var(--rm-purple); }
    .fa-stat-num.green  { color: #10B981; }
    .fa-stat-num.orange { color: #F59E0B; }
    .fa-stat-lbl { font-size: 9.5px; font-weight: 700; color: var(--rm-text-muted); letter-spacing: .4px; margin-top: 2px; }
    .fa-feed-label { font-size: 11px; font-weight: 700; letter-spacing: .6px; color: var(--rm-text-muted); padding: 4px 16px 8px; }
    .fa-feed { margin: 0 16px; background: var(--rm-card); border-radius: 16px; box-shadow: var(--rm-shadow-sm); overflow: hidden; }
    .fa-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--rm-border); }
    .fa-item:last-child { border-bottom: none; }
    .fa-icon { width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .fa-item-body { flex: 1; }
    .fa-item-title  { font-size: 14px; font-weight: 600; color: var(--rm-text-primary); }
    .fa-item-detail { font-size: 12.5px; color: var(--rm-text-muted); margin-top: 2px; }
    .fa-time { font-size: 11px; color: var(--rm-text-muted); flex-shrink: 0; padding-top: 2px; }
  `],
})
export class FriendActivityComponent {
  protected nav = inject(Router);
  private route = inject(ActivatedRoute);

  protected friendId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly friendName = signal('Alex Johnson');

  readonly activities = signal<ActivityItem[]>([
    { id: '1', type: 'task_done', title: 'Completed "Finalize design mockups"', detail: 'Shared task · Work', timeAgo: '2h ago', icon: '✓', iconBg: 'rgba(16,185,129,.12)' },
    { id: '2', type: 'reminder_set', title: 'Set reminder for team standup', detail: 'Tomorrow at 9:00 AM', timeAgo: '4h ago', icon: '🔔', iconBg: 'rgba(245,158,11,.12)' },
    { id: '3', type: 'habit_checked', title: 'Checked habit "Morning workout"', detail: '3-day streak 🔥', timeAgo: 'Yesterday', icon: '💪', iconBg: 'rgba(139,92,246,.12)' },
    { id: '4', type: 'goal_progress', title: 'Updated goal "Read 12 books"', detail: '5 of 12 complete · 42%', timeAgo: '2 days ago', icon: '🎯', iconBg: 'rgba(61,90,241,.12)' },
    { id: '5', type: 'task_done', title: 'Completed "Write unit tests"', detail: 'Shared task · Work', timeAgo: '3 days ago', icon: '✓', iconBg: 'rgba(16,185,129,.12)' },
  ]);
}
