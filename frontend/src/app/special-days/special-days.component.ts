// src/app/special-days/special-days.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent, ToastController } from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs/operators';

export interface SpecialDay {
  _id: string;
  name: string;
  type: 'birthday' | 'anniversary' | 'event';
  month: number;
  day: number;
  note?: string;
  color?: string;
  year?: number;
  daysUntil?: number;
}

type SDFilter = 'All' | 'Birthdays' | 'Anniversaries' | 'Events';

@Component({
  selector: 'app-special-days',
  standalone: true,
  imports: [CommonModule, IonContent, IonRefresher, IonRefresherContent],
  templateUrl: './special-days.component.html',
  styleUrl: './special-days.component.scss',
})
export class SpecialDaysComponent implements OnInit {
  protected nav  = inject(Router);
  private http   = inject(HttpClient);
  private toast  = inject(ToastController);
  protected Math = Math;

  readonly items    = signal<SpecialDay[]>([]);
  readonly filter   = signal<SDFilter>('All');
  readonly showForm = signal(false);

  // New item form
  readonly form = signal({
    name: '', type: 'birthday' as 'birthday' | 'anniversary' | 'event',
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

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<{ success: boolean; data: SpecialDay[] }>(`${environment.apiUrl}/special-days`)
      .pipe(tap(r => this.items.set(r.data ?? [])))
      .subscribe();
  }

  doRefresh(e: CustomEvent): void {
    this.http.get<{ success: boolean; data: SpecialDay[] }>(`${environment.apiUrl}/special-days`)
      .pipe(tap(r => this.items.set(r.data ?? [])))
      .subscribe({ complete: () => (e.target as HTMLIonRefresherElement).complete() });
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

  async saveSpecialDay(): Promise<void> {
    const f = this.form();
    if (!f.name.trim()) return;
    this.http.post<{ success: boolean; data: SpecialDay }>(`${environment.apiUrl}/special-days`, f)
      .subscribe({
        next: (res) => {
          this.items.update(i => [...i, res.data]);
          this.showForm.set(false);
        },
      });
  }

  updateForm(field: string, value: unknown): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }
}
