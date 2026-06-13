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

    isPremium:     { type: Boolean, default: false },
    premiumExpiry: { type: Date, default: null },

    // Gamification
    streak:        { type: Number, default: 0 },
    bestStreak:    { type: Number, default: 0 },
    lastActiveAt:  { type: Date, default: null },
    completedCount:{ type: Number, default: 0 },

    // Notification preferences
    notifPrefs: {
      push:      { type: Boolean, default: true },
      email:     { type: Boolean, default: true },
      sms:       { type: Boolean, default: false },
      whatsapp:  { type: Boolean, default: false },
    },

    // Push subscription (Web Push)
    pushSubscription: {
      endpoint: String,
      keys:     { auth: String, p256dh: String },
    },

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
