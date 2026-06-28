// backend/src/routes/habit.routes.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/habit.controller');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.use(authenticate);

router.get('/', ctrl.getAll);

router.post('/',
  [body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 })],
  validate,
  ctrl.create
);

router.put('/:id', ctrl.update);
router.patch('/:id/toggle', ctrl.toggleToday);
router.delete('/:id', ctrl.remove);

module.exports = router;
