// backend/tests/integration/auth.routes.test.js
'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const { createUser } = require('../helpers/factory');

describe('Auth routes /api/auth', () => {
  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials and returns tokens', async () => {
      const user = await createUser({ email: 'login@example.com', password: 'password123' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.tokens.accessToken).toEqual(expect.any(String));
      expect(res.body.tokens.refreshToken).toEqual(expect.any(String));
      // sensitive fields must never be returned
      expect(res.body.user.password).toBeUndefined();
      expect(user).toBeDefined();
    });

    it('rejects a wrong password with 401', async () => {
      await createUser({ email: 'wrong@example.com', password: 'password123' });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@example.com', password: 'nope' });
      expect(res.status).toBe(401);
    });

    it('rejects an unknown email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'password123' });
      expect(res.status).toBe(401);
    });

    it('returns 422 for a malformed email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'x' });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates a valid refresh token', async () => {
      await createUser({ email: 'refresh@example.com', password: 'password123' });
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'refresh@example.com', password: 'password123' });

      const { refreshToken } = login.body.tokens;
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));

      // The freshly issued access token must authenticate a protected route.
      const decoded = jwt.verify(res.body.accessToken, process.env.JWT_ACCESS_SECRET);
      expect(decoded.sub).toBeDefined();

      const me = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`);
      expect(me.status).toBe(200);
    });

    it('rejects a garbage refresh token with 401', async () => {
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'garbage' });
      expect(res.status).toBe(401);
    });

    it('rejects a valid-signature token that was never issued (revoked) with 401', async () => {
      const user = await createUser();
      const forged = jwt.sign({ sub: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: forged });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the authenticated user', async () => {
      await createUser({ email: 'me@example.com', password: 'password123' });
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'me@example.com', password: 'password123' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('me@example.com');
    });

    it('rejects without a token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
