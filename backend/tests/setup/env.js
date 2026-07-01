// backend/tests/setup/env.js
// Runs before the test framework loads. Locks in deterministic env vars so the
// app boots the same way on every machine and CI. dotenv in app.js will NOT
// override anything already set here.
'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_do_not_use_in_prod';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_do_not_use_in_prod';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

// Effectively disable rate limiting during tests.
process.env.RATE_LIMIT_MAX = '1000000';
process.env.AUTH_RATE_LIMIT_MAX = '1000000';

// Silence noisy console during test runs (Winston still writes its own files).
process.env.LOG_LEVEL = 'error';
