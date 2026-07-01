// backend/src/controllers/app.controller.js
'use strict';

const AppConfig = require('../models/AppConfig');
const { asyncHandler } = require('../utils/helpers');

/**
 * Resolve the update decision for a given platform + installed build against the
 * remote AppConfig gates.
 */
function decide(cfg, platform, installedBuild) {
  const isIos = platform === 'ios';
  const latestBuild = isIos ? cfg.iosLatestBuild : cfg.androidLatestBuild;
  const minBuild    = isIos ? cfg.iosMinBuild    : cfg.androidMinBuild;
  const latestName  = isIos ? cfg.iosLatestVersion : cfg.androidLatestVersion;
  const updateUrl   = isIos ? cfg.iosUpdateUrl    : cfg.androidUpdateUrl;

  const build = Number.isFinite(installedBuild) ? installedBuild : latestBuild;

  const forceUpdate     = build < minBuild;
  const updateAvailable = build < latestBuild;

  return {
    updateAvailable,
    forceUpdate,
    latestVersion: latestName,
    latestBuild,
    minBuild,
    updateUrl,
    maintenanceMode: cfg.maintenanceMode,
    maintenanceMessage: cfg.maintenanceMode ? cfg.maintenanceMessage : null,
    message: forceUpdate ? cfg.forceUpdateMessage
      : updateAvailable ? cfg.normalUpdateMessage
      : 'You are on the latest version.',
  };
}

// ── POST /api/app/version-check ─────────────────────────────────────────────
// Public. Body: { platform, versionCode, versionName }
exports.versionCheck = asyncHandler(async (req, res) => {
  const { platform = 'android', versionCode } = req.body || {};
  const cfg = await AppConfig.getSingleton();
  const installedBuild = Number(versionCode);

  res.json({ success: true, data: decide(cfg, platform, installedBuild) });
});

// ── GET /api/app/config ─────────────────────────────────────────────────────
// Public, read-only snapshot (no params). Handy for a lightweight boot check.
exports.getConfig = asyncHandler(async (_req, res) => {
  const cfg = await AppConfig.getSingleton();
  res.json({
    success: true,
    data: {
      androidLatestVersion: cfg.androidLatestVersion,
      androidLatestBuild:   cfg.androidLatestBuild,
      androidMinBuild:      cfg.androidMinBuild,
      androidUpdateUrl:     cfg.androidUpdateUrl,
      maintenanceMode:      cfg.maintenanceMode,
      maintenanceMessage:   cfg.maintenanceMode ? cfg.maintenanceMessage : null,
    },
  });
});
