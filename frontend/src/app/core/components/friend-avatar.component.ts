// src/app/core/components/friend-avatar.component.ts
// Circular avatar used across Friends/Chat: shows the profile photo when one
// exists, otherwise a flat illustrated placeholder picked by gender
// (male / female / neutral for unset or 'other').
import { Component, Input, signal } from '@angular/core';

export type AvatarGender = 'male' | 'female' | 'other' | null | undefined;

@Component({
  selector: 'app-friend-avatar',
  standalone: true,
  template: `
    <div class="fav" [style.width.px]="size" [style.height.px]="size">
      @if (avatar && !imgFailed()) {
        <img class="fav-img" [src]="avatar" [alt]="name" (error)="imgFailed.set(true)" />
      } @else if (gender === 'male') {
        <!-- Male — short crop, brand-blue tee on a cool sky gradient -->
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="favBgM" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#DBEAFE"/><stop offset="1" stop-color="#BFD3FE"/>
            </linearGradient>
          </defs>
          <rect width="64" height="64" fill="url(#favBgM)"/>
          <path d="M12 64 Q12 45 32 45 Q52 45 52 64 Z" fill="#3D5AF1"/>
          <path d="M25 42 Q32 47 39 42 L39 47 Q32 52 25 47 Z" fill="#FFFFFF" opacity=".28"/>
          <rect x="27" y="33" width="10" height="9" rx="4" fill="#E8AE85"/>
          <ellipse cx="32" cy="25.5" rx="11" ry="11.5" fill="#F2C29B"/>
          <path d="M20.6 26 Q19.5 11.5 32 11.5 Q44.5 11.5 43.4 26 Q43 20.5 39.5 18.6 Q34 15.6 27.5 18.2 Q21.6 20.4 20.6 26 Z" fill="#33395B"/>
          <ellipse cx="20.8" cy="27" rx="1.9" ry="2.6" fill="#F2C29B"/>
          <ellipse cx="43.2" cy="27" rx="1.9" ry="2.6" fill="#F2C29B"/>
        </svg>
      } @else if (gender === 'female') {
        <!-- Female — flowing hair, rose top on a warm blush gradient -->
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="favBgF" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#FCE7F3"/><stop offset="1" stop-color="#F8CBDD"/>
            </linearGradient>
          </defs>
          <rect width="64" height="64" fill="url(#favBgF)"/>
          <path d="M15 64 Q13 26 32 26 Q51 26 49 64 Z" fill="#6B4A3F"/>
          <path d="M13 64 Q13 45 32 45 Q51 45 51 64 Z" fill="#EF7BA5"/>
          <path d="M25.5 42 Q32 47 38.5 42 L38.5 47 Q32 52 25.5 47 Z" fill="#FFFFFF" opacity=".3"/>
          <rect x="27" y="33" width="10" height="9" rx="4" fill="#E8AE85"/>
          <ellipse cx="32" cy="25.5" rx="10.6" ry="11.2" fill="#F2C29B"/>
          <path d="M21.5 30 Q19.8 11 32 11 Q44.2 11 42.5 30 Q42.8 22 38.8 19.8 Q40.5 24 39.8 28 Q37 20.6 30.2 19.4 Q24.4 18.5 23.4 24.4 Q22 27 21.5 30 Z" fill="#6B4A3F"/>
          <path d="M20.5 27 Q18 38 22.5 43 Q24.8 40 23.6 33 Q23 29.5 20.5 27 Z" fill="#6B4A3F"/>
          <path d="M43.5 27 Q46 38 41.5 43 Q39.2 40 40.4 33 Q41 29.5 43.5 27 Z" fill="#6B4A3F"/>
        </svg>
      } @else {
        <!-- Neutral — soft indigo silhouette for unset / other -->
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="favBgN" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#EEF0FE"/><stop offset="1" stop-color="#DCE1FD"/>
            </linearGradient>
            <linearGradient id="favFgN" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#8B96F8"/><stop offset="1" stop-color="#6C7BF3"/>
            </linearGradient>
          </defs>
          <rect width="64" height="64" fill="url(#favBgN)"/>
          <circle cx="32" cy="25" r="12" fill="url(#favFgN)"/>
          <path d="M11 64 Q11 44 32 44 Q53 44 53 64 Z" fill="url(#favFgN)"/>
        </svg>
      }
    </div>
  `,
  styles: [`
    :host{display:block;flex-shrink:0}
    .fav{border-radius:50%;overflow:hidden;background:var(--rm-surface)}
    .fav-img,.fav svg{width:100%;height:100%;display:block;object-fit:cover}
  `],
})
export class FriendAvatarComponent {
  @Input() name = '';
  @Input() avatar: string | null | undefined = null;
  @Input() gender: AvatarGender = null;
  @Input() size = 48;

  /** Falls back to the illustration if the photo URL is broken. */
  readonly imgFailed = signal(false);
}
