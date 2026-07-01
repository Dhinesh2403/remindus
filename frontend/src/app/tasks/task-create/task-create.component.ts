// src/app/tasks/task-create/task-create.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { TaskService } from '../../core/services/task.service';

type Priority = 'low' | 'medium' | 'high';
type RepeatOpt = 'Does not repeat' | 'Daily' | 'Weekly' | 'Monthly';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
  templateUrl: './task-create.component.html',
  styleUrl: './task-create.component.scss',
})
export class TaskCreateComponent {
  protected nav    = inject(Router);
  private taskSvc = inject(TaskService);
  private toast  = inject(ToastController);

  title       = signal('');
  notes       = signal('');
  priority    = signal<Priority>('medium');
  category    = signal('Personal');
  dueDate     = signal('');
  startTime   = signal('');
  estimatedTime = signal<number | null>(null);
  reminderType  = signal<'notification' | 'alarm' | 'none'>('notification');
  repeat        = signal<RepeatOpt>('Does not repeat');
  subtasks      = signal<string[]>([]);
  newSubtask    = signal('');
  isSaving      = signal(false);

  readonly categories = ['Personal', 'Work', 'Health', 'Finance', 'Family', 'Travel', 'Shopping'];
  readonly priorities: { value: Priority; label: string; color: string }[] = [
    { value: 'low',    label: 'Low',    color: '#10B981' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high',   label: 'High',   color: '#EF4444' },
  ];
  readonly estimatedOptions = [10, 15, 30, 45, 60];
  readonly repeatOptions: RepeatOpt[] = ['Does not repeat', 'Daily', 'Weekly', 'Monthly'];

  addSubtask(): void {
    const t = this.newSubtask().trim();
    if (t) {
      this.subtasks.update(s => [...s, t]);
      this.newSubtask.set('');
    }
  }

  removeSubtask(i: number): void {
    this.subtasks.update(s => s.filter((_, idx) => idx !== i));
  }

  async save(): Promise<void> {
    if (!this.title().trim()) {
      const t = await this.toast.create({ message: 'Please enter a title', duration: 2000, color: 'warning', position: 'top' });
      await t.present();
      return;
    }
    this.isSaving.set(true);
    this.taskSvc.createTask({
      title:         this.title().trim(),
      notes:         this.notes(),
      priority:      this.priority(),
      category:      this.category(),
      dueDate:       this.dueDate() || undefined,
      startTime:     this.startTime() || undefined,
      estimatedMin:  this.estimatedTime() ?? undefined,
      reminderType:  this.reminderType(),
      repeat:        this.repeat(),
      subtasks:      this.subtasks().map(t => ({ title: t, done: false })),
    }).subscribe({
      next: async () => {
        const t = await this.toast.create({ message: 'Task saved', duration: 1800, color: 'success', position: 'top' });
        await t.present();
        this.nav.navigate(['/app/tasks']);
      },
      error: async () => {
        this.isSaving.set(false);
        const t = await this.toast.create({ message: 'Failed to save task', duration: 2000, color: 'danger', position: 'top' });
        await t.present();
      },
    });
  }
}
