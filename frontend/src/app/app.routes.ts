// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },

  // ─── Auth Shell (no bottom nav) ───────────────────────────────────────────
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then(
        (m) => m.AuthLayoutComponent
      ),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./auth/register/register.component').then(
            (m) => m.RegisterComponent
          ),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./auth/forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent
          ),
      },
      {
        path: 'otp',
        loadComponent: () =>
          import('./auth/otp/otp.component').then((m) => m.OtpComponent),
      },
    ],
  },

  // ─── Main App Shell (with bottom tabs) ────────────────────────────────────
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent
      ),
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'reminders',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./reminders/list/reminder-list.component').then(
                (m) => m.ReminderListComponent
              ),
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./reminders/create/reminder-create.component').then(
                (m) => m.ReminderCreateComponent
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./reminders/detail/reminder-detail.component').then(
                (m) => m.ReminderDetailComponent
              ),
          },
        ],
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./calendar/calendar.component').then(
            (m) => m.CalendarComponent
          ),
      },
      {
        path: 'friends',
        loadComponent: () =>
          import('./friends/friends.component').then(
            (m) => m.FriendsComponent
          ),
      },
      {
        path: 'insights',
        loadComponent: () =>
          import('./insights/insights.component').then(
            (m) => m.InsightsComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./notifications/notifications.component').then(
            (m) => m.NotificationsComponent
          ),
      },
      {
        // The "Go Premium" upgrade page must be reachable by non-premium users —
        // that's its whole purpose, so no premiumGuard here.
        path: 'premium',
        loadComponent: () =>
          import('./premium/premium.component').then(
            (m) => m.PremiumComponent
          ),
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },

  // Catch-all
  { path: '**', redirectTo: 'auth/login' },
];
