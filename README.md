# RemindUs

> A social reminder and productivity app for Android and web: reminders, tasks, notes, habits, goals and special days, with real-time chat between friends and reliable push notifications.

<p>
  <img src="https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white" />
  <img src="https://img.shields.io/badge/Ionic-3880FF?style=for-the-badge&logo=ionic&logoColor=white" />
  <img src="https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
</p>

📱 **[Download the Android APK](https://github.com/Dhinesh2403/remindus/releases/latest)**

---

## ✨ Features

- **Reminders**: one-time or repeating (daily / weekly / monthly / yearly), snooze, priority, and an early "heads-up" alert before the due time
- **Multi-channel delivery**: push notifications (FCM + Web Push) and email, with premium-gated WhatsApp / SMS
- **Tasks, notes, habits, goals and special days** (birthdays, anniversaries)
- **Quick alarms** using on-device local notifications
- **Friends**: search, send and accept requests, see friend activity
- **Real-time 1:1 chat** over Socket.IO, with push fallback when the recipient is offline
- **Auth**: email + OTP signup, Google Sign-In, forgot/reset password
- **Admin API**: user stats, user management, premium grants, reminder oversight
- Light / dark / system theme, offline detection, in-app update and maintenance screens

## 🏗️ Tech stack

| Layer | Tech |
|---|---|
| Mobile / Web | Angular 17, Ionic 7, Capacitor 6 (Android), RxJS, SCSS, Angular Service Worker |
| Backend | Node.js, Express, Socket.IO, node-cron |
| Database | MongoDB + Mongoose |
| Auth | JWT access tokens + rotating refresh tokens, Google ID-token verification, OTP (otplib) |
| Notifications | Firebase Cloud Messaging, Web Push (VAPID), Resend / Nodemailer, Twilio |
| Media | Cloudinary |
| Security | helmet, express-rate-limit, express-mongo-sanitize, hpp, xss-clean, express-validator |
| Testing | Jest, Supertest, mongodb-memory-server (backend) · Jasmine / Karma (frontend) |
| Hosting | Render (API) · Vercel (web) |

## 🔍 Engineering highlights

- **No duplicate notifications.** The scheduler runs every minute and claims each due reminder atomically with `findOneAndUpdate` before sending, so overlapping cron ticks or multiple server instances can never fire the same reminder twice.
- **Timezone-safe scheduling.** Every reminder stores its next fire time (`nextFireAt`) in UTC. Repeating reminders recompute it after each fire.
- **Secure sessions.** Access tokens last 15 minutes and refresh tokens 30 days. Refresh tokens rotate on every use, each user keeps at most 5 devices, and a password reset revokes all sessions.
- **No account enumeration.** Login returns one generic error, and "forgot password" always responds with success, so nobody can probe which emails are registered.
- **Reliable push on Android.** The app disconnects its socket when backgrounded so FCM pushes are delivered, then catches up on missed messages when resumed.
- **Tested.** Unit tests cover models and helpers; integration tests cover the auth, reminder, task, special-day and user routes against an in-memory MongoDB.

## 📁 Project structure

```
remindus/
├── backend/            # Express API
│   ├── src/
│   │   ├── controllers/  routes/  models/  middlewares/
│   │   ├── services/     # notification + email services
│   │   ├── jobs/         # cron scheduler (fires reminders)
│   │   └── sockets/      # Socket.IO chat + presence
│   └── tests/            # unit + integration (Jest)
├── frontend/           # Ionic + Angular app (web + Android via Capacitor)
│   └── src/app/          # feature modules: reminders, tasks, notes, habits, friends, chat...
└── docs/               # deployment guide, module specs
```

## 🚀 Run locally

**Prerequisites:** Node.js 20+, a MongoDB connection string (local or Atlas)

```bash
# Backend
cd backend
npm install
cp .env.example .env      # fill in MONGO_URI, JWT secrets, etc.
npm run seed              # optional demo data
npm run dev               # http://localhost:5000

# Frontend (new terminal)
cd frontend
npm install
cp src/environments/environment.example.ts src/environments/environment.ts
npm start                 # http://localhost:8100
```

**Run the backend tests:**
```bash
cd backend && npm test
```

**Build the Android app:**
```bash
cd frontend
npm run build:prod
npx cap sync android
npx cap open android
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full dev → staging → production setup.

---

## 👨‍💻 Author

**Dhineshkumar A** · [LinkedIn](https://www.linkedin.com/in/dhineshkumara) · dhineshdk024@gmail.com
