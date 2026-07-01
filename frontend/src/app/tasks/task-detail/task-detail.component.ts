// src/app/tasks/task-detail/task-detail.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TaskService, Task } from '../../core/services/task.service';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, IonContent],
  template: `
    <ion-content class="td-content">
      <div class="td-header">
        <button class="td-back" (click)="nav.navigate(['/app/tasks'])">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="td-delete" (click)="deleteTask()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#EF4444" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      @if (task()) {
        <div class="td-body">
          <h1 class="td-title" [class.done]="task()!.status === 'done'">{{ task()!.title }}</h1>
          <div class="td-info-list">
            @if (task()!.dueDate) {
              <div class="td-info-row">
                <div class="td-info-icon cal"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div>
                <div><div class="td-info-lbl">Date &amp; time</div><div class="td-info-val">{{ task()!.dueDate | date:'MMM d, yyyy' }}{{ task()!.startTime ? ', ' + task()!.startTime : '' }}</div></div>
              </div>
            }
            <div class="td-info-row">
              <div class="td-info-icon work"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" stroke-width="1.7"/></svg></div>
              <div><div class="td-info-lbl">List</div><div class="td-info-val">{{ task()!.category || 'Personal' }}</div></div>
            </div>
            <div class="td-info-row">
              <div class="td-info-icon" [class]="task()!.priority">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 9v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.7"/></svg>
              </div>
              <div><div class="td-info-lbl">Priority</div><div class="td-info-val">{{ task()!.priority | titlecase }}</div></div>
            </div>
          </div>
          @if (task()!.notes) {
            <div class="td-notes-section">
              <div class="td-notes-label">NOTES</div>
              <p class="td-notes">{{ task()!.notes }}</p>
            </div>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    :host { display: block; }
    .td-content { --background: var(--rm-bg); }
    .td-header { display: flex; align-items: center; justify-content: space-between; padding: calc(env(safe-area-inset-top) + 12px) 16px 12px; }
    .td-back, .td-delete { width: 38px; height: 38px; border-radius: 10px; border: none; background: var(--rm-surface); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--rm-text-primary); }
    .td-body { padding: 16px; }
    .td-title { font-size: 22px; font-weight: 800; color: var(--rm-text-primary); margin: 0 0 20px; font-family: 'Nunito', sans-serif; }
    .td-title.done { text-decoration: line-through; color: var(--rm-text-muted); }
    .td-info-list { display: flex; flex-direction: column; gap: 0; background: var(--rm-card); border-radius: 16px; overflow: hidden; box-shadow: var(--rm-shadow-sm); }
    .td-info-row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-bottom: 1px solid var(--rm-border); }
    .td-info-row:last-child { border-bottom: none; }
    .td-info-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .td-info-icon.cal  { background: rgba(59,130,246,0.12); color: #3B82F6; }
    .td-info-icon.work { background: rgba(245,158,11,0.12); color: #F59E0B; }
    .td-info-icon.low    { background: rgba(16,185,129,0.12); color: #10B981; }
    .td-info-icon.medium { background: rgba(245,158,11,0.12); color: #F59E0B; }
    .td-info-icon.high   { background: rgba(239,68,68,0.12);  color: #EF4444; }
    .td-info-lbl { font-size: 11px; font-weight: 600; color: var(--rm-text-muted); text-transform: uppercase; letter-spacing: .4px; }
    .td-info-val { font-size: 15px; font-weight: 700; color: var(--rm-text-primary); margin-top: 2px; }
    .td-notes-section { margin-top: 20px; }
    .td-notes-label { font-size: 11px; font-weight: 700; letter-spacing: .5px; color: var(--rm-text-muted); margin-bottom: 8px; }
    .td-notes { font-size: 14px; color: var(--rm-text-secondary); line-height: 1.6; margin: 0; }
  `],
})
export class TaskDetailComponent implements OnInit {
  protected nav = inject(Router);
  private route  = inject(ActivatedRoute);
  private taskSvc = inject(TaskService);

  readonly task = signal<Task | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.taskSvc.getTask(id).subscribe(res => this.task.set(res.data));
  }

  deleteTask(): void {
    const id = this.task()?._id;
    if (!id) return;
    this.taskSvc.deleteTask(id).subscribe(() => this.nav.navigate(['/app/tasks']));
  }
}
