// backend/src/models/DeviceLog.js
'use strict';

const mongoose = require('mongoose');

/**
 * Client-side log/crash entry uploaded from a device for the admin dashboard.
 * A TTL index auto-deletes entries after 30 days so the collection can't grow
 * unbounded.
 */
const deviceLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    level:   { type: String, enum: ['debug', 'info', 'warn', 'error', 'fatal'], default: 'info', index: true },
    message: { type: String, required: true, maxlength: 4000 },
    stack:   { type: String, maxlength: 8000, default: null },
    context: { type: mongoose.Schema.Types.Mixed, default: null }, // arbitrary structured payload

    // ── Device / app metadata ─────────────────────────────────────────────
    platform:   { type: String, default: 'unknown' }, // android | ios | web
    appVersion: { type: String, default: null },       // versionName
    appBuild:   { type: Number, default: null },        // versionCode
    osVersion:  { type: String, default: null },
    deviceModel:{ type: String, default: null },
    deviceId:   { type: String, default: null, index: true }, // per-install id
    sessionId:  { type: String, default: null },               // per-run id

    // Client timestamp (may differ from server createdAt due to clock skew)
    clientTime: { type: Date, default: null },
  },
  { timestamps: true }
);

// Auto-expire after 30 days.
deviceLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
// Common admin query: newest-first, optionally filtered by level/platform.
deviceLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DeviceLog', deviceLogSchema);
