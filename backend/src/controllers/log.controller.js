// backend/src/controllers/log.controller.js
'use strict';

const DeviceLog = require('../models/DeviceLog');
const { asyncHandler } = require('../utils/helpers');

const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const MAX_BATCH = 100;

// ── POST /api/logs/device ───────────────────────────────────────────────────
// Authenticated. Body: { device: {...}, logs: [{ level, message, stack, context, clientTime }] }
// Tolerant by design — a bad/oversized entry is skipped, never 500s, so client
// logging can't take the app down.
exports.ingest = asyncHandler(async (req, res) => {
  const { device = {}, logs = [] } = req.body || {};
  if (!Array.isArray(logs) || logs.length === 0) {
    return res.json({ success: true, inserted: 0 });
  }

  const meta = {
    userId:      req.user?._id ?? null,
    platform:    String(device.platform || 'unknown').slice(0, 40),
    appVersion:  device.appVersion ? String(device.appVersion).slice(0, 40) : null,
    appBuild:    Number.isFinite(Number(device.appBuild)) ? Number(device.appBuild) : null,
    osVersion:   device.osVersion ? String(device.osVersion).slice(0, 120) : null,
    deviceModel: device.deviceModel ? String(device.deviceModel).slice(0, 120) : null,
    deviceId:    device.deviceId ? String(device.deviceId).slice(0, 120) : null,
    sessionId:   device.sessionId ? String(device.sessionId).slice(0, 120) : null,
  };

  const docs = logs.slice(0, MAX_BATCH).map((l) => ({
    ...meta,
    level:      LEVELS.includes(l.level) ? l.level : 'info',
    message:    String(l.message ?? '').slice(0, 4000) || '(empty)',
    stack:      l.stack ? String(l.stack).slice(0, 8000) : null,
    context:    l.context ?? null,
    clientTime: l.clientTime ? new Date(l.clientTime) : null,
  }));

  await DeviceLog.insertMany(docs, { ordered: false }).catch(() => {});
  res.json({ success: true, inserted: docs.length });
});
