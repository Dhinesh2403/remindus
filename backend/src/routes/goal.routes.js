// backend/src/routes/goal.routes.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/goal.controller');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.use(authenticate);

router.get('/', ctrl.getAll);

router.post('/',
  [body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 120 })],
  validate,
  ctrl.create
);

router.put('/:id', ctrl.update);

router.patch('/:id/milestone',
  [body('index').isInt({ min: 0 }).withMessage('Milestone index required')],
  validate,
  ctrl.toggleMilestone
);

router.delete('/:id', ctrl.remove);

module.exports = router;
