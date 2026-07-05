// backend/src/services/notification.service.js
'use strict';

const webpush     = require('web-push');
const twilio      = require('twilio');
const emailService = require('./email.service');
const Notification = require('../models/Notification');
const User         = require('../models/User');
const { emitToUser }  = require('../sockets');
const logger      = require('../utils/logger');
const { signActionToken } = require('../utils/notif-action');

// Public base URL the native tray-action receiver POSTs back to. Falls back to
// the production API so no env change is needed to ship; override with
// PUBLIC_API_URL on other deployments.
const ACTION_URL = `${process.env.PUBLIC_API_URL || 'https://remindus-buddy-api.up.railway.app/api'}/reminders/notif-action`;

// ── Configure Firebase Admin (only if service account env vars are present) ──
let firebaseAdmin = null;
const firebaseReady = process.env.FIREBASE_PROJECT_ID &&
                      process.env.FIREBASE_CLIENT_EMAIL &&
                      process.env.FIREBASE_PRIVATE_KEY;
if (firebaseReady) {
  try {
    // Fail fast on truncated env values (Render/Railway paste accidents) so the
    // health endpoint reports fcmActive:false instead of send() failing later.
    if (!process.env.FIREBASE_CLIENT_EMAIL.endsWith('.iam.gserviceaccount.com')) {
      throw new Error(`FIREBASE_CLIENT_EMAIL looks truncated: "${process.env.FIREBASE_CLIENT_EMAIL.slice(0, 20)}…"`);
    }
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
      throw new Error('FIREBASE_PRIVATE_KEY is malformed (missing BEGIN/END markers)');
    }
    firebaseAdmin = require('firebase-admin');
    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Railway env vars strip newlines — restore them
          privateKey,
        }),
      });
    }
    logger.info(`Firebase Admin SDK initialised for project ${process.env.FIREBASE_PROJECT_ID}.`);

    // Verify the credentials actually work by fetching an OAuth token now,
    // instead of letting every send() fail quietly later. Catches truncated
    // FIREBASE_CLIENT_EMAIL / revoked keys (invalid_grant: account not found).
    firebaseAdmin.app().options.credential.getAccessToken()
      .then(() => logger.info('[FCM] Service-account credential VERIFIED — pushes enabled.'))
      .catch((err) => {
        logger.error(`[FCM] Service-account credential INVALID — pushes DISABLED: ${err.message}`);
        logger.error(`[FCM] Check FIREBASE_CLIENT_EMAIL ("${(process.env.FIREBASE_CLIENT_EMAIL || '').slice(0, 15)}…") and FIREBASE_PRIVATE_KEY in the deployment env vars.`);
        firebaseAdmin = null;
      });
  } catch (err) {
    firebaseAdmin = null;
    logger.warn('Firebase Admin init failed — FCM push disabled:', err.message);
  }
} else {
  logger.warn('Firebase env vars not set — FCM push notifications disabled.');
}

/** True when the FCM pipeline is usable (reported by /api/health). */
exports.isFcmActive = () => !!firebaseAdmin;

/**
 * Diagnostic send to a user's stored token that RETURNS the raw FCM outcome
 * instead of swallowing errors into logs (POST /api/users/me/test-push).
 */
exports.sendTestPush = async (userId) => {
  if (!firebaseAdmin) {
    return { sent: false, reason: 'firebase_not_initialised', projectId: process.env.FIREBASE_PROJECT_ID || null };
  }
  const user = await User.findById(userId).select('fcmToken').lean();
  if (!user?.fcmToken) {
    return { sent: false, reason: 'no_fcm_token_stored' };
  }
  try {
    const id = await firebaseAdmin.messaging().send({
      token:        user.fcmToken,
      notification: { title: 'Remindus server test', body: `Sent from the server at ${new Date().toISOString()}` },
      data:         { type: 'reminder_due' },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'remindus_default' },
      },
    });
    return { sent: true, messageId: id, projectId: process.env.FIREBASE_PROJECT_ID };
  } catch (err) {
    return {
      sent: false,
      reason: 'fcm_send_failed',
      code: err.code || null,
      message: err.message,
      projectId: process.env.FIREBASE_PROJECT_ID || null,
      tokenPrefix: user.fcmToken.slice(0, 12),
    };
  }
};

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

// ── Map a notification type to its on/off preference category ─────────────
function categoryForType(type) {
  if (type === 'friend_request' || type === 'friend_accepted') return 'friendRequests';
  if (type === 'system') return 'other';
  // Assigned tasks ride the same switch as assigned reminders.
  if (type?.startsWith('reminder_') || type?.startsWith('task_') || type === 'friend_reminder_due') return 'reminders';
  return 'other';
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create a DB notification + emit real-time socket event.
 * Respects the recipient's per-category notifTypes switches — a disabled
 * category is skipped entirely (no DB doc, no socket event, no FCM).
 */
exports.createAndPush = async ({
  userId, type, title, message, data = {}, push = true,
  senderName = null, avatar = null,
  // Structured "styled" push fields (rendered natively — see RemindusMessagingService):
  category = null,             // header label: 'Reminder' | 'Task' | 'Daily plan' | 'Friend request' | 'Message' | 'System'
  subtext  = null,             // crisp status line under the title (e.g. 'Due now', 'From Dhinesh')
  actions  = null,            // [{ id, label }] → tray action buttons (token signed below)
}) => {
  // ── 0. Honour the user's per-category notification switch ───────────────
  try {
    const prefUser = await User.findById(userId).select('notifTypes').lean();
    const prefCategory = categoryForType(type);
    if (prefUser?.notifTypes && prefUser.notifTypes[prefCategory] === false) {
      logger.info(`[Notification] "${type}" suppressed for user ${userId} (${prefCategory} off)`);
      return null;
    }
  } catch (err) {
    logger.warn('[Notification] notifTypes check failed (sending anyway):', err.message);
  }

  // Carry the display category into the stored data so the in-app list can chip it too.
  const storedData = category ? { ...data, category } : data;

  // ── 1. Persist to DB + socket (best-effort — never blocks FCM) ──────────
  let notif = null;
  try {
    notif = await Notification.create({ userId, type, title, message, data: storedData });
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
  if (!push) {
    return notif; // caller handles delivery itself (e.g. device-local alarm)
  }
  if (firebaseAdmin) {
    try {
      const user = await User.findById(userId).select('fcmToken').lean();
      if (user?.fcmToken) {
        const baseData = { type, ...Object.fromEntries(
          Object.entries(storedData).map(([k, v]) => [k, String(v)])
        )};

        // A `category` (or a legacy `senderName`) means this is a rich, native-
        // rendered push: sent DATA-ONLY (no `notification` block) so the native
        // RemindusMessagingService is the SINGLE code path that renders it — in
        // every app state (foreground, background, killed). That gives us the
        // brand small-icon, a typed header, an avatar large-icon, and tray action
        // buttons that FCM's own notification payload cannot, and — because only
        // one layer ever renders it — no duplicate, icon-less notifications.
        if (category || senderName) {
          const styledData = {
            ...baseData,
            v:          '2',
            style:      'styled',
            category:   String(category || 'Message'),
            title:      title   || '',
            subtext:    subtext ? String(subtext) : '',
            body:       message || '',
            senderName: senderName ? String(senderName) : '',
            avatar:     avatar ? String(avatar) : '',
          };
          // Tray action buttons (reminder actions only — 'ack' / 'snooze5'). Each
          // button carries its OWN short-lived token, scoped to this recipient +
          // reminder + action, so the native receiver can POST it to ACTION_URL
          // without carrying the user's real JWT. See utils/notif-action.js.
          if (Array.isArray(actions) && actions.length && data.reminderId) {
            const withTokens = actions.map((a) => ({
              id:    a.id,
              label: a.label,
              token: signActionToken({ reminderId: data.reminderId, uid: userId, act: a.id }),
            }));
            styledData.actions   = JSON.stringify(withTokens);
            styledData.actionUrl = ACTION_URL;
          }

          await firebaseAdmin.messaging().send({
            token: user.fcmToken,
            data:  styledData,
            android: { priority: 'high' },
          });
        } else {
          await firebaseAdmin.messaging().send({
            token:        user.fcmToken,
            notification: { title, body: message },
            data:         baseData,
            android: {
              priority: 'high',
              notification: { sound: 'default', channelId: 'remindus_default' },
            },
          });
        }
        logger.info(`[FCM] Sent "${type}" to user ${userId}`);
      } else {
        logger.warn(`[FCM] No token for user ${userId} — skipping`);
      }
    } catch (err) {
      logger.warn(`[FCM] Send failed for user ${userId}:`, err.message);
    }
  } else {
    logger.warn(`[FCM] "${type}" push skipped for ${userId} — Firebase not initialised on this deployment`);
  }

  return notif;
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Lightweight FCM push for a new chat message. Does NOT create a Notification
 * document (chat history lives in the Message collection), so the notifications
 * list stays clean. Gated on the recipient's notifTypes.chat switch.
 */
exports.pushChatMessage = async ({ recipientId, senderName, text, senderId }) => {
  if (!firebaseAdmin) {
    logger.warn(`[FCM] Chat push skipped for ${recipientId} — Firebase not initialised on this deployment`);
    return;
  }

  const user = await User.findById(recipientId).select('fcmToken notifTypes').lean();
  if (!user?.fcmToken) {
    logger.warn(`[FCM] Chat push skipped for ${recipientId} — no fcmToken stored`);
    return;
  }
  if (user.notifTypes && user.notifTypes.chat === false) {
    logger.info(`[FCM] Chat push skipped for ${recipientId} — chat notifications off`);
    return;
  }

  try {
    await firebaseAdmin.messaging().send({
      token: user.fcmToken,
      notification: {
        title: senderName,
        body:  text.length > 120 ? `${text.slice(0, 117)}...` : text,
      },
      data: {
        type:     'chat_message',
        senderId: String(senderId ?? ''),
      },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'remindus_default' },
      },
    });
    logger.info(`[FCM] Sent chat message to user ${recipientId}`);
  } catch (err) {
    logger.warn(`[FCM] Chat push failed for user ${recipientId}:`, err.message);
  }
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

  await emailService.deliver({
    to:      user.email,
    subject: `Reminder: ${reminder.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#F8F7FF;border-radius:16px">
        <div style="background:#7C3AED;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <h1 style="color:white;margin:0;font-size:24px">Remindus</h1>
        </div>
        <h2 style="color:#1F2937">Hi ${user.name}!</h2>
        <p style="color:#4B5563">Your reminder is due:</p>
        <div style="background:white;border-radius:12px;padding:20px;border-left:4px solid #7C3AED;margin:16px 0">
          <h3 style="color:#7C3AED;margin:0 0 8px">${reminder.title}</h3>
          ${reminder.description ? `<p style="color:#6B7280;margin:0 0 8px">${reminder.description}</p>` : ''}
          <p style="color:#9CA3AF;margin:0;font-size:14px">${timeStr}</p>
        </div>
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin-top:24px">
          Remindus · Unsubscribe from emails in app settings
        </p>
      </div>
    `,
  });
}

async function sendSms(phone, reminder) {
  await twilioClient.messages.create({
    body: `⏰ Remindus: "${reminder.title}"${reminder.description ? ` — ${reminder.description}` : ''}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to:   phone,
  });
}

async function sendWhatsApp(phone, reminder) {
  await twilioClient.messages.create({
    body: `🔔 *Remindus*\n\n*${reminder.title}*${reminder.description ? `\n${reminder.description}` : ''}\n\nOpen app to mark Done or Snooze.`,
    from: process.env.TWILIO_WHATSAPP_FROM,
    to:   `whatsapp:${phone}`,
  });
}
