// backend/scripts/test-push-remote.js
// Trigger the DEPLOYED server's own FCM send (POST /api/users/me/test-push)
// and print the raw outcome. Signs a short-lived JWT with the local
// JWT_ACCESS_SECRET — works only if it matches the deployment's secret.
//
// Usage: node scripts/test-push-remote.js [userEmail]
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.staging') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const EMAIL = process.argv[2] || 'dhineshdk024@gmail.com';
const BASE  = process.env.REMOTE_API || 'https://remindus.onrender.com';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../src/models/User');
  const user = await User.findOne({ email: EMAIL }).select('_id name').lean();
  await mongoose.disconnect();
  if (!user) { console.error('User not found:', EMAIL); process.exit(1); }

  console.log('User:', user.name, String(user._id));
  const token = jwt.sign({ sub: String(user._id) }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });

  const res = await fetch(`${BASE}/api/users/me/test-push`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  console.log('HTTP', res.status);
  const body = await res.text();
  try { console.log(JSON.stringify(JSON.parse(body), null, 2)); }
  catch { console.log(body); }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
