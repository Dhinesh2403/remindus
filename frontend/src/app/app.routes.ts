// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  // ─── Splash ───────────────────────────────────────────────────────────────
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./splash/splash.component').then((m) => m.SplashComponent),
  },

  // ─── First-run onboarding ─────────────────────────────────────────────────
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./onboarding/onboarding.component').then((m) => m.OnboardingComponent),
  },

  // ─── Google sign-up password setup ───────────────────────────────────────
  {
    path: 'set-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./auth/set-password/set-password.component').then((m) => m.SetPasswordComponent),
  },

  // ─── Auth shell (guest only) ──────────────────────────────────────────────
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./auth/register/register.component').then((m) => m.RegisterComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
      },
      {
        path: 'otp',
        loadComponent: () =>
          import('./auth/otp/otp.component').then((m) => m.OtpComponent),
      },
    ],
  },

  // ─── Main app shell (bottom tabs) ─────────────────────────────────────────
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      // ── Core tabs ──────────────────────────────────────────────────────────
      {
        path: 'home',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./calendar/calendar.component').then((m) => m.CalendarComponent),
      },
      {
        path: 'reminders',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./reminders/list/reminder-list.component').then((m) => m.ReminderListComponent),
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./reminders/create/reminder-create.component').then((m) => m.ReminderCreateComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./reminders/detail/reminder-detail.component').then((m) => m.ReminderDetailComponent),
          },
        ],
      },
      {
        path: 'friends',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./friends/friends.component').then((m) => m.FriendsComponent),
          },
          {
            path: ':id/chat',
            loadComponent: () =>
              import('./chat/chat.component').then((m) => m.ChatComponent),
          },
          {
            path: ':id/activity',
            loadComponent: () =>
              import('./friends/friend-activity/friend-activity.component').then((m) => m.FriendActivityComponent),
          },
        ],
      },
      {
        path: 'settings',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./settings/settings.component').then((m) => m.SettingsComponent),
          },
          {
            path: 'profile',
            loadComponent: () =>
              import('./settings/profile/profile.component').then((m) => m.ProfileComponent),
          },
          {
            path: 'profile/edit',
            loadComponent: () =>
              import('./settings/profile/edit-profile.component').then((m) => m.EditProfileComponent),
          },
          {
            path: 'notifications',
            loadComponent: () =>
              import('./settings/notifications-settings/notifications-settings.component').then((m) => m.NotificationsSettingsComponent),
          },
          {
            path: 'help',
            loadComponent: () =>
              import('./settings/help/help.component').then((m) => m.HelpComponent),
          },
        ],
      },

      // ── Productivity modules ──────────────────────────────────────────────
      {
        path: 'tasks',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./tasks/tasks.component').then((m) => m.TasksComponent),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./tasks/task-create/task-create.component').then((m) => m.TaskCreateComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./tasks/task-detail/task-detail.component').then((m) => m.TaskDetailComponent),
          },
        ],
      },
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
          import('./daily-plan/daily-plan.component').then((m) => m.DailyPlanComponent),
      },
      {
        path: 'notes',
        loadComponent: () =>
          import('./notes/notes.component').then((m) => m.NotesComponent),
      },
      {
        path: 'special-days',
        loadComponent: () =>
          import('./special-days/special-days.component').then((m) => m.SpecialDaysComponent),
      },
      {
        path: 'quick-alarms',
        loadComponent: () =>
          import('./quick-alarms/quick-alarms.component').then((m) => m.QuickAlarmsComponent),
      },
      {
        path: 'search',
        loadComponent: () =>
          import('./search/search.component').then((m) => m.SearchComponent),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./notifications/notifications.component').then((m) => m.NotificationsComponent),
      },
      {
        path: 'premium',
        loadComponent: () =>
          import('./premium/premium.component').then((m) => m.PremiumComponent),
      },

      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },

  // Catch-all
  { path: '**', redirectTo: 'auth/login' },
];
