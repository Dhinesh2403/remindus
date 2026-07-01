// backend/src/routes/specialDay.routes.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/specialDay.controller');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.use(authenticate);

router.get('/', ctrl.getAll);

router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }),
    body('type').isIn(['birthday', 'anniversary', 'event']).withMessage('Invalid type'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be 1-12'),
    body('day').isInt({ min: 1, max: 31 }).withMessage('Day must be 1-31'),
  ],
  validate,
  ctrl.create
);

router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
