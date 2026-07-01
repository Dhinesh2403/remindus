// src/app/search/search.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
  template: `
    <ion-content class="search-content">
      <div class="search-bar-wrap">
        <input #searchInput class="search-input" placeholder="Search everything..."
               [(ngModel)]="query" (input)="onSearch()" autofocus />
        <button class="search-done" (click)="nav.navigate(['/app/home'])">Done</button>
      </div>
      @if (results().length === 0 && query.length > 1) {
        <div class="search-empty">No results for "{{ query }}"</div>
      }
      <div class="search-results">
        @for (r of results(); track r.id) {
          <div class="search-result-item" (click)="nav.navigate([r.route])">
            <div class="search-result-icon" [style.background]="r.iconBg" [style.color]="r.iconColor">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path [attr.d]="r.iconPath" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            </div>
            <div class="search-result-body">
              <div class="search-result-title">{{ r.title }}</div>
              <div class="search-result-type">{{ r.type }}</div>
            </div>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    :host { display: block; }
    .search-content { --background: var(--rm-bg); }
    .search-bar-wrap {
      display: flex; align-items: center; gap: 12px;
      padding: calc(env(safe-area-inset-top) + 10px) 16px 10px;
      background: var(--rm-card); border-bottom: 1px solid var(--rm-border);
    }
    .search-input {
      flex: 1; height: 42px; border-radius: 12px; border: none;
      background: var(--rm-surface); padding: 0 14px; font-size: 15px;
      color: var(--rm-text-primary); outline: none; font-family: inherit;
      &::placeholder { color: var(--rm-text-muted); }
    }
    .search-done { border: none; background: none; color: var(--rm-purple); font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; padding: 0; }
    .search-empty { padding: 40px 16px; text-align: center; color: var(--rm-text-muted); font-size: 15px; }
    .search-results { padding: 8px 16px; }
    .search-result-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--rm-border); cursor: pointer; }
    .search-result-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .search-result-title { font-size: 14.5px; font-weight: 600; color: var(--rm-text-primary); }
    .search-result-type  { font-size: 12px; color: var(--rm-text-muted); margin-top: 2px; }
  `],
})
export class SearchComponent {
  protected nav = inject(Router);
  query = '';
  readonly results = signal<{ id: string; title: string; type: string; route: string; iconBg: string; iconColor: string; iconPath: string }[]>([]);

  onSearch(): void {
    if (this.query.length < 2) { this.results.set([]); return; }
    // Placeholder — in production this calls the API
    this.results.set([]);
  }
}
