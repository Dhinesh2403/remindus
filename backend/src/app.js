// backend/src/app.js
'use strict';

const path    = require('path');
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const express        = require('express');
const http           = require('http');
const cors           = require('cors');
const helmet         = require('helmet');
const compression    = require('compression');
const morgan         = require('morgan');
const cookieParser   = require('cookie-parser');
const mongoSanitize  = require('express-mongo-sanitize');
const xssClean       = require('xss-clean');
const hpp            = require('hpp');
const rateLimit      = require('express-rate-limit');

const connectDB      = require('./config/database');
const logger         = require('./utils/logger');
const { initSocket } = require('./sockets');
const { startJobs }  = require('./jobs');
const errorHandler   = require('./middlewares/errorHandler');

// ── Route imports ──────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const reminderRoutes     = require('./routes/reminder.routes');
const friendRoutes       = require('./routes/friend.routes');
const notificationRoutes = require('./routes/notification.routes');
const userRoutes         = require('./routes/user.routes');
const adminRoutes        = require('./routes/admin.routes');
const chatRoutes         = require('./routes/chat.routes');
const habitRoutes        = require('./routes/habit.routes');
const goalRoutes         = require('./routes/goal.routes');
const activityRoutes     = require('./routes/activity.routes');
const noteRoutes         = require('./routes/note.routes');
const taskRoutes         = require('./routes/task.routes');
const specialDayRoutes   = require('./routes/specialDay.routes');
const appConfigRoutes    = require('./routes/app.routes');
const logRoutes          = require('./routes/log.routes');

const app    = express();

// Behind Render's (and any) reverse proxy the real client IP arrives in the
// X-Forwarded-For header. Trust the first proxy hop so `req.ip` is the actual
// client. Without this, express-rate-limit keys every request off the shared
// proxy IP and lumps ALL users into one bucket — producing app-wide 429s.
// Use `1` (not `true`): only the immediate proxy is trusted, so clients can't
// spoof their IP via a forged X-Forwarded-For.
app.set('trust proxy', 1);

const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────────────
initSocket(server);

// ── Security middleware ────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// CORS — whitelist frontend URLs per environment
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:8100',        // Ionic dev (HTTP)
  'https://localhost:8100',       // Ionic dev (HTTPS)
  'http://localhost:4200',        // Angular dev (HTTP)
  'https://localhost:4200',       // Angular dev (HTTPS)
  'https://localhost',            // Chrome DevTools remote debug
  'http://localhost',
  'capacitor://localhost',        // Capacitor iOS/Android
  'ionic://localhost',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Skip-Loading'],
}));

// ── General middleware ─────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(mongoSanitize());   // prevent NoSQL injection
app.use(xssClean());        // sanitize XSS in req.body / params
app.use(hpp());             // HTTP Parameter Pollution

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(
    process.env.NODE_ENV === 'development' ? 'dev' : 'combined',
    { stream: { write: (msg) => logger.http(msg.trim()) } }
  ));
}

// ── Global rate limiter ────────────────────────────────────────────────────
// Per-client (see `trust proxy` above) budget for a normal authenticated
// session: first-load fan-out + polling + navigation easily runs into the
// hundreds over 15 min, so 100 was far too tight. High-frequency, low-risk
// endpoints are skipped here — /health is polled for clock sync and
// /logs/device already enforces its own tighter limiter.
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 600,
  standardHeaders: true,
  legacyHeaders:   false,
  skip: (req) => {
    const url = req.originalUrl || req.url;
    return url.startsWith('/api/health') || url.startsWith('/api/logs/device');
  },
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', globalLimiter);

// Auth-specific stricter limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    env:     process.env.NODE_ENV,
    uptime:  process.uptime(),
    // FCM readiness — false means Firebase env vars are missing/invalid on
    // this deployment, so pushes are silently skipped while sockets still work.
    fcmActive: require('./services/notification.service').isFcmActive(),
    // Which Firebase project this deployment's credentials belong to. Must
    // match the app's google-services.json (remindus-24) or every send fails.
    fcmProjectId: process.env.FIREBASE_PROJECT_ID || null,
    // Masked service-account email — makes a truncated env value visible here.
    // The correct value starts with "firebase-adminsdk".
    fcmClientEmail: (process.env.FIREBASE_CLIENT_EMAIL || '').slice(0, 17) + '…',
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/reminders',                 reminderRoutes);
app.use('/api/friends',                   friendRoutes);
app.use('/api/notifications',             notificationRoutes);
app.use('/api/users',                     userRoutes);
app.use('/api/admin',                     adminRoutes);
app.use('/api/chat',                       chatRoutes);
app.use('/api/habits',                     habitRoutes);
app.use('/api/goals',                      goalRoutes);
app.use('/api/activities',                 activityRoutes);
app.use('/api/notes',                      noteRoutes);
app.use('/api/tasks',                      taskRoutes);
app.use('/api/special-days',               specialDayRoutes);
app.use('/api/app',                        appConfigRoutes);   // version-check / maintenance (public)
app.use('/api/logs',                       logRoutes);         // device log ingest (auth)

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ── Startup ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Skip the network boot when running under Jest — tests import { app } and
// drive it with supertest against an in-memory MongoDB, so we must not open a
// port, connect to the real DB, or start cron jobs on import.
if (process.env.NODE_ENV !== 'test') {
  // Start listening immediately so Railway's healthcheck can reach /api/health
  // while the DB connection is still being established.
  server.listen(PORT, () => {
    logger.info(`🚀 Server running in [${process.env.NODE_ENV}] mode on port ${PORT}`);
    // Connect DB and start jobs after the HTTP server is up
    connectDB().then(() => {
      startJobs();
    }).catch((err) => {
      logger.error('Fatal DB connection error:', err.message);
      process.exit(1);
    });
  });
}

module.exports = { app, server }; // for testing
