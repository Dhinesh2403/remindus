// backend/src/routes/activity.routes.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/activity.controller');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.use(authenticate);

router.get('/', ctrl.getAll);

router.post('/',
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
    body('dayKey').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('dayKey must be YYYY-MM-DD'),
  ],
  validate,
  ctrl.create
);

router.put('/:id', ctrl.update);
router.patch('/:id/toggle', ctrl.toggleDone);
router.delete('/:id', ctrl.remove);

module.exports = router;
