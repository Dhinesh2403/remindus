// backend/tests/helpers/factory.js
// Small factory + auth helpers shared across integration suites.
'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../../src/models/User');

let counter = 0;

/**
 * Create a persisted user. Password is hashed by the model's pre-save hook and
 * a unique refId is generated automatically.
 */
async function createUser(overrides = {}) {
  counter += 1;
  return User.create({
    name: `Test User ${counter}`,
    email: `user${counter}.${Date.now()}@example.com`,
    password: 'password123',
    ...overrides,
  });
}

/** Sign a valid access token for a user (mirrors auth.controller's factory). */
function accessTokenFor(user) {
  return jwt.sign({ sub: user._id }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

/** Convenience: `Authorization` header value for a user. */
function authHeaderFor(user) {
  return `Bearer ${accessTokenFor(user)}`;
}

module.exports = { createUser, accessTokenFor, authHeaderFor };
