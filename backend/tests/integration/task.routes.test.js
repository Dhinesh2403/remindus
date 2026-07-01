// backend/tests/integration/task.routes.test.js
'use strict';

const request = require('supertest');
const { app } = require('../../src/app');
const Task = require('../../src/models/Task');
const { createUser, authHeaderFor } = require('../helpers/factory');

describe('Task routes /api/tasks', () => {
  let user;
  let auth;

  beforeEach(async () => {
    user = await createUser();
    auth = authHeaderFor(user);
  });

  describe('authentication', () => {
    it('rejects unauthenticated access with 401', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects a malformed bearer token with 401', async () => {
      const res = await request(app).get('/api/tasks').set('Authorization', 'Bearer not.a.jwt');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/tasks', () => {
    it('creates a task with defaults and returns 201', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', auth)
        .send({ title: 'Write report' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Write report');
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.priority).toBe('medium');
      expect(res.body.data.userId).toBe(String(user._id));
    });

    it('persists supplied subtasks, filtering out blank titles', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', auth)
        .send({ title: 'Launch', subtasks: [{ title: 'A' }, { title: '   ' }, { title: 'B', done: true }] });

      expect(res.status).toBe(201);
      expect(res.body.data.subtasks).toHaveLength(2);
      expect(res.body.data.subtasks[1].done).toBe(true);
    });

    it('returns 422 when the title is missing', async () => {
      const res = await request(app).post('/api/tasks').set('Authorization', auth).send({ notes: 'x' });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/tasks', () => {
    it('returns only the caller’s tasks', async () => {
      const other = await createUser();
      await Task.create({ userId: other._id, title: 'Not mine' });
      await Task.create({ userId: user._id, title: 'Mine 1' });
      await Task.create({ userId: user._id, title: 'Mine 2' });

      const res = await request(app).get('/api/tasks').set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((t) => t.userId === String(user._id))).toBe(true);
    });

    it('filters by status query param', async () => {
      await Task.create({ userId: user._id, title: 'Active one' });
      await Task.create({ userId: user._id, title: 'Done one', status: 'done' });

      const res = await request(app).get('/api/tasks?status=done').set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Done one');
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns a single owned task', async () => {
      const t = await Task.create({ userId: user._id, title: 'Fetch me' });
      const res = await request(app).get(`/api/tasks/${t._id}`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Fetch me');
    });

    it('does not leak another user’s task (404)', async () => {
      const other = await createUser();
      const t = await Task.create({ userId: other._id, title: 'Secret' });
      const res = await request(app).get(`/api/tasks/${t._id}`).set('Authorization', auth);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('updates allowed fields', async () => {
      const t = await Task.create({ userId: user._id, title: 'Old' });
      const res = await request(app)
        .put(`/api/tasks/${t._id}`)
        .set('Authorization', auth)
        .send({ title: 'New', priority: 'high' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('New');
      expect(res.body.data.priority).toBe('high');
    });
  });

  describe('PATCH /api/tasks/:id/toggle', () => {
    it('flips active → done → active', async () => {
      const t = await Task.create({ userId: user._id, title: 'Toggle me' });

      const first = await request(app).patch(`/api/tasks/${t._id}/toggle`).set('Authorization', auth);
      expect(first.body.data.status).toBe('done');

      const second = await request(app).patch(`/api/tasks/${t._id}/toggle`).set('Authorization', auth);
      expect(second.body.data.status).toBe('active');
    });
  });

  describe('PATCH /api/tasks/:id/subtask', () => {
    it('toggles a single subtask by id', async () => {
      const t = await Task.create({ userId: user._id, title: 'Parent', subtasks: [{ title: 'child' }] });
      const subtaskId = t.subtasks[0]._id.toString();

      const res = await request(app)
        .patch(`/api/tasks/${t._id}/subtask`)
        .set('Authorization', auth)
        .send({ subtaskId });

      expect(res.status).toBe(200);
      expect(res.body.data.subtasks[0].done).toBe(true);
    });

    it('returns 422 when subtaskId is missing', async () => {
      const t = await Task.create({ userId: user._id, title: 'Parent', subtasks: [{ title: 'child' }] });
      const res = await request(app).patch(`/api/tasks/${t._id}/subtask`).set('Authorization', auth).send({});
      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('deletes an owned task then 404s on re-fetch', async () => {
      const t = await Task.create({ userId: user._id, title: 'Delete me' });

      const del = await request(app).delete(`/api/tasks/${t._id}`).set('Authorization', auth);
      expect(del.status).toBe(200);

      const refetch = await request(app).get(`/api/tasks/${t._id}`).set('Authorization', auth);
      expect(refetch.status).toBe(404);
    });

    it('cannot delete another user’s task (404)', async () => {
      const other = await createUser();
      const t = await Task.create({ userId: other._id, title: 'Theirs' });
      const res = await request(app).delete(`/api/tasks/${t._id}`).set('Authorization', auth);
      expect(res.status).toBe(404);
      expect(await Task.findById(t._id)).not.toBeNull();
    });
  });
});
