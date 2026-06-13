// src/app/insights/insights.component.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonRefresher, IonRefresherContent, IonIcon, IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  flameOutline, trophyOutline, checkmarkDoneOutline, ribbonOutline,
  statsChartOutline, calendarOutline,
} from 'ionicons/icons';
import { InsightsService, InsightsSummary, Achievement } from '../core/services/insights.service';

@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonRefresher, IonRefresherContent, IonIcon,
    IonSegment, IonSegmentButton, IonLabel,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="page-header-inner">
          <div class="page-title">Productivity Insights</div>
          <div class="page-sub">Track your progress and achievements</div>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="insights-content">
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Stats grid -->
      <div class="stats-grid">
        <div class="istat" style="background:linear-gradient(135deg,#F97316,#EF4444)">
          <div class="istat-icon">🔥</div>
          <div class="istat-num">{{ summary()?.streak ?? 0 }}</div>
          <div class="istat-label">Day Streak</div>
        </div>
        <div class="istat" style="background:linear-gradient(135deg,#7C3AED,#9333EA)">
          <div class="istat-icon">🎯</div>
          <div class="istat-num">{{ summary()?.accountabilityRate ?? 0 }}%</div>
          <div class="istat-label">Accountability</div>
        </div>
        <div class="istat" style="background:linear-gradient(135deg,#10B981,#059669)">
          <div class="istat-icon">📈</div>
          <div class="istat-num">{{ summary()?.completedTotal ?? 0 }}</div>
          <div class="istat-label">Completed</div>
        </div>
        <div class="istat" style="background:linear-gradient(135deg,#F59E0B,#D97706)">
          <div class="istat-icon">🏆</div>
          <div class="istat-num">{{ summary()?.bestStreak ?? 0 }}</div>
          <div class="istat-label">Best Streak</div>
        </div>
      </div>

      <!-- Period selector -->
      <div class="period-row">
        <div class="section-title">Performance</div>
        <ion-segment [(ngModel)]="activePeriod" mode="ios" class="period-seg">
          <ion-segment-button value="week"><ion-label>Week</ion-label></ion-segment-button>
          <ion-segment-button value="month"><ion-label>Month</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      <!-- Weekly bar chart -->
      <div class="chart-wrap">
        <div class="chart-bars">
          @for (bar of weeklyBars(); track bar.label) {
            <div class="bar-col">
              <div class="bar-label-top">{{ bar.value }}</div>
              <div
                class="bar"
                [style.height.px]="bar.height"
                [class.bar-today]="bar.isToday"
              ></div>
              <div class="bar-label" [class.bar-label-today]="bar.isToday">
                {{ bar.label }}
              </div>
            </div>
          }
        </div>
        <div class="chart-baseline"></div>
      </div>

      <!-- Category breakdown -->
      <div class="section-title" style="margin-top:4px">By Category</div>
      <div class="category-breakdown">
        @for (cat of categoryBreakdown(); track cat.type) {
          <div class="cat-row">
            <span class="cat-emoji">{{ cat.emoji }}</span>
            <div class="cat-info">
              <div class="cat-name">{{ cat.label }}</div>
              <div class="cat-bar-wrap">
                <div class="cat-bar">
                  <div
                    class="cat-bar-fill"
                    [style.width.%]="cat.percentage"
                    [style.background]="cat.color"
                  ></div>
                </div>
                <span class="cat-pct">{{ cat.count }}</span>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Achievements -->
      <div class="section-title">Achievements</div>
      <div class="achievements-list">
        @for (ach of achievements(); track ach.id) {
          <div class="ach-card" [class.earned]="ach.earned" [class.locked]="!ach.earned">
            <div class="ach-emoji">{{ ach.emoji }}</div>
            <div class="ach-body">
              <div class="ach-name">{{ ach.name }}</div>
              @if (ach.earned) {
                <div class="ach-date">Earned on {{ ach.earnedAt | date:'MMM d, y' }}</div>
              } @else {
                <div class="ach-progress-wrap">
                  <div class="ach-progress-header">
                    <span class="ach-progress-label">Progress</span>
                    <span class="ach-pct">{{ ach.progress }}%</span>
                  </div>
                  <div class="ach-bar">
                    <div class="ach-bar-fill" [style.width.%]="ach.progress"></div>
                  </div>
                </div>
              }
            </div>
            @if (ach.earned) {
              <div class="ach-badge">✓</div>
            }
          </div>
        }
      </div>

      <div style="height:24px"></div>
    </ion-content>
  `,
  styles: [`
    .insights-content { --background: var(--rm-bg); }
    ion-toolbar { --background: var(--rm-bg); }
    .page-header-inner { padding: 20px 16px 4px; }
    .page-title { font-size: 26px; font-weight: 900; color: var(--rm-text-primary); }
    .page-sub { font-size: 13px; color: var(--rm-text-secondary); margin-top: 4px; }

    /* Stats grid */
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px 16px 4px; }
    .istat { border-radius: 20px; padding: 20px; cursor: default; }
    .istat-icon { font-size: 28px; margin-bottom: 8px; }
    .istat-num { font-size: 32px; font-weight: 900; color: white; line-height: 1; }
    .istat-label { font-size: 13px; color: rgba(255,255,255,0.85); margin-top: 4px; font-weight: 500; }

    /* Period row */
    .period-row { display: flex; align-items: center; justify-content: space-between; padding: 20px 16px 8px; }
    .section-title { font-size: 17px; font-weight: 800; color: var(--rm-text-primary); padding: 16px 16px 8px; }
    .period-seg { --background: var(--rm-border); border-radius: 10px; width: 160px; }
    ion-segment-button { --color: var(--rm-text-muted); --color-checked: var(--rm-purple); font-size: 12px; font-weight: 600; }

    /* Chart */
    .chart-wrap { background: var(--rm-card); margin: 0 16px 8px; border-radius: 20px; padding: 16px; box-shadow: var(--rm-shadow-sm); }
    .chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 120px; padding-bottom: 4px; }
    .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative; }
    .bar-label-top { font-size: 10px; color: var(--rm-text-muted); font-weight: 600; min-height: 14px; }
    .bar { width: 100%; border-radius: 8px 8px 0 0; background: linear-gradient(180deg, var(--rm-purple) 0%, #9333EA 100%); min-height: 4px; transition: height 0.4s cubic-bezier(0.34,1.56,0.64,1); }
    .bar.bar-today { background: linear-gradient(180deg, #EC4899 0%, #DB2777 100%); }
    .bar-label { font-size: 10px; color: var(--rm-text-muted); font-weight: 600; }
    .bar-label-today { color: #EC4899; font-weight: 800; }
    .chart-baseline { height: 1px; background: var(--rm-border); margin-top: 2px; }

    /* Category breakdown */
    .category-breakdown { padding: 0 16px 8px; display: flex; flex-direction: column; gap: 12px; }
    .cat-row { display: flex; align-items: center; gap: 10px; }
    .cat-emoji { font-size: 22px; flex-shrink: 0; }
    .cat-info { flex: 1; }
    .cat-name { font-size: 13px; font-weight: 600; color: var(--rm-text-primary); margin-bottom: 4px; }
    .cat-bar-wrap { display: flex; align-items: center; gap: 8px; }
    .cat-bar { flex: 1; height: 6px; background: var(--rm-border); border-radius: 3px; overflow: hidden; }
    .cat-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
    .cat-pct { font-size: 12px; font-weight: 700; color: var(--rm-text-muted); min-width: 20px; text-align: right; }

    /* Achievements */
    .achievements-list { padding: 0 16px; display: flex; flex-direction: column; gap: 10px; }
    .ach-card { background: var(--rm-card); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 14px; box-shadow: var(--rm-shadow-sm); position: relative; }
    .ach-card.earned { border: 2px solid #F59E0B; background: var(--rm-card); }
    .ach-card.locked { opacity: 0.7; }
    .ach-emoji { font-size: 32px; flex-shrink: 0; }
    .ach-body { flex: 1; }
    .ach-name { font-size: 15px; font-weight: 800; color: var(--rm-text-primary); margin-bottom: 3px; }
    .ach-date { font-size: 12px; color: var(--rm-text-muted); }
    .ach-badge { width: 24px; height: 24px; border-radius: 50%; background: #F59E0B; color: white; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ach-progress-wrap { margin-top: 4px; }
    .ach-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .ach-progress-label { font-size: 12px; color: var(--rm-text-muted); }
    .ach-pct { font-size: 12px; font-weight: 700; color: var(--rm-purple); }
    .ach-bar { height: 6px; background: var(--rm-border); border-radius: 3px; overflow: hidden; }
    .ach-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--rm-purple), #9333EA); transition: width 0.5s ease; }
  `],
})
export class InsightsComponent implements OnInit {
  private insightsService = inject(InsightsService);

  summary      = signal<InsightsSummary | null>(null);
  achievements = signal<Achievement[]>([]);
  activePeriod = 'week';

  readonly weeklyBars = computed(() => {
    const data  = this.summary()?.weeklyData ?? [];
    const max   = Math.max(...data.map(d => d.value), 1);
    const days  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const today = new Date().getDay(); // 0=Sun
    return days.map((label, i) => ({
      label,
      value:   data[i]?.value ?? 0,
      height:  Math.round(((data[i]?.value ?? 0) / max) * 90) + 4,
      isToday: (i + 1) % 7 === today % 7,
    }));
  });

  readonly categoryBreakdown = computed(() => {
    return this.summary()?.categoryBreakdown ?? [];
  });

  constructor() {
    addIcons({ flameOutline, trophyOutline, checkmarkDoneOutline, ribbonOutline, statsChartOutline, calendarOutline });
  }

  ngOnInit() { this.load(); }

  private load() {
    this.insightsService.getSummary().subscribe(data => this.summary.set(data));
    this.insightsService.getAchievements().subscribe(res => this.achievements.set(res.data ?? []));
  }

  doRefresh(event: CustomEvent) {
    this.insightsService.getSummary().subscribe({
      next: data => {
        this.summary.set(data);
        (event.target as HTMLIonRefresherElement).complete();
      },
      error: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }
}
