// backend/src/routes/reminder.routes.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const ctrl   = require('../controllers/reminder.controller');
const { authenticate }  = require('../middlewares/auth');
const { validate }      = require('../middlewares/validate');

router.use(authenticate);

router.get('/',              ctrl.getAll);
router.get('/stats/summary', ctrl.getStats);
router.get('/:id',           ctrl.getById);

router.post('/',
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
    body('date').notEmpty().withMessage('Date is required'),
    body('time').matches(/^\d{2}:\d{2}$/).withMessage('Time must be HH:mm format'),
  ],
  validate,
  ctrl.create
);

router.put('/:id',   ctrl.update);
router.delete('/:id', ctrl.remove);

router.patch('/:id/done',  ctrl.markDone);
router.patch('/:id/snooze',
  [body('minutes').optional().isInt({ min: 5, max: 1440 })],
  validate,
  ctrl.snooze
);
router.patch('/:id/assign',
  [body('friendId').isMongoId().withMessage('Invalid friend ID')],
  validate,
  ctrl.assign
);

router.patch('/:id/shared-status',
  [body('status').isIn(['sent','received','acknowledged','processing','skipped','completed'])],
  validate,
  ctrl.updateSharedStatus
);

router.patch('/:id/snooze-assigned',
  [body('minutes').isInt({ min: 1, max: 1440 }).withMessage('Minutes must be 1-1440')],
  validate,
  ctrl.snoozeAssigned
);

router.get('/shared/:friendId', ctrl.getSharedWithFriend);

module.exports = router;
