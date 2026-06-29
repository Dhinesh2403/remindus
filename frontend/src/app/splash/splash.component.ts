// src/app/splash/splash.component.ts
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

/**
 * Brand splash shown on cold start. Auto-advances after a short delay, but is
 * also tappable to skip. Routes to the app when a session exists, otherwise to
 * login.
 */
@Component({
  selector: 'app-splash',
  standalone: true,
  templateUrl: './splash.component.html',
  styleUrl: './splash.component.scss',
})
export class SplashComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);

  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.timer = setTimeout(() => this.advance(), 1600);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  advance(): void {
    clearTimeout(this.timer);
    const target = this.authService.isAuthenticated() ? '/app/home' : '/auth/login';
    this.router.navigateByUrl(target);
  }
}
