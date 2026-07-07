// src/app/tasks/task-create/task-create.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { TaskService } from '../../core/services/task.service';
import { TimeService } from '../../core/services/time.service';
import { FriendService, Friend } from '../../core/services/friend.service';
import { RmDateTimeComponent } from '../../core/components/rm-datetime.component';

type Priority = 'low' | 'medium' | 'high';
type RepeatOpt = 'Does not repeat' | 'Daily' | 'Weekly' | 'Monthly';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, RmDateTimeComponent],
  templateUrl: './task-create.component.html',
  styleUrl: './task-create.component.scss',
})
export class TaskCreateComponent implements OnInit {
  protected nav    = inject(Router);
  private route   = inject(ActivatedRoute);
  private taskSvc = inject(TaskService);
  private friendSvc = inject(FriendService);
  private toast  = inject(ToastController);
  private time   = inject(TimeService);

  // Preload with trusted now + 5 min (server-synced, not the raw device clock).
  private readonly initAt = this.time.plusMinutes(5);
  title       = signal('');
  notes       = signal('');
  priority    = signal<Priority>('medium');
  category    = signal('Personal');
  dueDate     = signal(this.initAt.date);
  startTime   = signal(this.initAt.time);
  estimatedTime = signal<number | null>(null);
  reminderType  = signal<'notification' | 'alarm' | 'none'>('notification');
  repeat        = signal<RepeatOpt>('Does not repeat');
  subtasks      = signal<string[]>([]);
  newSubtask    = signal('');
  isSaving      = signal(false);
  // Set when we arrive from the friend activity page (?assignTo=): return there after save.
  private returnToFriendId: string | null = null;

  // Assign-to-friend (parity with the reminder create page)
  readonly forSelf          = signal(true);
  readonly friends          = signal<Friend[]>([]);
  readonly selectedFriend   = signal<string | null>(null);
  readonly friendPickerOpen = signal(false);
  readonly friendQuery      = signal('');
  readonly selectedFriendObj = computed(() =>
    this.friends().find(f => f._id === this.selectedFriend()) ?? null
  );
  readonly filteredFriends = computed(() => {
    const q = this.friendQuery().trim().toLowerCase();
    if (!q) return this.friends();
    return this.friends().filter(f =>
      f.name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)
    );
  });

  readonly categories = ['Personal', 'Work', 'Health', 'Finance', 'Family', 'Travel', 'Shopping'];
  readonly priorities: { value: Priority; label: string; color: string }[] = [
    { value: 'low',    label: 'Low',    color: '#10B981' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high',   label: 'High',   color: '#EF4444' },
  ];
  readonly estimatedOptions = [10, 15, 30, 45, 60];
  readonly repeatOptions: RepeatOpt[] = ['Does not repeat', 'Daily', 'Weekly', 'Monthly'];

  ngOnInit(): void {
    // ?assignTo=<friendId> (from the friend activity page) → pre-select that friend.
    const assignTo = this.route.snapshot.queryParamMap.get('assignTo');
    this.friendSvc.getFriends().subscribe({
      next: ({ friends }) => {
        this.friends.set(friends);
        if (assignTo && friends.some(f => f._id === assignTo)) {
          this.forSelf.set(false);
          this.selectedFriend.set(assignTo);
          this.returnToFriendId = assignTo;
        }
      },
      error: () => {},
    });
  }

  // ── Assign-to-friend ──────────────────────────────────────────────────
  selectFriendMode(): void {
    this.forSelf.set(false);
    if (!this.selectedFriend()) {
      if (this.friends().length === 1) {
        this.selectedFriend.set(this.friends()[0]._id);
      } else if (this.friends().length > 1) {
        this.openFriendPicker();
      }
    }
  }

  openFriendPicker(): void {
    this.friendQuery.set('');
    this.friendPickerOpen.set(true);
  }

  pickFriend(f: Friend): void {
    this.selectedFriend.set(f._id);
    this.friendPickerOpen.set(false);
  }

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
    if (!this.forSelf() && !this.selectedFriend()) {
      const t = await this.toast.create({ message: 'Please choose a friend', duration: 2000, color: 'warning', position: 'top' });
      await t.present();
      return;
    }
    this.isSaving.set(true);
    const assignedTo = this.forSelf() ? undefined : this.selectedFriend() ?? undefined;
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
      assignedTo,
    }).subscribe({
      next: async () => {
        const friendName = this.selectedFriendObj()?.name;
        const t = await this.toast.create({
          message: this.forSelf() ? 'Task saved' : `Task sent to ${friendName ?? 'friend'}!`,
          duration: 1800, color: 'success', position: 'top',
        });
        await t.present();
        if (this.returnToFriendId && assignedTo === this.returnToFriendId) {
          this.nav.navigate(['/app/friends', this.returnToFriendId, 'activity']);
        } else {
          this.nav.navigate(['/app/tasks']);
        }
      },
      error: async () => {
        this.isSaving.set(false);
        const t = await this.toast.create({ message: 'Failed to save task', duration: 2000, color: 'danger', position: 'top' });
        await t.present();
      },
    });
  }
}
