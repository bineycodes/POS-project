const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/reports
router.get('/', async (req, res) => {
    try {
        const revenueRes = await pool.query('SELECT COALESCE(SUM(total),0) as v FROM sales');
        const allRevenue = parseFloat(revenueRes.rows[0].v) || 0;

        const txnsRes = await pool.query('SELECT COUNT(*) as c FROM sales');
        const allTxns = parseInt(txnsRes.rows[0].c) || 0;

        const avgSale = allTxns > 0 ? allRevenue / allTxns : 0;

        const topProds = await pool.query(
            'SELECT product_name, SUM(qty) as units, SUM(line_total) as rev FROM sale_items GROUP BY product_name ORDER BY rev DESC LIMIT 5'
        );

        const payBreak = await pool.query(
            'SELECT payment_method, COUNT(*) as count, SUM(total) as total FROM sales GROUP BY payment_method'
        );

        const dailySales = await pool.query(
            'SELECT DATE(created_at) as day, SUM(total) as rev, COUNT(*) as txns FROM sales GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 7'
        );

        res.json({
            allRevenue,
            allTxns,
            avgSale,
            topProds: topProds.rows,
            payBreak: payBreak.rows,
            dailySales: dailySales.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching reports' });
    }
});

// Dashboard metrics shortcut
router.get('/dashboard', async (req, res) => {
    try {
        const todayRev = await pool.query('SELECT COALESCE(SUM(total),0) as v FROM sales WHERE DATE(created_at) = CURRENT_DATE');
        const todayTxns = await pool.query('SELECT COUNT(*) as c FROM sales WHERE DATE(created_at) = CURRENT_DATE');
        const prods = await pool.query('SELECT COUNT(*) as c FROM products');
        const lowStock = await pool.query('SELECT COUNT(*) as c FROM products WHERE qty <= 10');
        const custs = await pool.query('SELECT COUNT(*) as c FROM customers');
        const allRev = await pool.query('SELECT COALESCE(SUM(total),0) as v FROM sales');

        res.json({
            todayRevenue: parseFloat(todayRev.rows[0].v) || 0,
            todayTxns: parseInt(todayTxns.rows[0].c) || 0,
            totalProds: parseInt(prods.rows[0].c) || 0,
            lowStock: parseInt(lowStock.rows[0].c) || 0,
            totalCusts: parseInt(custs.rows[0].c) || 0,
            allRevenue: parseFloat(allRev.rows[0].v) || 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching dashboard metrics' });
    }
});

module.exports = router;
