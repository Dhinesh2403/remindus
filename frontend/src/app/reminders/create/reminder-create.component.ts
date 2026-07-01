// src/app/reminders/create/reminder-create.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { ReminderService, CreateReminderDto, ReminderType, RepeatType } from '../../core/services/reminder.service';
import { AuthService } from '../../core/services/auth.service';

interface Friend { _id: string; name: string; avatar?: string }

type NotifType = 'notification' | 'alarm';

@Component({
  selector: 'app-reminder-create',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
  template: `
    <ion-content class="rc-content">
      <!-- Drag handle -->
      <div class="rc-handle"></div>

      <!-- Header row -->
      <div class="rc-header">
        <button class="rc-cancel" (click)="nav.navigate(['/app/reminders'])">Cancel</button>
        <h2 class="rc-sheet-title">New Reminder</h2>
        <button class="rc-save" [disabled]="saving() || !title().trim()" (click)="save()">
          {{ saving() ? '…' : 'Save' }}
        </button>
      </div>

      <!-- Title input -->
      <div class="rc-field-card">
        <input class="rc-title-input" [(ngModel)]="titleVal" placeholder="Reminder title…" autofocus />
      </div>

      <!-- Quick-set chips -->
      <div class="rc-section-label">QUICK SET</div>
      <div class="rc-chips-row">
        @for (q of quickChips; track q.label) {
          <button class="rc-chip" (click)="applyQuick(q)">{{ q.label }}</button>
        }
      </div>

      <!-- Date & Time row -->
      <div class="rc-field-card rc-datetime-card">
        <div class="rc-dt-field">
          <div class="rc-dt-icon blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          </div>
          <div class="rc-dt-body">
            <div class="rc-dt-label">Date</div>
            <input class="rc-dt-input" type="date" [(ngModel)]="dateVal" />
          </div>
        </div>
        <div class="rc-dt-divider"></div>
        <div class="rc-dt-field">
          <div class="rc-dt-icon orange">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          </div>
          <div class="rc-dt-body">
            <div class="rc-dt-label">Time</div>
            <input class="rc-dt-input" type="time" [(ngModel)]="timeVal" />
          </div>
        </div>
      </div>

      <!-- Duration chips -->
      <div class="rc-section-label">DURATION</div>
      <div class="rc-chips-row">
        @for (d of durationChips; track d) {
          <button class="rc-chip" [class.active]="selectedDuration() === d" (click)="selectedDuration.set(d)">{{ d }}</button>
        }
      </div>

      <!-- Category pills -->
      <div class="rc-section-label">CATEGORY</div>
      <div class="rc-cat-row">
        @for (c of categories; track c.type) {
          <button class="rc-cat-pill" [class.active]="selectedCat() === c.type"
                  [style.--cat-color]="c.color" (click)="selectedCat.set(c.type)">
            {{ c.emoji }} {{ c.label }}
          </button>
        }
      </div>

      <!-- For: Me / Friend toggle -->
      <div class="rc-section-label">FOR</div>
      <div class="rc-toggle-row">
        <button class="rc-toggle-btn" [class.active]="forSelf()" (click)="forSelf.set(true)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.7"/></svg>
          Me
        </button>
        <button class="rc-toggle-btn" [class.active]="!forSelf()" (click)="forSelf.set(false)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.7"/></svg>
          Friend
        </button>
      </div>

      <!-- Notification type: Push / Alarm -->
      <div class="rc-section-label">NOTIFICATION TYPE</div>
      <div class="rc-toggle-row">
        <button class="rc-toggle-btn" [class.active]="notifType() === 'notification'" (click)="notifType.set('notification')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          Push
        </button>
        <button class="rc-toggle-btn" [class.active]="notifType() === 'alarm'" (click)="notifType.set('alarm')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="1.7"/><path d="M5 3l-3 3M19 3l3 3M12 9v4l3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          Alarm
        </button>
      </div>

      <!-- Repeat -->
      <div class="rc-section-label">REPEAT</div>
      <select class="rc-select" [(ngModel)]="repeatVal">
        <option value="none">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>

      <!-- Notes -->
      <div class="rc-section-label">NOTES</div>
      <textarea class="rc-notes" [(ngModel)]="notesVal" placeholder="Add a note…" rows="3"></textarea>

      <!-- Bottom CTA -->
      <button class="rc-cta" [disabled]="saving() || !title().trim()" (click)="save()">
        {{ saving() ? 'Saving…' : 'Set Reminder' }}
      </button>
    </ion-content>
  `,
  styles: [`
    :host { display: block; }
    .rc-content { --background: var(--rm-bg); }
    .rc-handle { width: 40px; height: 4px; border-radius: 2px; background: var(--rm-border); margin: 12px auto 0; }
    .rc-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 8px; }
    .rc-cancel { font-size: 15px; color: var(--rm-text-secondary); background: none; border: none; cursor: pointer; font-family: inherit; padding: 0; }
    .rc-sheet-title { font-size: 17px; font-weight: 800; color: var(--rm-text-primary); margin: 0; font-family: 'Nunito', sans-serif; }
    .rc-save { font-size: 15px; font-weight: 700; color: var(--rm-purple); background: none; border: none; cursor: pointer; font-family: inherit; padding: 0; &:disabled { opacity: .4; } }

    .rc-field-card { background: var(--rm-card); border-radius: 16px; margin: 0 16px 12px; box-shadow: var(--rm-shadow-sm); }
    .rc-title-input { width: 100%; padding: 16px; font-size: 17px; font-weight: 600; color: var(--rm-text-primary); background: none; border: none; outline: none; font-family: inherit; border-radius: 16px; }
    .rc-title-input::placeholder { color: var(--rm-text-muted); }

    .rc-section-label { font-size: 11px; font-weight: 700; letter-spacing: .6px; color: var(--rm-text-muted); padding: 4px 16px 8px; }

    .rc-chips-row { display: flex; gap: 8px; padding: 0 16px 12px; flex-wrap: wrap; }
    .rc-chip { height: 34px; padding: 0 14px; border-radius: 17px; border: 1.5px solid var(--rm-border); background: var(--rm-card); font-size: 13px; font-weight: 600; color: var(--rm-text-secondary); cursor: pointer; font-family: inherit; white-space: nowrap; }
    .rc-chip.active, .rc-chip:active { background: var(--rm-purple); color: #fff; border-color: var(--rm-purple); }

    .rc-datetime-card { display: flex; overflow: hidden; }
    .rc-dt-field { flex: 1; display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
    .rc-dt-divider { width: 1px; background: var(--rm-border); align-self: stretch; margin: 12px 0; }
    .rc-dt-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .rc-dt-icon.blue   { background: rgba(59,130,246,.12); color: #3B82F6; }
    .rc-dt-icon.orange { background: rgba(245,158,11,.12); color: #F59E0B; }
    .rc-dt-body { flex: 1; min-width: 0; }
    .rc-dt-label { font-size: 11px; font-weight: 700; color: var(--rm-text-muted); letter-spacing: .4px; }
    .rc-dt-input { width: 100%; border: none; outline: none; background: none; font-size: 14px; font-weight: 600; color: var(--rm-text-primary); font-family: inherit; padding: 0; margin-top: 2px; }

    .rc-cat-row { display: flex; gap: 8px; padding: 0 16px 12px; flex-wrap: wrap; }
    .rc-cat-pill { height: 34px; padding: 0 14px; border-radius: 17px; border: 1.5px solid var(--rm-border); background: var(--rm-card); font-size: 13px; font-weight: 600; color: var(--rm-text-secondary); cursor: pointer; font-family: inherit; }
    .rc-cat-pill.active { background: var(--cat-color, var(--rm-purple)); color: #fff; border-color: transparent; }

    .rc-toggle-row { display: flex; gap: 10px; padding: 0 16px 12px; }
    .rc-toggle-btn { flex: 1; height: 44px; border-radius: 12px; border: 1.5px solid var(--rm-border); background: var(--rm-card); font-size: 14px; font-weight: 700; color: var(--rm-text-secondary); cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 7px; }
    .rc-toggle-btn.active { background: var(--rm-purple); color: #fff; border-color: var(--rm-purple); }

    .rc-select { display: block; width: calc(100% - 32px); margin: 0 16px 12px; height: 50px; padding: 0 14px; border-radius: 14px; border: 1.5px solid var(--rm-border); background: var(--rm-card); font-size: 15px; color: var(--rm-text-primary); font-family: inherit; outline: none; appearance: none; }
    .rc-notes { display: block; width: calc(100% - 32px); margin: 0 16px 12px; padding: 14px; border-radius: 14px; border: 1.5px solid var(--rm-border); background: var(--rm-card); font-size: 15px; color: var(--rm-text-primary); font-family: inherit; outline: none; resize: none; &:focus { border-color: var(--rm-purple); } }

    .rc-cta { display: block; width: calc(100% - 32px); margin: 8px 16px 40px; height: 56px; border-radius: 16px; border: none; background: var(--rm-purple); color: #fff; font-size: 17px; font-weight: 800; cursor: pointer; font-family: 'Nunito', sans-serif; &:disabled { opacity: .5; } }
  `],
})
export class ReminderCreateComponent {
  protected nav  = inject(Router);
  private svc    = inject(ReminderService);
  private auth   = inject(AuthService);
  private toast  = inject(ToastController);

  titleVal  = '';
  dateVal   = new Date().toISOString().slice(0, 10);
  timeVal   = '09:00';
  notesVal  = '';
  repeatVal: RepeatType = 'none';

  readonly title          = computed(() => this.titleVal);
  readonly selectedCat    = signal<ReminderType>('general');
  readonly selectedDuration = signal<string>('');
  readonly forSelf        = signal(true);
  readonly notifType      = signal<NotifType>('notification');
  readonly saving         = signal(false);

  readonly quickChips = [
    { label: 'In 1h',     offsetH: 1,  offsetM: 0 },
    { label: 'In 3h',     offsetH: 3,  offsetM: 0 },
    { label: 'Today 6pm', offsetH: 0,  offsetM: 0, abs: '18:00' },
    { label: 'Tmr 9am',   offsetH: 24, offsetM: 0, abs: '09:00', nextDay: true },
    { label: 'Tmr noon',  offsetH: 24, offsetM: 0, abs: '12:00', nextDay: true },
  ];

  readonly durationChips = ['5m', '15m', '30m', '45m', '1h', '2h'];

  readonly categories = [
    { type: 'general'  as ReminderType, emoji: '📌', label: 'General',   color: '#6B7280' },
    { type: 'work'     as ReminderType, emoji: '💼', label: 'Work',      color: '#F59E0B' },
    { type: 'birthday' as ReminderType, emoji: '🎂', label: 'Birthday',  color: '#EC4899' },
    { type: 'medicine' as ReminderType, emoji: '💊', label: 'Medicine',  color: '#EF4444' },
    { type: 'bill'     as ReminderType, emoji: '💰', label: 'Bill',      color: '#3B82F6' },
    { type: 'study'    as ReminderType, emoji: '📚', label: 'Study',     color: '#10B981' },
    { type: 'wedding'  as ReminderType, emoji: '💍', label: 'Wedding',   color: '#8B5CF6' },
    { type: 'custom'   as ReminderType, emoji: '✨', label: 'Custom',    color: '#3D5AF1' },
  ];

  applyQuick(q: { label: string; offsetH: number; offsetM: number; abs?: string; nextDay?: boolean }): void {
    const now = new Date();
    if (q.abs) {
      if (q.nextDay) now.setDate(now.getDate() + 1);
      this.dateVal = now.toISOString().slice(0, 10);
      this.timeVal = q.abs;
    } else {
      now.setHours(now.getHours() + q.offsetH, now.getMinutes() + q.offsetM);
      this.dateVal = now.toISOString().slice(0, 10);
      this.timeVal = now.toTimeString().slice(0, 5);
    }
  }

  async save(): Promise<void> {
    if (!this.title().trim()) return;
    this.saving.set(true);

    const dto: CreateReminderDto = {
      title:            this.titleVal.trim(),
      type:             this.selectedCat(),
      date:             this.dateVal,
      time:             this.timeVal,
      repeatType:       this.repeatVal,
      description:      this.notesVal || undefined,
      notificationTypes: ['push'],
      priority:         'medium',
      nextFireAt:       new Date(`${this.dateVal}T${this.timeVal}:00`).toISOString(),
    };

    this.svc.create(dto).subscribe({
      next: async () => {
        this.saving.set(false);
        const t = await this.toast.create({ message: 'Reminder set!', duration: 1800, color: 'success', position: 'top' });
        await t.present();
        this.nav.navigate(['/app/reminders']);
      },
      error: async () => {
        this.saving.set(false);
        const t = await this.toast.create({ message: 'Failed to save', duration: 2000, color: 'danger', position: 'top' });
        await t.present();
      },
    });
  }
}
