const pool = require('../config/db');

exports.createSale = async (req, res) => {
    const { cashier, customer_id, customer_name, subtotal, discount, tax, total, payment_method, cash_received, items } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Start transaction

        // Insert into sales table
        const saleResult = await client.query(
            `INSERT INTO sales (cashier, customer_id, customer_name, subtotal, discount, tax, total, payment_method, cash_received)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [cashier, customer_id || null, customer_name || 'Walk-in', subtotal, discount, tax, total, payment_method, cash_received || null]
        );

        const saleId = saleResult.rows[0].id;

        // Process each item
        for (let item of items) {
            // Insert sale item
            await client.query(
                `INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [saleId, item.pid, item.name, item.qty, item.price, item.price * item.qty]
            );

            // Deduct stock
            await client.query('UPDATE products SET qty = qty - $1 WHERE id = $2', [item.qty, item.pid]);

            // Log inventory change
            await client.query(
                `INSERT INTO inventory_log (product_id, change_type, qty_change, note) VALUES ($1, $2, $3, $4)`,
                [item.pid, 'sale', -item.qty, `Sale #${saleId}`]
            );
        }

        // Add Loyalty points if customer exists
        if (customer_id) {
            const points = Math.floor(total / 10);
            await client.query('UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2', [points, customer_id]);
        }

        await client.query('COMMIT'); // Save all changes
        res.status(201).json({ message: 'Sale completed successfully', saleId });

    } catch (error) {
        await client.query('ROLLBACK'); // Cancel transaction on any error
        console.error(error);
        res.status(500).json({ message: 'Error processing sale' });
    } finally {
        client.release();
    }
};

exports.getRecentSales = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sales ORDER BY id DESC LIMIT 50');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching sales' });
    }
};

exports.getSaleItems = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sale_items WHERE sale_id = $1', [req.params.id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching sale items' });
    }
};
