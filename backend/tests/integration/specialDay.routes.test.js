// backend/tests/integration/specialDay.routes.test.js
'use strict';

const request = require('supertest');
const { app } = require('../../src/app');
const SpecialDay = require('../../src/models/SpecialDay');
const { createUser, authHeaderFor } = require('../helpers/factory');

describe('SpecialDay routes /api/special-days', () => {
  let user;
  let auth;

  beforeEach(async () => {
    user = await createUser();
    auth = authHeaderFor(user);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/special-days');
    expect(res.status).toBe(401);
  });

  describe('POST /api/special-days', () => {
    it('creates a special day and returns 201 with a daysUntil virtual', async () => {
      const res = await request(app)
        .post('/api/special-days')
        .set('Authorization', auth)
        .send({ name: 'Mom’s Birthday', type: 'birthday', month: 6, day: 12 });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Mom’s Birthday');
      expect(res.body.data.color).toBe('#E0699B');
      expect(res.body.data).toHaveProperty('daysUntil');
    });

    it('rejects an invalid type with 422', async () => {
      const res = await request(app)
        .post('/api/special-days')
        .set('Authorization', auth)
        .send({ name: 'X', type: 'graduation', month: 6, day: 12 });
      expect(res.status).toBe(422);
    });

    it('rejects an out-of-range month with 422', async () => {
      const res = await request(app)
        .post('/api/special-days')
        .set('Authorization', auth)
        .send({ name: 'X', type: 'event', month: 13, day: 12 });
      expect(res.status).toBe(422);
    });

    it('rejects a missing name with 422', async () => {
      const res = await request(app)
        .post('/api/special-days')
        .set('Authorization', auth)
        .send({ type: 'event', month: 5, day: 1 });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/special-days', () => {
    it('returns only the caller’s entries, sorted by month then day', async () => {
      const other = await createUser();
      await SpecialDay.create({ userId: other._id, name: 'Theirs', type: 'event', month: 1, day: 1 });
      await SpecialDay.create({ userId: user._id, name: 'B', type: 'event', month: 8, day: 3 });
      await SpecialDay.create({ userId: user._id, name: 'A', type: 'event', month: 2, day: 9 });

      const res = await request(app).get('/api/special-days').set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('A'); // month 2 before month 8
    });

    it('filters by type query param', async () => {
      await SpecialDay.create({ userId: user._id, name: 'Bday', type: 'birthday', month: 3, day: 3 });
      await SpecialDay.create({ userId: user._id, name: 'Anni', type: 'anniversary', month: 4, day: 4 });

      const res = await request(app).get('/api/special-days?type=birthday').set('Authorization', auth);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('birthday');
    });
  });

  describe('PUT /api/special-days/:id', () => {
    it('updates an owned entry', async () => {
      const d = await SpecialDay.create({ userId: user._id, name: 'Old', type: 'event', month: 1, day: 1 });
      const res = await request(app)
        .put(`/api/special-days/${d._id}`)
        .set('Authorization', auth)
        .send({ name: 'Renamed', color: '#3D5AF1' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Renamed');
      expect(res.body.data.color).toBe('#3D5AF1');
    });

    it('returns 404 when updating another user’s entry', async () => {
      const other = await createUser();
      const d = await SpecialDay.create({ userId: other._id, name: 'Theirs', type: 'event', month: 1, day: 1 });
      const res = await request(app).put(`/api/special-days/${d._id}`).set('Authorization', auth).send({ name: 'Hack' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/special-days/:id', () => {
    it('deletes an owned entry', async () => {
      const d = await SpecialDay.create({ userId: user._id, name: 'Bye', type: 'event', month: 1, day: 1 });
      const res = await request(app).delete(`/api/special-days/${d._id}`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(await SpecialDay.findById(d._id)).toBeNull();
    });
  });
});
