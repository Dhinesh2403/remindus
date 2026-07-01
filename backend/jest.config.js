// backend/jest.config.js
'use strict';

/**
 * Jest configuration for the RemindMe backend.
 *
 * - `setupFiles`         run once per test file BEFORE the framework loads —
 *                        we use it to lock in deterministic env vars.
 * - `setupFilesAfterEnv` run after the framework loads — spins up an isolated
 *                        in-memory MongoDB and wires Mongoose to it.
 *
 * Run with `npm test` (adds --coverage). Use `--runInBand` in CI so each test
 * file gets its own Mongo instance without port contention.
 */
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/db.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!src/seed/**',
    '!src/config/**',
    '!src/jobs/**',
    '!src/sockets/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  testTimeout: 60000,
  clearMocks: true,
  verbose: true,
};
