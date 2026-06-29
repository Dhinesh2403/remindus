// backend/src/routes/note.routes.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/note.controller');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.use(authenticate);

router.get('/', ctrl.getAll);

router.post('/',
  [body('text').trim().notEmpty().withMessage('Text is required').isLength({ max: 2000 })],
  validate,
  ctrl.create
);

router.put('/:id', ctrl.update);
router.patch('/:id/pin', ctrl.togglePin);
router.delete('/:id', ctrl.remove);

module.exports = router;
