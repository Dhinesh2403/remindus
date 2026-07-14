// src/app/dashboard/dashboard.component.ts
import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/services/auth.service';
import { ReminderService, ReceivedReminder, ReminderType } from '../core/services/reminder.service';
import { CountUpDirective } from '../core/directives/count-up.directive';
import { FriendAvatarComponent } from '../core/components/friend-avatar.component';
import { TimeAmPmPipe } from '../core/pipes/time-ampm.pipe';

type DashTab = 'dashboard' | 'today' | 'upcoming';

// Emoji per reminder category, mirrored from the reminders list.
const CATEGORY_EMOJI: Record<ReminderType, string> = {
  birthday: '🎂', wedding: '💍', medicine: '💊', bill: '💰', study: '📚',
  work: '💼', general: '📌', custom: '✨', personal: '👤', health: '❤️',
  finance: '💵', family: '👨‍👩‍👧', travel: '✈️', shopping: '🛒',
};

interface DashModule {
  label: string;
  sub: string;
  icon: string;
  route: string;
  color: string;
  bg: string;
  comingSoon?: boolean;
}

interface UpcomingItem {
  id: string;
  title: string;
  category: string;
  color: string;
  time: string;
  starred?: boolean;
  group: 'tomorrow' | 'week';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, IonContent, IonRefresher, IonRefresherContent, CountUpDirective, FriendAvatarComponent, TimeAmPmPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  protected nav = inject(Router);
  private authService = inject(AuthService);
  private reminderService = inject(ReminderService);
  private toast = inject(ToastController);

  readonly currentUser = this.authService.currentUser;
  readonly todayCount = this.reminderService.todayCount;
  readonly upcomingCount = this.reminderService.upcomingCount;
  readonly missedCount = this.reminderService.missedCount;
  readonly completionRate = this.reminderService.completionRate;

  readonly activeTab = signal<DashTab>('dashboard');

  // Replays entrance animations on every tab visit (see .pg-in in global.scss)
  readonly pageIn = signal(true);

  // ── Reminders friends sent me ─────────────────────────────────────────────
  // Surfaced right on Home so they're never buried behind the Reminders → Shared
  // sub-tab. Only the active ones (not completed / skipped), soonest first.
  private readonly activeFromFriends = computed(() =>
    [...this.reminderService.receivedReminders()]
      .filter(r => r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped')
      .sort((a, b) => this.dueTime(a) - this.dueTime(b))
  );

  readonly friendReminderCount = computed(() => this.activeFromFriends().length);
  // Preview the first few on the card; the rest are one tap away via "See all".
  readonly friendRemindersPreview = computed(() => this.activeFromFriends().slice(0, 3));

  private dueTime(r: ReceivedReminder): number {
    const t = new Date(`${String(r.date).slice(0, 10)}T${r.time}`).getTime();
    return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  }

  categoryEmoji(type: ReminderType): string {
    return CATEGORY_EMOJI[type] ?? CATEGORY_EMOJI.general;
  }

  senderFirstName(r: ReceivedReminder): string {
    return r.userId?.name?.split(' ')[0] ?? 'Friend';
  }

  ionViewWillEnter(): void {
    this.pageIn.set(true);
    // Keep the "From Friends" card fresh on every return to Home.
    this.reminderService.getReceived().subscribe();
  }
  ionViewDidLeave(): void  { this.pageIn.set(false); }

  readonly firstName = computed(() => {
    const name = this.currentUser()?.name ?? '';
    return name.split(' ')[0] || 'there';
  });

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  get todayDateLabel(): string {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  readonly modules: DashModule[] = [
    // ── Live modules ──────────────────────────────────────────────────────
    { label: 'Reminders',     sub: 'Never miss a thing',    icon: 'bell',     route: '/app/reminders',    color: '#E07A2B', bg: 'rgba(224,122,43,0.10)' },
    { label: 'Tasks',         sub: 'Track to-dos & subtasks', icon: 'check',  route: '/app/tasks',        color: '#3D9970', bg: 'rgba(61,153,112,0.10)' },
    { label: 'Special Days',  sub: 'Birthdays & events',    icon: 'heart',    route: '/app/special-days', color: '#E0699B', bg: 'rgba(224,105,155,0.10)' },
    { label: 'Quick Alarms',  sub: 'One-tap timers',        icon: 'alarm',    route: '/app/quick-alarms', color: '#0D9488', bg: 'rgba(13,148,136,0.10)' },
    { label: 'Notes',         sub: 'Jot it down, keep it close', icon: 'note', route: '/app/notes',       color: '#3D5AF1', bg: 'rgba(61,90,241,0.10)' },
    { label: 'Calendar',      sub: 'Sync Google & device',  icon: 'calendar', route: '/app/calendar',     color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
    // ── Coming soon ───────────────────────────────────────────────────────
    { label: 'Daily Plan',    sub: 'Coming soon',   icon: 'clock',    route: '/app/daily-plan', color: '#3D5AF1', bg: 'rgba(61,90,241,0.10)',  comingSoon: true },
    { label: 'Habits',        sub: 'Coming soon',   icon: 'repeat',   route: '/app/habits',     color: '#E0732B', bg: 'rgba(224,115,43,0.10)', comingSoon: true },
    { label: 'Goals',         sub: 'Coming soon',   icon: 'flag',     route: '/app/goals',      color: '#7B61D8', bg: 'rgba(123,97,216,0.10)', comingSoon: true },
    { label: 'Grocery List',  sub: 'Coming soon',   icon: 'cart',     route: '/app/grocery',    color: '#16A34A', bg: 'rgba(22,163,74,0.10)',  comingSoon: true },
    { label: 'Finance',       sub: 'Coming soon',   icon: 'coin',     route: '/app/finance',    color: '#CA8A04', bg: 'rgba(202,138,4,0.10)',  comingSoon: true },
  ];

  // Mock today items — will be replaced by real data from TaskService
  readonly todayItems = computed(() => [
    { id: '1', title: 'Morning meds – Vitamin D', category: 'Health',   time: '8:00 AM',  color: '#EF4444', done: true  },
    { id: '2', title: 'Team standup',              category: 'Work',     time: '10:30 AM', color: '#F59E0B', done: true  },
    { id: '3', title: 'Review Q2 budget report',  category: 'Work',     time: '9:00 AM',  color: '#F59E0B', done: false, starred: true },
    { id: '4', title: 'Invest SIP this month',    category: 'Finance',  time: '11:00 AM', color: '#3B82F6', done: false },
  ]);

  readonly todayDoneCount = computed(() => this.todayItems().filter(i => i.done).length);
  readonly todayProgress = computed(() => {
    const items = this.todayItems();
    return items.length ? Math.round((this.todayDoneCount() / items.length) * 100) : 0;
  });

  readonly upcomingGroups = computed(() => [
    {
      label: 'TOMORROW',
      items: [
        { id: 'u1', title: 'Dentist appointment', time: 'Tomorrow, 11:00 AM', color: '#3D5AF1' },
        { id: 'u2', title: 'Submit report',        time: 'Tomorrow, 4:00 PM',  color: '#3D9970' },
      ],
    },
    {
      label: 'THIS WEEK',
      items: [
        { id: 'u3', title: 'Weekend grocery run', time: 'Sat, 10:00 AM', color: '#E07A2B' },
        { id: 'u4', title: 'Pay rent',            time: 'Jun 30, 9:00 AM', color: '#E0699B' },
      ],
    },
  ]);

  setTab(tab: DashTab): void {
    this.activeTab.set(tab);
  }

  ngOnInit(): void {
    this.reminderService.loadStats().subscribe();
    this.reminderService.getReceived().subscribe();
  }

  doRefresh(event: CustomEvent): void {
    Promise.all([
      this.reminderService.loadStats().toPromise(),
      this.reminderService.getReceived().toPromise(),
    ]).finally(() => (event.target as HTMLIonRefresherElement).complete());
  }

  /** Open the Reminders → Shared tab (where "From Friends" lives). */
  openFriendReminders(): void {
    this.reminderService.requestTab('shared', 'from');
    this.nav.navigate(['/app/reminders']);
  }

  async completeFriendReminder(r: ReceivedReminder, ev: Event): Promise<void> {
    ev.stopPropagation();
    this.reminderService.updateSharedStatus(r._id, 'completed').subscribe({
      next: async () => {
        const t = await this.toast.create({
          message: `✅ "${r.title}" marked as completed!`,
          duration: 2000, color: 'success', position: 'top',
        });
        await t.present();
      },
    });
  }

  openSearch(): void {
    this.nav.navigate(['/app/search']);
  }

  async openModule(mod: DashModule): Promise<void> {
    if (mod.comingSoon) {
      const t = await this.toast.create({ message: 'Coming soon', duration: 1600, position: 'top' });
      await t.present();
      return;
    }
    this.nav.navigate([mod.route]);
  }
}
