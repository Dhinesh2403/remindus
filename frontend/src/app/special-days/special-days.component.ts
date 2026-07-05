// src/app/special-days/special-days.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent, ToastController } from '@ionic/angular/standalone';
import { SpecialDayService, SpecialDayType } from '../core/services/special-day.service';
import { RmDateTimeComponent } from '../core/components/rm-datetime.component';

export type { SpecialDay } from '../core/services/special-day.service';

type SDFilter = 'All' | 'Birthdays' | 'Anniversaries' | 'Events';

@Component({
  selector: 'app-special-days',
  standalone: true,
  imports: [CommonModule, IonContent, IonRefresher, IonRefresherContent, RmDateTimeComponent],
  templateUrl: './special-days.component.html',
  styleUrl: './special-days.component.scss',
})
export class SpecialDaysComponent implements OnInit {
  protected nav       = inject(Router);
  private sdService   = inject(SpecialDayService);
  private toast       = inject(ToastController);

  readonly items    = this.sdService.items;
  readonly filter   = signal<SDFilter>('All');
  readonly showForm = signal(false);
  readonly saving   = signal(false);

  // New item form
  readonly form = signal({
    name: '', type: 'birthday' as SpecialDayType,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1, day: new Date().getDate(),
    note: '', color: '#3D5AF1',
  });

  readonly colors = ['#3D5AF1','#10B981','#F59E0B','#8B5CF6','#EF4444','#0D9488','#E0699B','#C99A1E'];
  readonly filters: SDFilter[] = ['All', 'Birthdays', 'Anniversaries', 'Events'];
  readonly months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  readonly featured = computed(() => {
    const upcoming = this.filteredItems().find(i => (i.daysUntil ?? 999) <= 30);
    return upcoming ?? this.filteredItems()[0] ?? null;
  });

  readonly filteredItems = computed(() => {
    const f = this.filter();
    if (f === 'All') return this.items();
    const type = f === 'Birthdays' ? 'birthday' : f === 'Anniversaries' ? 'anniversary' : 'event';
    return this.items().filter(i => i.type === type);
  });

  /** Form date as "YYYY-MM-DD" for the shared date field. */
  readonly dateValue = computed(() => {
    const f = this.form();
    return `${f.year}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`;
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.sdService.getAll().subscribe({ error: () => {} });
  }

  doRefresh(e: CustomEvent): void {
    const done = () => (e.target as HTMLIonRefresherElement).complete();
    this.sdService.getAll().subscribe({ complete: done, error: done });
  }

  setFilter(f: SDFilter): void { this.filter.set(f); }

  typeLabel(t: string): string {
    return t === 'birthday' ? 'Birthday' : t === 'anniversary' ? 'Anniversary' : 'Event';
  }

  countdownLabel(days: number | undefined): string {
    if (days === undefined) return '';
    if (days === 0) return 'Today!';
    return `in ${days} days`;
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  onDateChange(v: string): void {
    const [y, m, d] = v.split('-').map(Number);
    if (!y || !m || !d) return;
    this.form.update(f => ({ ...f, year: y, month: m, day: d }));
  }

  async saveSpecialDay(): Promise<void> {
    const f = this.form();
    if (!f.name.trim() || this.saving()) return;
    this.saving.set(true);
    this.sdService.create(f).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.resetForm();
      },
      error: async () => {
        this.saving.set(false);
        const t = await this.toast.create({ message: 'Could not save — please try again', duration: 2000, color: 'danger', position: 'top' });
        await t.present();
      },
    });
  }

  private resetForm(): void {
    this.form.set({
      name: '', type: 'birthday',
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1, day: new Date().getDate(),
      note: '', color: '#3D5AF1',
    });
  }

  updateForm(field: string, value: unknown): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }
}
