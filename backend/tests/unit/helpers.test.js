// backend/tests/unit/helpers.test.js
'use strict';

const { asyncHandler, AppError } = require('../../src/utils/helpers');

describe('utils/helpers', () => {
  describe('AppError', () => {
    it('defaults to status 500 and sets the message', () => {
      const err = new AppError('Boom');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('AppError');
      expect(err.message).toBe('Boom');
      expect(err.statusCode).toBe(500);
    });

    it('honours a custom status code', () => {
      const err = new AppError('Not found', 404);
      expect(err.statusCode).toBe(404);
    });

    it('attaches a field-errors array when provided', () => {
      const fields = [{ field: 'email', message: 'Invalid' }];
      const err = new AppError('Validation failed', 422, fields);
      expect(err.errors).toEqual(fields);
    });

    it('omits the errors property when none is passed', () => {
      const err = new AppError('X', 400);
      expect(err).not.toHaveProperty('errors');
    });

    it('captures a stack trace', () => {
      const err = new AppError('Trace me');
      expect(typeof err.stack).toBe('string');
      expect(err.stack.length).toBeGreaterThan(0);
    });
  });

  describe('asyncHandler', () => {
    const res = {};

    it('invokes the wrapped handler with (req, res, next)', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      const next = jest.fn();
      const req = { id: 1 };

      await asyncHandler(fn)(req, res, next);

      expect(fn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards a rejected promise to next()', async () => {
      const boom = new Error('async failure');
      const fn = jest.fn().mockRejectedValue(boom);
      const next = jest.fn();

      await asyncHandler(fn)({}, res, next);
      // allow the caught rejection microtask to settle
      await Promise.resolve();

      expect(next).toHaveBeenCalledWith(boom);
    });

    it('propagates a synchronous throw (only async rejections are caught)', () => {
      // asyncHandler wraps fn's RESULT in Promise.resolve(); a synchronous throw
      // escapes before that wrapping, so Express (not asyncHandler) handles it.
      const boom = new Error('sync failure');
      const fn = () => { throw boom; };
      const next = jest.fn();

      expect(() => asyncHandler(fn)({}, res, next)).toThrow('sync failure');
      expect(next).not.toHaveBeenCalled();
    });
  });
});
