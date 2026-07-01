// backend/src/models/AppConfig.js
'use strict';

const mongoose = require('mongoose');

/**
 * Singleton document holding remote app-lifecycle configuration:
 * version gates (force/normal update) and maintenance mode. Editable at runtime
 * from the admin dashboard so update behaviour can change WITHOUT a client
 * release. Use `AppConfig.getSingleton()` — never create more than one.
 *
 * Version decisions are made on the integer build (Android `versionCode`),
 * which is the reliable, monotonically-increasing value. `versionName` is
 * display-only.
 */
const appConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'singleton', unique: true },

    // ── Android ───────────────────────────────────────────────────────────
    androidLatestVersion: { type: String, default: '1.0.0' }, // versionName
    androidLatestBuild:   { type: Number, default: 1 },        // versionCode published to Play
    androidMinBuild:      { type: Number, default: 1 },        // below this ⇒ FORCE update

    // ── iOS (kept for parity; unused until an iOS build ships) ────────────
    iosLatestVersion: { type: String, default: '1.0.0' },
    iosLatestBuild:   { type: Number, default: 1 },
    iosMinBuild:      { type: Number, default: 1 },

    // ── Store links ───────────────────────────────────────────────────────
    androidUpdateUrl: { type: String, default: 'https://play.google.com/store/apps/details?id=com.remindus.app' },
    iosUpdateUrl:     { type: String, default: '' },

    // ── Maintenance ───────────────────────────────────────────────────────
    maintenanceMode:    { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'We are performing scheduled maintenance. Please try again shortly.' },

    // ── Copy shown on the update screen ──────────────────────────────────
    forceUpdateMessage:  { type: String, default: 'A newer version of the app is required to continue.' },
    normalUpdateMessage: { type: String, default: 'A new version is available with improvements and fixes.' },
  },
  { timestamps: true }
);

/** Fetch the one config doc, creating it with defaults on first use. */
appConfigSchema.statics.getSingleton = async function getSingleton() {
  let cfg = await this.findOne({ key: 'singleton' });
  if (!cfg) cfg = await this.create({ key: 'singleton' });
  return cfg;
};

module.exports = mongoose.model('AppConfig', appConfigSchema);
