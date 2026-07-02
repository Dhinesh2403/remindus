// backend/scripts/test-push.js
// Diagnose FCM push end-to-end against the STAGING database.
//
// Usage:  node scripts/test-push.js [userEmail]
//
// Steps: load .env.staging → validate Firebase creds → connect to Mongo →
// read the user's fcmToken/prefs → send a real test push → report the exact
// FCM error code if it fails.
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.staging') });

const mongoose = require('mongoose');

const EMAIL = process.argv[2] || 'dhineshdk024@gmail.com';

function mask(str, keep = 12) {
  if (!str) return '(empty)';
  return str.length <= keep ? str : `${str.slice(0, keep)}…(${str.length} chars)`;
}

async function main() {
  console.log('══════════════ FCM STAGING DIAGNOSTIC ══════════════');

  // ── 1. Validate Firebase env vars ────────────────────────────────────────
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY;

  console.log('\n[1] Firebase credentials in .env.staging');
  console.log('    FIREBASE_PROJECT_ID  :', projectId || '❌ MISSING');
  console.log('    FIREBASE_CLIENT_EMAIL:', mask(clientEmail, 25));
  console.log('    FIREBASE_PRIVATE_KEY :', privateKey ? `present (${privateKey.length} chars)` : '❌ MISSING');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('\n❌ Missing Firebase env vars — FCM cannot work. Fix .env.staging / Render env.');
    process.exit(1);
  }
  if (!clientEmail.endsWith('.iam.gserviceaccount.com')) {
    console.error('\n❌ FIREBASE_CLIENT_EMAIL looks TRUNCATED (must end with .iam.gserviceaccount.com):');
    console.error('   ', clientEmail);
    process.exit(1);
  }
  const keyNormalised = privateKey.replace(/\\n/g, '\n');
  if (!keyNormalised.includes('BEGIN PRIVATE KEY') || !keyNormalised.includes('END PRIVATE KEY')) {
    console.error('\n❌ FIREBASE_PRIVATE_KEY is malformed (missing BEGIN/END markers).');
    process.exit(1);
  }
  console.log('    ✅ Credentials look structurally valid');

  // ── 2. Init Firebase Admin ───────────────────────────────────────────────
  console.log('\n[2] Initialising Firebase Admin SDK…');
  const admin = require('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey: keyNormalised }),
  });
  console.log('    ✅ Initialised for project:', projectId);

  // ── 3. Connect to staging Mongo & fetch the user ─────────────────────────
  console.log('\n[3] Connecting to staging MongoDB…');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('    ✅ Connected');

  const User = require('../src/models/User');
  const user = await User.findOne({ email: EMAIL })
    .select('name email fcmToken notifPrefs notifTypes')
    .lean();

  if (!user) {
    console.error(`\n❌ No user found with email ${EMAIL}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\n[4] User record');
  console.log('    name      :', user.name);
  console.log('    email     :', user.email);
  console.log('    fcmToken  :', user.fcmToken ? mask(user.fcmToken, 20) : '❌ NOT SET');
  console.log('    notifPrefs:', JSON.stringify(user.notifPrefs ?? '(unset)'));
  console.log('    notifTypes:', JSON.stringify(user.notifTypes ?? '(unset)'));

  if (!user.fcmToken) {
    console.error('\n❌ User has no fcmToken in staging DB — the app must upload it first.');
    await mongoose.disconnect();
    process.exit(1);
  }
  if (user.notifTypes && user.notifTypes.reminders === false) {
    console.warn('    ⚠️ notifTypes.reminders is OFF — reminder pushes are suppressed by createAndPush!');
  }
  if (user.notifTypes && user.notifTypes.chat === false) {
    console.warn('    ⚠️ notifTypes.chat is OFF — chat pushes are suppressed!');
  }

  // ── 5. Send a test push (same shape as notification.service.js) ─────────
  console.log('\n[5] Sending test push via FCM…');
  try {
    const id = await admin.messaging().send({
      token: user.fcmToken,
      notification: {
        title: '🔔 Remindus test push',
        body:  `Diagnostic push sent ${new Date().toLocaleTimeString()}`,
      },
      data: { type: 'reminder_due' },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'remindus_default' },
      },
    });
    console.log('    ✅ FCM ACCEPTED the message. id:', id);
    console.log('\n════════════════════ VERDICT ════════════════════');
    console.log('Backend → Firebase → device pipe is WORKING.');
    console.log('If the notification did NOT appear on the phone, the problem is ON-DEVICE:');
    console.log('  • missing POST_NOTIFICATIONS permission (Android 13+)');
    console.log('  • notification channel "remindus_default" not created in the app');
    console.log('  • battery optimisation killing FCM delivery');
  } catch (err) {
    console.error('    ❌ FCM REJECTED the message');
    console.error('    code   :', err.code);
    console.error('    message:', err.message);
    console.log('\n════════════════════ VERDICT ════════════════════');
    if (err.code === 'messaging/registration-token-not-registered') {
      console.log('Token is STALE or belongs to a DIFFERENT Firebase project than', projectId);
      console.log('→ Rebuild the APK with the matching google-services.json and re-login.');
    } else if (err.code === 'app/invalid-credential' || err.code === 'messaging/authentication-error') {
      console.log('Service-account credentials are INVALID for project', projectId);
      console.log('→ Regenerate the service-account key in Firebase Console and update env vars.');
    } else if (err.code === 'messaging/invalid-argument') {
      console.log('Message/token malformed — inspect the fcmToken value in the DB.');
    } else {
      console.log('Unexpected FCM error — see code/message above.');
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
