# Module Functionalities

> Legend: ✅ implemented · 🟡 partial / stubbed · ⬜ to build

## Login module

Backend lives in `auth.controller.js` / `auth.routes.js`; tokens are JWT access (15m) + refresh (30d, last 5 kept per user for multi-device).

- ✅ **Email + password login** — `POST /auth/login`; returns user + access/refresh tokens. Generic "Invalid credentials" to avoid leaking which field failed.
- ✅ **Email signup (3-step)** — `signup/start` (name+email → emails 6-digit OTP) → `signup/verify` (OTP → short-lived setup token) → `signup/set-password` (sets password, logs in, sends welcome email).
- ✅ **OTP resend** — `signup/resend`; OTP valid 5 minutes, TOTP-based.
- ✅ **Google Sign-In** — `POST /auth/google`; verifies Google ID token, creates a passwordless account on first sign-in (auto email-verified), pulls avatar/name from Google.
- ✅ **Forgot / reset password** — `forgot-password` always returns 200 (no email enumeration) and emails a 1-hour reset link; `reset-password` sets the new password and revokes all sessions.
- ✅ **Token refresh & rotation** — `POST /auth/refresh`; rotates the refresh token, rejects revoked tokens.
- ✅ **Logout** — pulls the presented refresh token from the user (single-device logout).
- ✅ **Standalone OTP verify** — `send-otp` / `verify-otp` flips `isEmailVerified`.
- ✅ **Session bootstrap** — `GET /auth/me` returns the current user from the access token.
- ⬜ **Lockout / rate-limit on login + OTP** — throttle brute-force on `/login`, `/verify-otp`, `/signup/resend` (global limiter exists; per-route limiter to add).

## Settings module

Frontend in `settings.component.ts`; backed by `User.notifPrefs`, `role`, `isPremium`.

- ✅ **Profile summary** — avatar, name, email; premium vs "Upgrade to Premium" banner.
- ✅ **Appearance** — Light / Dark / System theme, persisted in `localStorage` (`rm_theme`).
- 🟡 **Notification preferences** — Push (free) + Email & WhatsApp (premium-gated) toggles. UI wired; `toggleNotif` still TODO to persist via `UserService.updateNotifPrefs`.
- 🟡 **Change password** — alert dialog with validation; needs `UserService.changePassword(current, new)` wired to a backend route.
- 🟡 **Two-Factor Auth toggle** — UI only; backend 2FA enroll/verify ⬜.
- 🟡 **Sign out** — confirms then calls `authService.logout()`.
- 🟡 **Delete account** — confirm dialog present; `UserService.deleteAccount()` + cascade cleanup ⬜.
- ✅ **App version display** — footer "RemindUs v1.0.0" (wire to App things → app version below).
- ⬜ **Edit profile page** — `editProfile()` currently just logs.

## Admin module

Backend in `admin.controller.js` / `admin.routes.js`; every route guarded by `authenticate` + `requireAdmin` (`User.role === 'admin'`).

- ✅ **Dashboard stats** — `GET /admin/stats`: total/premium/free users, total/done/missed reminders, completion rate.
- ✅ **User management** — `GET /admin/users` with pagination, name/email search, and premium filter (sensitive fields stripped).
- ✅ **Grant / revoke premium** — `PATCH /admin/users/:id/premium` with `expiryDays` (default 30) setting `premiumExpiry`.
- ✅ **Reminder oversight** — `GET /admin/reminders` paginated, filterable by status/type, populated with owner name/email.
- ⬜ **Admin frontend** — no admin UI/route in `app.routes.ts` yet; build an admin shell behind a role guard.
- ⬜ **Broadcast / push announcement** — send a notification to all or a segment of users.
- ⬜ **Ban / suspend user** + **audit log** of admin actions.

## App things (app-level / remote config)

These are app-wide controls, ideally served from a single `GET /app/config` endpoint (none exists yet — ⬜ build it) and cached client-side.

- ⬜ **Update** — return `latestVersion` + `minSupportedVersion`; client shows a *soft* update prompt (dismissible) or a *forced* update gate when below `minSupportedVersion`, deep-linking to Play Store / App Store.
- ⬜ **Rating** — in-app "Enjoying RemindUs? Rate us" prompt after N completed reminders or M days; route to store review (Capacitor in-app review), throttled so it isn't repeated.
- 🟡 **Payment** — premium entitlement model exists (`isPremium`, `premiumExpiry`) and admin can grant it; ⬜ real purchase flow (Play Billing / RevenueCat / Stripe), receipt verification webhook, and auto-expiry job.
- 🟡 **App version** — surfaced in Settings footer; ⬜ centralize the constant and compare against remote config for the update flow.
- ⬜ **Server down / maintenance** — `GET /app/config` (or a 503 health signal) returns a `maintenance` flag + message; client shows a full-screen maintenance/“server down” page and blocks API calls until cleared.

## Friends module

Backed by `Friendship` (`requester`, `recipient`, `status: pending|accepted|rejected|blocked`, unique pair index) and `friend.controller.js`.

- ✅ **Friend list** — `GET /friends`; accepted friendships, both directions resolved to the "other" user.
- ✅ **Search users** — `GET /friends/search?query=`; find by name/email to add.
- ✅ **Send request** — `POST /friends/request` by email or username; creates a `pending` friendship and notifies the recipient.
- ✅ **Accept / reject** — `PATCH /friends/:id/accept` · `/reject`.
- ✅ **Remove friend** — `DELETE /friends/:id`.
- ⬜ **Block / unblock** — `status: 'blocked'` exists in the schema but no route; add `PATCH /friends/:id/block` that also hides the blocker from search and stops shared reminders.
- ⬜ **Dedupe & self-guard** — reject self-requests and collapse reverse-direction duplicates (A→B vs B→A) before insert; surface "already friends / request pending" instead of a 500 on the unique-index violation.
- ⬜ **Online / last-active** — expose `lastActiveAt` on the friend list for presence dots.

**Must-work rules:** every state transition is idempotent; a rejected/removed pair can re-request; notifications fire on request + accept only.

## Chat module ⬜ (new)

1:1 messaging between accepted friends. No model yet — build it.

- **Model `Message`** — `{ conversationId, from, to, body, attachments?, readAt, createdAt }` + a lightweight `Conversation` `{ participants[2], lastMessage, lastMessageAt, unread: {userId: count} }` for the inbox list.
- **Send** — `POST /chat/:friendId` — guarded so both users are `accepted` friends (and neither blocked).
- **History** — `GET /chat/:friendId?before=<cursor>&limit=30`, reverse-chronological cursor pagination.
- **Inbox** — `GET /chat` — conversations sorted by `lastMessageAt` with unread counts.
- **Read receipts** — `PATCH /chat/:friendId/read` stamps `readAt`, clears unread.
- **Realtime** — Socket.IO room per conversation (`conv:<id>`); emit `message:new`, `message:read`, `typing`. Fall back to polling if socket drops.
- **Push** — offline recipient gets a push/notification via the existing notification service.
- **Must-work rules:** messages are ordered by server `createdAt` (never client clock); delivery is at-least-once with client-side dedupe by message `_id`; a blocked/un-friended pair can't send.

## Reminder module

The core. `Reminder` model already supports type, priority, repeat, snooze, status, notification channels, and `nextFireAt` (UTC, timezone-safe).

- ✅ **CRUD** — `GET /reminders`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` (title/date/time validated).
- ✅ **Complete** — `PATCH /:id/done` sets `status:'done'` + `completedAt` (feeds streaks).
- ✅ **Snooze** — `PATCH /:id/snooze` (5–1440 min), increments `snoozeCount`, sets `snoozeUntil`.
- ✅ **Stats** — `GET /reminders/stats/summary` for dashboard.
- ✅ **Repeat** — `none|daily|weekly|monthly|yearly`; scheduler recomputes `nextFireAt` after each fire.
- ✅ **Multi-channel delivery** — `notificationTypes: [push,email,sms,whatsapp]` honored against the user's `notifPrefs` + premium gating.
- ✅ **Pre-alert window** — `reminderWindowMinutes` fires an early heads-up (`preAlertSent` guard prevents double-send — see the re-firing bug fix in `[[feedback_reminder_notif_bugs]]`).
- 🟡 **Recurrence after completion** — confirm a `done` recurring reminder regenerates the next occurrence (don't leave it `done` forever).
- ⬜ **Missed handling** — a sweeper flips overdue `pending` → `missed`; surface a "mark done / reschedule" action.

**Must-work rules:** `nextFireAt` is always UTC and trusted from the timezone-aware client on create (see model pre-save); the scheduler is idempotent per fire so a reminder never double-notifies.

## Special days ⬜ (built on Reminder)

Birthdays / anniversaries / festivals — a curated view over `type: 'birthday' | 'wedding'` reminders, plus a yearly-repeat default.

- **Auto from friends** — pull friends' birthdays (once a DOB field is added to `User`) into a "Special Days" feed.
- **Yearly repeat default** — special-day reminders default to `repeatType: 'yearly'`.
- **Countdown view** — `GET /reminders?type=birthday,wedding` sorted by next occurrence with "in N days".
- **One-tap greeting** — quick action to send a chat message / wish to the friend whose day it is.
- **Must-work rules:** yearly occurrences recompute correctly across leap years and Feb 29.

## Task module ⬜ (new, lighter than reminders)

Checklist items without a hard fire time — to-dos that may roll into reminders.

- **Model `Task`** — `{ userId, title, notes?, done, dueDate?, priority, order, createdAt }`.
- **CRUD** — `GET/POST/PUT/DELETE /tasks`; `PATCH /tasks/:id/toggle`.
- **Reorder** — drag-to-reorder via `order` field; `PATCH /tasks/reorder`.
- **Promote to reminder** — "remind me" converts a task into a `Reminder` (carries title/notes/dueDate).
- **Must-work rules:** toggling done is idempotent; reorder is atomic.

## Reminder task + friend integration

The sharing/accountability layer — schema is already in `Reminder` (`assignedTo`, `assignedBy`, `sharedStatus`).

- ✅ **Assign to friend** — `PATCH /reminders/:id/assign` (validates `friendId` is a MongoId / accepted friend).
- ✅ **Received list** — `GET /reminders/received`; reminders assigned *to* me.
- ✅ **Shared-with-friend view** — `GET /reminders/shared/:friendId`.
- ✅ **Shared status lifecycle** — `PATCH /:id/shared-status`: `sent → received → acknowledged → processing → skipped|completed`.
- ✅ **Snooze an assigned reminder** — `PATCH /:id/snooze-assigned` (1–1440 min) notifies the assigner.
- ⬜ **Assign-only-to-friends guard** — enforce that `assignedTo` is an *accepted* friend before assigning.
- ⬜ **Accountability nudges** — notify the assigner when the assignee marks done/skipped, and on missed.
- **Must-work rules:** status only moves forward through the allowed enum; both assigner and assignee see a consistent `sharedStatus`; un-friending revokes pending shares.

## Quick alarms ⬜ (new, device-local)

Fast "remind me in 10 min / at 6pm" timers — local-first, low ceremony.

- **Local scheduling** — use Capacitor Local Notifications so alarms fire even offline; no server round-trip required.
- **Presets** — +5/+10/+30/+60 min and "tomorrow 9am" chips.
- **Optional sync** — if signed in, mirror to a lightweight `Reminder` (`type:'custom'`) so it survives reinstalls.
- **Snooze from the notification** — action buttons on the local notification.
- **Must-work rules:** alarm fires at the exact local wall-clock time regardless of timezone/DST; survives app kill (OS-scheduled, not in-app timer).

## Notes module ⬜ (new)

Freeform notes, optionally attachable to a reminder/task.

- **Model `Note`** — `{ userId, title?, body, color?, pinned, tags[], reminderId?, updatedAt }`.
- **CRUD** — `GET/POST/PUT/DELETE /notes`; `PATCH /notes/:id/pin`.
- **Search & tags** — `GET /notes?query=&tag=`; full-text on title/body.
- **Attach to reminder** — link a note to a reminder for context shown on the detail page.
- **Convert** — "turn note into reminder/task".
- **Must-work rules:** autosave (debounced) never loses content; last-write-wins by `updatedAt` with edit conflict surfaced.

daily plans
goals
habits


com.remindmebuddy.app 

cliend id
812312433271-bipqnms8q3mn2e8quap0lrtod44ramdn.apps.googleusercontent.com

web
812312433271-es68ea2h2jmtol3u5hajn3abmm07fv89.apps.googleusercontent.com