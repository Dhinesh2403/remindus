// backend/tests/unit/models/User.model.test.js
'use strict';

const User = require('../../../src/models/User');

const base = (over = {}) => ({ name: 'Ada', email: 'ada@example.com', password: 'password123', ...over });

describe('User model', () => {
  it('requires name and email', () => {
    const err = new User({}).validateSync();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.email).toBeDefined();
  });

  it('rejects a malformed email', () => {
    const err = new User(base({ email: 'not-an-email' })).validateSync();
    expect(err.errors.email).toBeDefined();
  });

  it('lowercases and trims the email on save', async () => {
    const user = await User.create(base({ email: '  ADA@Example.COM ' }));
    expect(user.email).toBe('ada@example.com');
  });

  it('enforces email uniqueness', async () => {
    await User.create(base());
    await expect(User.create(base())).rejects.toThrow();
  });

  it('hashes the password (never stored in plaintext)', async () => {
    const user = await User.create(base());
    const withPw = await User.findById(user._id).select('+password');
    expect(withPw.password).toBeDefined();
    expect(withPw.password).not.toBe('password123');
  });

  it('comparePassword returns true for the right password and false otherwise', async () => {
    const user = await User.create(base());
    const withPw = await User.findById(user._id).select('+password');
    expect(await withPw.comparePassword('password123')).toBe(true);
    expect(await withPw.comparePassword('wrongpass')).toBe(false);
  });

  it('auto-generates an 8-character uppercase refId', async () => {
    const user = await User.create(base());
    expect(user.refId).toMatch(/^[A-Z0-9]{8}$/);
    // Unambiguous alphabet excludes 0/O/1/I/L
    expect(user.refId).not.toMatch(/[OIL01]/);
  });

  it('generateUniqueRefId returns distinct codes', async () => {
    const a = await User.generateUniqueRefId();
    const b = await User.generateUniqueRefId();
    expect(a).toMatch(/^[A-Z0-9]{8}$/);
    expect(a).not.toBe(b);
  });

  it('rejects an invalid gender enum', () => {
    const err = new User(base({ gender: 'unknown' })).validateSync();
    expect(err.errors.gender).toBeDefined();
  });

  it('accepts a valid gender', async () => {
    const user = await User.create(base({ gender: 'female' }));
    expect(user.gender).toBe('female');
  });

  it('strips password, refreshTokens and otp from toJSON output', async () => {
    const user = await User.create(base());
    const json = user.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.refreshTokens).toBeUndefined();
    expect(json.otp).toBeUndefined();
    expect(json.email).toBe('ada@example.com');
  });

  it('defaults role to user and isPremium to false', async () => {
    const user = await User.create(base());
    expect(user.role).toBe('user');
    expect(user.isPremium).toBe(false);
  });
});
