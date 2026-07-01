// backend/src/routes/task.routes.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/task.controller');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);

router.post('/',
  [body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 })],
  validate,
  ctrl.create
);

router.put('/:id', ctrl.update);
router.patch('/:id/toggle', ctrl.toggle);
router.patch('/:id/subtask',
  [body('subtaskId').notEmpty().withMessage('subtaskId required')],
  validate,
  ctrl.toggleSubtask
);
router.delete('/:id', ctrl.remove);

module.exports = router;
