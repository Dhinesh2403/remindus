// backend/tests/integration/user.routes.test.js
'use strict';

const request = require('supertest');
const { app } = require('../../src/app');
const User = require('../../src/models/User');
const { createUser, authHeaderFor } = require('../helpers/factory');

describe('User routes /api/users', () => {
  let user;
  let auth;

  beforeEach(async () => {
    user = await createUser({ name: 'Original Name' });
    auth = authHeaderFor(user);
  });

  it('GET /api/users/me returns the authenticated profile', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Original Name');
    expect(res.body.password).toBeUndefined();
  });

  describe('PUT /api/users/profile (edit-profile alias)', () => {
    it('updates name, phone, gender and dob', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', auth)
        .send({ name: 'New Name', phone: '+15550142', gender: 'female', dob: '1994-06-12' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
      expect(res.body.phone).toBe('+15550142');
      expect(res.body.gender).toBe('female');

      const persisted = await User.findById(user._id);
      expect(persisted.name).toBe('New Name');
      expect(persisted.gender).toBe('female');
    });

    it('ignores fields that are not in the allow-list (e.g. role escalation)', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', auth)
        .send({ name: 'Safe', role: 'admin', isPremium: true });

      expect(res.status).toBe(200);
      const persisted = await User.findById(user._id);
      expect(persisted.role).toBe('user');       // unchanged
      expect(persisted.isPremium).toBe(false);    // unchanged
    });

    it('requires authentication', async () => {
      const res = await request(app).put('/api/users/profile').send({ name: 'X' });
      expect(res.status).toBe(401);
    });
  });
});
