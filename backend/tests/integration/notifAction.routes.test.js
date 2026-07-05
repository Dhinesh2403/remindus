// backend/tests/integration/notifAction.routes.test.js
'use strict';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const { app } = require('../../src/app');
const Reminder = require('../../src/models/Reminder');
const { signActionToken } = require('../../src/utils/notif-action');
const { createUser } = require('../helpers/factory');

// Creates a reminder OWNED by `owner`, assigned to `assignee`, due `minsFromNow`
// minutes out (window 0 so nextFireAt is the exact due instant).
async function assignedReminder(owner, assignee, minsFromNow = 30) {
  const due = new Date(Date.now() + minsFromNow * 60 * 1000);
  const hh = String(due.getUTCHours()).padStart(2, '0');
  const mm = String(due.getUTCMinutes()).padStart(2, '0');
  return Reminder.create({
    userId: owner._id,
    assignedTo: assignee._id,
    assignedBy: owner._id,
    sharedStatus: 'sent',
    title: 'Wash the car',
    date: due,
    time: `${hh}:${mm}`,
    reminderWindowMinutes: 0,
    nextFireAt: due,
  });
}

describe('POST /api/reminders/notif-action (public, token-authorised)', () => {
  let owner, assignee;

  beforeEach(async () => {
    owner    = await createUser();
    assignee = await createUser();
  });

  it('is public — needs no auth header, only the signed token', async () => {
    const reminder = await assignedReminder(owner, assignee);
    const token = signActionToken({ reminderId: reminder._id, uid: assignee._id, act: 'ack_assigned' });

    const res = await request(app).post('/api/reminders/notif-action').send({ token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('ack_assigned sets sharedStatus=acknowledged (does NOT complete the reminder)', async () => {
    const reminder = await assignedReminder(owner, assignee);
    const token = signActionToken({ reminderId: reminder._id, uid: assignee._id, act: 'ack_assigned' });

    const res = await request(app).post('/api/reminders/notif-action').send({ token });
    expect(res.status).toBe(200);
    expect(res.body.sharedStatus).toBe('acknowledged');

    const after = await Reminder.findById(reminder._id);
    expect(after.sharedStatus).toBe('acknowledged');
    expect(after.status).toBe('pending'); // still pending — acknowledge ≠ done
  });

  it('snooze5_assigned reschedules +5 min, snoozes, and re-arms the pre-alert', async () => {
    const reminder = await assignedReminder(owner, assignee, 30);
    await Reminder.findByIdAndUpdate(reminder._id, { preAlertSent: true });
    const token = signActionToken({ reminderId: reminder._id, uid: assignee._id, act: 'snooze5_assigned' });

    const before = Date.now();
    const res = await request(app).post('/api/reminders/notif-action').send({ token });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('snoozed');

    const after = await Reminder.findById(reminder._id);
    expect(after.status).toBe('snoozed');
    expect(after.preAlertSent).toBe(false);
    expect(after.reminderWindowMinutes).toBe(0);
    const deltaMin = (after.nextFireAt.getTime() - before) / 60000;
    expect(deltaMin).toBeGreaterThan(4.5);
    expect(deltaMin).toBeLessThan(5.5);
  });

  it('rejects a token whose uid is not the assignee (404)', async () => {
    const reminder = await assignedReminder(owner, assignee);
    const stranger = await createUser();
    const token = signActionToken({ reminderId: reminder._id, uid: stranger._id, act: 'ack_assigned' });

    const res = await request(app).post('/api/reminders/notif-action').send({ token });
    expect(res.status).toBe(404); // scoped by assignedTo — stranger owns nothing
  });

  it('rejects a token signed with the wrong secret (401)', async () => {
    const reminder = await assignedReminder(owner, assignee);
    const bad = jwt.sign(
      { purpose: 'notif_action', sub: String(reminder._id), uid: String(assignee._id), act: 'ack_assigned' },
      'the_wrong_secret',
      { expiresIn: '2d' },
    );

    const res = await request(app).post('/api/reminders/notif-action').send({ token: bad });
    expect(res.status).toBe(401);
  });

  it('rejects a non-action-purpose JWT (401)', async () => {
    const reminder = await assignedReminder(owner, assignee);
    // A regular access-style token — right secret, wrong purpose.
    const accessLike = jwt.sign({ sub: String(assignee._id) }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    void reminder;

    const res = await request(app).post('/api/reminders/notif-action').send({ token: accessLike });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown action id (400)', async () => {
    const reminder = await assignedReminder(owner, assignee);
    const token = signActionToken({ reminderId: reminder._id, uid: assignee._id, act: 'launch_rocket' });

    const res = await request(app).post('/api/reminders/notif-action').send({ token });
    expect(res.status).toBe(400);
  });

  it('400s when the token is missing entirely', async () => {
    const res = await request(app).post('/api/reminders/notif-action').send({});
    expect(res.status).toBe(400);
  });
});
