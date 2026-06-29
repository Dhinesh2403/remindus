// backend/src/config/cloudinary.js
'use strict';

const { v2: cloudinary } = require('cloudinary');
const logger = require('../utils/logger');

// Configure from either CLOUDINARY_URL or the discrete vars.
const ready = !!(process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME &&
   process.env.CLOUDINARY_API_KEY &&
   process.env.CLOUDINARY_API_SECRET));

if (ready) {
  // The SDK reads CLOUDINARY_URL automatically; set discrete vars explicitly too.
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure:     true,
    });
  } else {
    cloudinary.config({ secure: true });
  }
  logger.info('Cloudinary configured — avatar uploads enabled.');
} else {
  logger.warn('Cloudinary env vars not set — avatar uploads disabled.');
}

// Per-environment base folder in Cloudinary (must match the folders created in
// the dashboard). Asset types live in subfolders, e.g. `remindus_dev/avatars`.
const ENV_FOLDERS = {
  development: 'remindus_dev',
  staging:    'remindus_stag',
  production: 'remindus_prod',
};
const cloudinaryFolder = ENV_FOLDERS[process.env.NODE_ENV] || 'remindus_dev';

module.exports = { cloudinary, cloudinaryReady: ready, cloudinaryFolder };
