// backend/tests/unit/models/SpecialDay.model.test.js
'use strict';

const mongoose = require('mongoose');
const SpecialDay = require('../../../src/models/SpecialDay');

const uid = () => new mongoose.Types.ObjectId();
const base = (over = {}) => ({ userId: uid(), name: 'Mom', type: 'birthday', month: 6, day: 12, ...over });

describe('SpecialDay model', () => {
  it('requires userId, name, type, month and day', () => {
    const err = new SpecialDay({}).validateSync();
    expect(err.errors.userId).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.type).toBeDefined();
    expect(err.errors.month).toBeDefined();
    expect(err.errors.day).toBeDefined();
  });

  it('accepts a valid document and applies the default colour', async () => {
    const doc = await SpecialDay.create(base());
    expect(doc.color).toBe('#E0699B');
    expect(doc.note).toBe('');
    expect(doc.year).toBeNull();
  });

  it('rejects an invalid type', () => {
    const err = new SpecialDay(base({ type: 'graduation' })).validateSync();
    expect(err.errors.type).toBeDefined();
  });

  it('enforces month range 1–12', () => {
    expect(new SpecialDay(base({ month: 0 })).validateSync().errors.month).toBeDefined();
    expect(new SpecialDay(base({ month: 13 })).validateSync().errors.month).toBeDefined();
  });

  it('enforces day range 1–31', () => {
    expect(new SpecialDay(base({ day: 0 })).validateSync().errors.day).toBeDefined();
    expect(new SpecialDay(base({ day: 32 })).validateSync().errors.day).toBeDefined();
  });

  it('exposes a numeric daysUntil virtual within a year', async () => {
    const doc = await SpecialDay.create(base());
    expect(typeof doc.daysUntil).toBe('number');
    expect(doc.daysUntil).toBeGreaterThanOrEqual(0);
    expect(doc.daysUntil).toBeLessThanOrEqual(366);
  });

  it('serialises the daysUntil virtual in toJSON output', async () => {
    const doc = await SpecialDay.create(base());
    const json = doc.toJSON();
    expect(json).toHaveProperty('daysUntil');
    expect(json).toHaveProperty('id'); // mongoose virtual id also enabled
  });
});
