// backend/tests/unit/models/Task.model.test.js
'use strict';

const mongoose = require('mongoose');
const Task = require('../../../src/models/Task');

const uid = () => new mongoose.Types.ObjectId();

describe('Task model', () => {
  it('requires a userId and a title', async () => {
    const task = new Task({});
    const err = task.validateSync();
    expect(err.errors.userId).toBeDefined();
    expect(err.errors.title).toBeDefined();
  });

  it('applies sensible defaults', async () => {
    const task = await Task.create({ userId: uid(), title: 'Buy milk' });
    expect(task.status).toBe('active');
    expect(task.priority).toBe('medium');
    expect(task.category).toBe('Personal');
    expect(task.notes).toBe('');
    expect(task.reminderType).toBe('notification');
    expect(task.repeat).toBe('Does not repeat');
    expect(task.subtasks).toEqual([]);
    expect(task.assignedTo).toBeNull();
    expect(task.createdAt).toBeInstanceOf(Date);
  });

  it('rejects an invalid priority', () => {
    const task = new Task({ userId: uid(), title: 'X', priority: 'urgent' });
    const err = task.validateSync();
    expect(err.errors.priority).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const task = new Task({ userId: uid(), title: 'X', status: 'archived' });
    const err = task.validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('rejects an invalid reminderType', () => {
    const task = new Task({ userId: uid(), title: 'X', reminderType: 'carrier-pigeon' });
    const err = task.validateSync();
    expect(err.errors.reminderType).toBeDefined();
  });

  it('enforces the title max length (200)', () => {
    const task = new Task({ userId: uid(), title: 'a'.repeat(201) });
    const err = task.validateSync();
    expect(err.errors.title).toBeDefined();
  });

  it('stores subtasks as subdocuments with their own _id and done=false default', async () => {
    const task = await Task.create({
      userId: uid(),
      title: 'Ship release',
      subtasks: [{ title: 'Write tests' }, { title: 'Deploy', done: true }],
    });
    expect(task.subtasks).toHaveLength(2);
    expect(task.subtasks[0]._id).toBeDefined();
    expect(task.subtasks[0].done).toBe(false);
    expect(task.subtasks[1].done).toBe(true);
  });

  it('requires a title on each subtask', () => {
    const task = new Task({ userId: uid(), title: 'X', subtasks: [{ done: true }] });
    const err = task.validateSync();
    expect(err).toBeDefined();
  });
});
