// src/app/tasks/tasks.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { TaskService } from '../core/services/task.service';

type TaskTab = 'all' | 'active' | 'done';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, IonContent, IonRefresher, IonRefresherContent],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  protected nav = inject(Router);
  private taskService = inject(TaskService);

  readonly tasks = this.taskService.tasks;
  readonly activeTab = signal<TaskTab>('all');
  readonly selectedCategory = signal<string>('All Categories');
  readonly searchQuery = signal<string>('');

  readonly stats = computed(() => {
    const all = this.tasks();
    return {
      active:  all.filter(t => t.status !== 'done').length,
      done:    all.filter(t => t.status === 'done').length,
      highPri: all.filter(t => t.status !== 'done' && t.priority === 'high').length,
      total:   all.length,
    };
  });

  readonly filteredTasks = computed(() => {
    const tab = this.activeTab();
    const q   = this.searchQuery().toLowerCase();
    let list  = this.tasks();

    if (tab === 'active') list = list.filter(t => t.status !== 'done');
    if (tab === 'done')   list = list.filter(t => t.status === 'done');
    if (q) list = list.filter(t => t.title.toLowerCase().includes(q));
    return list;
  });

  readonly tabCounts = computed(() => ({
    all:    this.tasks().length,
    active: this.tasks().filter(t => t.status !== 'done').length,
    done:   this.tasks().filter(t => t.status === 'done').length,
  }));

  ngOnInit(): void {
    this.taskService.loadTasks().subscribe();
  }

  setTab(tab: TaskTab): void { this.activeTab.set(tab); }

  toggleDone(taskId: string, event: Event): void {
    event.stopPropagation();
    this.taskService.toggleDone(taskId).subscribe();
  }

  openTask(id: string): void { this.nav.navigate(['/app/tasks', id]); }

  doRefresh(event: CustomEvent): void {
    this.taskService.loadTasks().subscribe({
      complete: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }

  priorityColor(p: string): string {
    return p === 'high' ? '#EF4444' : p === 'medium' ? '#F59E0B' : '#10B981';
  }

  priorityLabel(p: string): string {
    return p === 'high' ? 'High' : p === 'medium' ? 'Medium' : 'Low';
  }

  formatDate(d: string | Date | undefined): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatTime(t: string | undefined): string { return t ?? ''; }
}
