'use strict';

const jwt = require('jsonwebtoken');
const { signActionToken, verifyActionToken } = require('../../src/utils/notif-action');

describe('notif-action token', () => {
  test('sign → verify round-trips reminderId / uid / act', () => {
    const token = signActionToken({ reminderId: 'r1', uid: 'u1', act: 'ack' });
    expect(verifyActionToken(token)).toEqual({ reminderId: 'r1', uid: 'u1', act: 'ack' });
  });

  test('rejects a tampered / garbage token', () => {
    expect(() => verifyActionToken('not.a.jwt')).toThrow();
  });

  test('rejects a normal access token (wrong purpose claim)', () => {
    const accessToken = jwt.sign({ sub: 'u1' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    expect(() => verifyActionToken(accessToken)).toThrow(/purpose/i);
  });

  test('rejects an expired action token', () => {
    const expired = jwt.sign(
      { purpose: 'notif_action', sub: 'r1', uid: 'u1', act: 'ack' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: -10 },
    );
    expect(() => verifyActionToken(expired)).toThrow();
  });
});
