// backend/src/models/User.js
'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String, required: true, unique: true,
      lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password:      { type: String, select: false, minlength: 8 },
    avatar:        { type: String, default: null },
    role:          { type: String, enum: ['user', 'admin'], default: 'user' },

    // Shareable friend code (e.g. "K7P2X9Q4"). Unique, generated on creation.
    // `sparse` so legacy users without one don't collide on the null value.
    refId:         { type: String, unique: true, sparse: true, uppercase: true, trim: true },

    isPremium:     { type: Boolean, default: false },
    premiumExpiry: { type: Date, default: null },

    // Gamification
    streak:        { type: Number, default: 0 },
    bestStreak:    { type: Number, default: 0 },
    lastActiveAt:  { type: Date, default: null },
    completedCount:{ type: Number, default: 0 },

    // Notification preferences — delivery channels
    notifPrefs: {
      push:      { type: Boolean, default: true },
      email:     { type: Boolean, default: true },
      sms:       { type: Boolean, default: false },
      whatsapp:  { type: Boolean, default: false },
    },

    // Notification preferences — per-category on/off switches. When a category
    // is off, the server skips all delivery (in-app + push) for that type.
    notifTypes: {
      reminders:      { type: Boolean, default: true },
      chat:           { type: Boolean, default: true },
      friendRequests: { type: Boolean, default: true },
      other:          { type: Boolean, default: true },
    },

    // Push subscription (Web Push / VAPID)
    pushSubscription: {
      endpoint: String,
      keys:     { auth: String, p256dh: String },
    },

    // FCM token for Firebase push notifications (mobile)
    fcmToken: { type: String, default: null },

    // Phone (for SMS/WhatsApp)
    phone:         { type: String, default: null },

    // Auth
    isEmailVerified: { type: Boolean, default: false },
    otp:           { type: String, select: false },
    otpExpiry:     { type: Date,   select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpiry:{ type: Date,   select: false },
    refreshTokens: [{ type: String, select: false }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.otp;
        delete ret.otpExpiry;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Unambiguous alphabet — no 0/O/1/I/L to avoid confusion when typed/shared.
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomRefId(len = 8) {
  let code = '';
  for (let i = 0; i < len; i++) {
    code += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return code;
}

// Generate a refId that isn't already taken (retries on the rare collision).
userSchema.statics.generateUniqueRefId = async function () {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = randomRefId();
    const exists = await this.exists({ refId: candidate });
    if (!exists) return candidate;
  }
  // Extremely unlikely fallback — widen the space.
  return randomRefId(10);
};

// Assign a refId to every new user (covers all signup paths).
userSchema.pre('save', async function (next) {
  if (!this.refId) {
    this.refId = await this.constructor.generateUniqueRefId();
  }
  next();
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.virtual('completionRate').get(function () {
  // Populated by aggregation in the controller; placeholder
  return 0;
});

module.exports = mongoose.model('User', userSchema);
