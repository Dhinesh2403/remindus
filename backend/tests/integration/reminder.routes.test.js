// backend/tests/integration/reminder.routes.test.js
'use strict';

const request = require('supertest');
const { app } = require('../../src/app');
const Reminder = require('../../src/models/Reminder');
const { signActionToken } = require('../../src/utils/notif-action');
const { createUser, authHeaderFor } = require('../helpers/factory');

describe('Reminder routes /api/reminders', () => {
  let user;
  let auth;

  beforeEach(async () => {
    user = await createUser();
    auth = authHeaderFor(user);
  });

  describe('PUT /:id recomputes nextFireAt', () => {
    it('moves nextFireAt when the time is edited (findOneAndUpdate bypasses the hook)', async () => {
      const created = await request(app)
        .post('/api/reminders')
        .set('Authorization', auth)
        .send({ title: 'Standup', date: '2026-07-10', time: '09:00', reminderWindowMinutes: 0 });
      expect(created.status).toBe(201);
      const id = created.body.data._id;
      const before = new Date(created.body.data.nextFireAt).getTime();

      const updated = await request(app)
        .put(`/api/reminders/${id}`)
        .set('Authorization', auth)
        .send({ time: '11:00' });
      expect(updated.status).toBe(200);

      const after = new Date(updated.body.data.nextFireAt).getTime();
      // 09:00 → 11:00 is +2h; nextFireAt must move, not stay stale.
      expect(after - before).toBe(2 * 60 * 60 * 1000);
    });
  });

  describe('POST /notif-action (public, token-authorised)', () => {
    it('marks a reminder done with an "ack" token — no login session', async () => {
      const reminder = await Reminder.create({
        userId: user._id, title: 'Take meds', date: new Date('2026-07-10'), time: '09:00',
        reminderWindowMinutes: 0, status: 'pending',
      });
      const token = signActionToken({ reminderId: String(reminder._id), uid: String(user._id), act: 'ack' });

      const res = await request(app).post('/api/reminders/notif-action').send({ token });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');

      const fresh = await Reminder.findById(reminder._id).lean();
      expect(fresh.status).toBe('done');
    });

    it('snoozes 5 minutes with a "snooze5" token and normalises the window to 0', async () => {
      const reminder = await Reminder.create({
        userId: user._id, title: 'Call mom', date: new Date('2026-07-10'), time: '09:00',
        reminderWindowMinutes: 30, status: 'pending',
      });
      const token = signActionToken({ reminderId: String(reminder._id), uid: String(user._id), act: 'snooze5' });

      const res = await request(app).post('/api/reminders/notif-action').send({ token });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('snoozed');

      const fresh = await Reminder.findById(reminder._id).lean();
      expect(fresh.reminderWindowMinutes).toBe(0);
      expect(new Date(fresh.nextFireAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects a forged token with 401', async () => {
      const res = await request(app).post('/api/reminders/notif-action').send({ token: 'forged.token.x' });
      expect(res.status).toBe(401);
    });
  });
});
