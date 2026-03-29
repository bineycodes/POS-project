const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/customers
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT c.*, COUNT(s.id) as purchase_count, COALESCE(SUM(s.total), 0) as total_spent
            FROM customers c 
            LEFT JOIN sales s ON s.customer_id = c.id
            GROUP BY c.id ORDER BY c.name
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching customers' });
    }
});

// POST /api/customers
router.post('/', async (req, res) => {
    const { name, phone, email, address } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)',
            [name, phone || null, email || null, address || null]
        );
        res.status(201).json({ message: 'Customer registered successfully', id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding customer' });
    }
});

module.exports = router;
