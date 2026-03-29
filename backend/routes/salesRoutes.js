const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.post('/', salesController.createSale);
router.get('/', salesController.getRecentSales);
router.get('/:id/items', salesController.getSaleItems);

module.exports = router;
