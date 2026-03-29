const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Product Routes
router.get('/', productController.getAllProducts);
router.post('/', productController.addProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

// Inventory Routes
router.get('/inventory/logs', productController.getInventoryLogs);
router.post('/inventory/:id/adjust', productController.adjustStock);

module.exports = router;
