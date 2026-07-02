// src/app/dashboard/dashboard.component.ts
import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/services/auth.service';
import { ReminderService } from '../core/services/reminder.service';
import { CountUpDirective } from '../core/directives/count-up.directive';

type DashTab = 'dashboard' | 'today' | 'upcoming';

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
  imports: [CommonModule, IonContent, IonRefresher, IonRefresherContent, CountUpDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  protected nav = inject(Router);
  private authService = inject(AuthService);
  private reminderService = inject(ReminderService);

  readonly currentUser = this.authService.currentUser;
  readonly todayCount = this.reminderService.todayCount;
  readonly upcomingCount = this.reminderService.upcomingCount;
  readonly missedCount = this.reminderService.missedCount;
  readonly completionRate = this.reminderService.completionRate;

  readonly activeTab = signal<DashTab>('dashboard');

  // Replays entrance animations on every tab visit (see .pg-in in global.scss)
  readonly pageIn = signal(true);

  ionViewWillEnter(): void { this.pageIn.set(true); }
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

  readonly modules = [
    { label: 'Daily Plan',    sub: 'Time-block your day',   icon: 'clock',    route: '/app/daily-plan',   color: '#3D5AF1', bg: 'rgba(61,90,241,0.10)' },
    { label: 'Tasks',         sub: 'Track to-dos & subtasks', icon: 'check',  route: '/app/tasks',        color: '#3D9970', bg: 'rgba(61,153,112,0.10)' },
    { label: 'Reminders',     sub: 'Never miss a thing',    icon: 'bell',     route: '/app/reminders',    color: '#E07A2B', bg: 'rgba(224,122,43,0.10)' },
    { label: 'Habits',        sub: 'Build streaks',          icon: 'repeat',  route: '/app/habits',       color: '#E0732B', bg: 'rgba(224,115,43,0.10)' },
    { label: 'Goals',         sub: 'Plan the big picture',  icon: 'flag',     route: '/app/goals',        color: '#7B61D8', bg: 'rgba(123,97,216,0.10)' },
    { label: 'Calendar',      sub: 'Sync Google & device',  icon: 'calendar', route: '/app/calendar',     color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
    { label: 'Sticky Notes',  sub: 'Jot it down',           icon: 'note',     route: '/app/notes',        color: '#C99A1E', bg: 'rgba(201,154,30,0.10)' },
    { label: 'Special Days',  sub: 'Birthdays & events',    icon: 'heart',    route: '/app/special-days', color: '#E0699B', bg: 'rgba(224,105,155,0.10)' },
    { label: 'Quick Alarms',  sub: 'One-tap timers',        icon: 'alarm',    route: '/app/quick-alarms', color: '#0D9488', bg: 'rgba(13,148,136,0.10)' },
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
  }

  doRefresh(event: CustomEvent): void {
    this.reminderService.loadStats().subscribe({
      complete: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }

  openSearch(): void {
    this.nav.navigate(['/app/search']);
  }
}
