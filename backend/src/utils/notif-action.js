// backend/src/utils/notif-action.js
'use strict';

const jwt = require('jsonwebtoken');

/**
 * Signed, purpose-scoped tokens that authorize a SINGLE notification-tray action
 * (acknowledge / snooze) without a user session.
 *
 * The Android notification-action code lives outside the WebView and can't read
 * the login JWT in localStorage, so each tray button carries one of these tokens
 * and the public /reminders/notif-action endpoint verifies it. The token names
 * the reminder, the assignee it was issued to, and the exact action — so it can
 * only ever do that one thing to that one reminder.
 *
 * Reuses JWT_ACCESS_SECRET with a distinct `purpose` claim (same pattern as the
 * signup-setup token in auth.controller.js), so verify() rejects a regular
 * access token and vice-versa.
 */

const PURPOSE = 'notif_action';

/** @param {{ reminderId: string, uid: string, act: 'ack'|'snooze5' }} opts */
function signActionToken({ reminderId, uid, act }) {
  return jwt.sign(
    { purpose: PURPOSE, sub: String(reminderId), uid: String(uid), act },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '2d' },
  );
}

/**
 * Verify + decode. Throws if the signature is bad, the token is expired, or the
 * purpose claim doesn't match — so callers can treat any throw as "unauthorized".
 * @returns {{ reminderId: string, uid: string, act: string }}
 */
function verifyActionToken(token) {
  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  if (payload.purpose !== PURPOSE) {
    throw new Error('Wrong token purpose');
  }
  return { reminderId: payload.sub, uid: payload.uid, act: payload.act };
}

module.exports = { signActionToken, verifyActionToken, PURPOSE };
