// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  // ─── Splash (entry point) ─────────────────────────────────────────────────
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./splash/splash.component').then((m) => m.SplashComponent),
  },

  // ─── First-run intro (after sign-in) ──────────────────────────────────────
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./onboarding/onboarding.component').then(
        (m) => m.OnboardingComponent
      ),
  },

  // ─── One-time password setup for Google sign-ups ──────────────────────────
  // Authenticated (the Google session authorises it); not under /auth, whose
  // guestGuard would bounce a just-signed-in user.
  {
    path: 'set-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./auth/set-password/set-password.component').then(
        (m) => m.SetPasswordComponent
      ),
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

      // ─── Productivity modules ───────────────────────────────────────────────
      {
        path: 'habits',
        loadComponent: () =>
          import('./habits/habits.component').then((m) => m.HabitsComponent),
      },
      {
        path: 'goals',
        loadComponent: () =>
          import('./goals/goals.component').then((m) => m.GoalsComponent),
      },
      {
        path: 'daily-plan',
        loadComponent: () =>
          import('./daily-plan/daily-plan.component').then(
            (m) => m.DailyPlanComponent
          ),
      },
      {
        path: 'notes',
        loadComponent: () =>
          import('./notes/notes.component').then((m) => m.NotesComponent),
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
