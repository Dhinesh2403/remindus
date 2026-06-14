// backend/src/services/notification.service.js
'use strict';

const webpush     = require('web-push');
const nodemailer  = require('nodemailer');
const twilio      = require('twilio');
const Notification = require('../models/Notification');
const User         = require('../models/User');
const { emitToUser }  = require('../sockets');
const logger      = require('../utils/logger');

// ── Configure Firebase Admin (only if service account env vars are present) ──
let firebaseAdmin = null;
const firebaseReady = process.env.FIREBASE_PROJECT_ID &&
                      process.env.FIREBASE_CLIENT_EMAIL &&
                      process.env.FIREBASE_PRIVATE_KEY;
if (firebaseReady) {
  try {
    firebaseAdmin = require('firebase-admin');
    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Railway env vars strip newlines — restore them
          privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    logger.info('Firebase Admin SDK initialised.');
  } catch (err) {
    firebaseAdmin = null;
    logger.warn('Firebase Admin init failed — FCM push disabled:', err.message);
  }
} else {
  logger.warn('Firebase env vars not set — FCM push notifications disabled.');
}

// ── Configure web-push (only if valid VAPID keys are present) ────────────
const vapidReady = process.env.VAPID_PUBLIC_KEY &&
                   process.env.VAPID_PRIVATE_KEY &&
                   process.env.VAPID_EMAIL;
if (vapidReady) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (err) {
    logger.warn('Web push VAPID configuration failed — push notifications disabled:', err.message);
  }
} else {
  logger.warn('VAPID keys not configured — web push notifications disabled.');
}

// ── Configure Twilio (only if a real SID is present) ─────────────────────
const twilioReady = process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') &&
                    process.env.TWILIO_AUTH_TOKEN;
let twilioClient = null;
if (twilioReady) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    logger.warn('Twilio configuration failed — SMS/WhatsApp disabled:', err.message);
  }
} else {
  logger.warn('Twilio credentials not configured — SMS/WhatsApp notifications disabled.');
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Main dispatcher — sends via requested channels
 * @param {{ user, reminder, channels: string[] }} opts
 */
exports.send = async ({ user, reminder, channels }) => {
  const tasks = [];

  if (channels.includes('push') && user.pushSubscription?.endpoint) {
    tasks.push(sendPush(user.pushSubscription, reminder));
  }
  if (channels.includes('email') && user.email && user.notifPrefs?.email && user.isPremium) {
    tasks.push(sendEmail(user, reminder));
  }
  if (channels.includes('sms') && user.phone && user.isPremium) {
    tasks.push(sendSms(user.phone, reminder));
  }
  if (channels.includes('whatsapp') && user.phone && user.isPremium) {
    tasks.push(sendWhatsApp(user.phone, reminder));
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logger.warn(`[Notification] channel[${channels[i]}] failed: ${r.reason?.message}`);
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create a DB notification + emit real-time socket event
 */
exports.createAndPush = async ({ userId, type, title, message, data = {} }) => {
  // ── 1. Persist to DB + socket (best-effort — never blocks FCM) ──────────
  let notif = null;
  try {
    notif = await Notification.create({ userId, type, title, message, data });
    emitToUser(String(userId), 'notification:new', {
      _id:       notif._id,
      type:      notif.type,
      title:     notif.title,
      message:   notif.message,
      data:      notif.data,
      isRead:    false,
      createdAt: notif.createdAt,
    });
  } catch (err) {
    logger.error('[Notification] DB/socket error (FCM will still fire):', err.message);
  }

  // ── 2. FCM push (always runs, even if DB write failed) ──────────────────
  if (firebaseAdmin) {
    try {
      const user = await User.findById(userId).select('fcmToken').lean();
      if (user?.fcmToken) {
        await firebaseAdmin.messaging().send({
          token:        user.fcmToken,
          notification: { title, body: message },
          data:         { type, ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          )},
          android: {
            priority: 'high',
            notification: { sound: 'default', channelId: 'remindme_default' },
          },
        });
        logger.info(`[FCM] Sent "${type}" to user ${userId}`);
      } else {
        logger.warn(`[FCM] No token for user ${userId} — skipping`);
      }
    } catch (err) {
      logger.warn(`[FCM] Send failed for user ${userId}:`, err.message);
    }
  }

  return notif;
};

// ── Channel implementations ───────────────────────────────────────────────
async function sendPush(subscription, reminder) {
  const payload = JSON.stringify({
    title: reminder.title,
    body:  reminder.description || 'Your reminder is due!',
    icon:  '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/badge-72x72.png',
    data:  { reminderId: reminder._id, url: `/app/reminders/${reminder._id}` },
  });

  await webpush.sendNotification(subscription, payload, {
    urgency: reminder.priority === 'urgent' ? 'high' : 'normal',
    TTL:     reminder.priority === 'urgent' ? 3600   : 86400,
  });
}

async function sendEmail(user, reminder) {
  const [hour, min] = reminder.time.split(':');
  const fireDate    = new Date(reminder.date);
  fireDate.setHours(Number(hour), Number(min));
  const timeStr = fireDate.toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  await transporter.sendMail({
    from:    `"RemindMe Buddy" <${process.env.EMAIL_FROM}>`,
    to:      user.email,
    subject: `⏰ Reminder: ${reminder.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#F8F7FF;border-radius:16px">
        <div style="background:#7C3AED;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <h1 style="color:white;margin:0;font-size:24px">🔔 RemindMe Buddy</h1>
        </div>
        <h2 style="color:#1F2937">Hi ${user.name}!</h2>
        <p style="color:#4B5563">Your reminder is due:</p>
        <div style="background:white;border-radius:12px;padding:20px;border-left:4px solid #7C3AED;margin:16px 0">
          <h3 style="color:#7C3AED;margin:0 0 8px">${reminder.title}</h3>
          ${reminder.description ? `<p style="color:#6B7280;margin:0 0 8px">${reminder.description}</p>` : ''}
          <p style="color:#9CA3AF;margin:0;font-size:14px">📅 ${timeStr}</p>
        </div>
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin-top:24px">
          RemindMe Buddy · Unsubscribe from emails in app settings
        </p>
      </div>
    `,
  });
}

async function sendSms(phone, reminder) {
  await twilioClient.messages.create({
    body: `⏰ RemindMe: "${reminder.title}"${reminder.description ? ` — ${reminder.description}` : ''}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to:   phone,
  });
}

async function sendWhatsApp(phone, reminder) {
  await twilioClient.messages.create({
    body: `🔔 *RemindMe Buddy*\n\n*${reminder.title}*${reminder.description ? `\n${reminder.description}` : ''}\n\nOpen app to mark Done or Snooze.`,
    from: process.env.TWILIO_WHATSAPP_FROM,
    to:   `whatsapp:${phone}`,
  });
}
