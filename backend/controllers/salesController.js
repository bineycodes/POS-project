const pool = require('../config/db');

exports.createSale = async (req, res) => {
    const { cashier, customer_id, customer_name, subtotal, discount, tax, total, payment_method, cash_received, items } = req.body;

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction(); // Start transaction

        // Insert into sales table
        const [saleResult] = await connection.execute(
            `INSERT INTO sales (cashier, customer_id, customer_name, subtotal, discount, tax, total, payment_method, cash_received)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [cashier, customer_id || null, customer_name || 'Walk-in', subtotal, discount, tax, total, payment_method, cash_received || null]
        );

        const saleId = saleResult.insertId;

        // Process each item
        for (let item of items) {
            // Insert sale item
            await connection.execute(
                `INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [saleId, item.pid, item.name, item.qty, item.price, item.price * item.qty]
            );

            // Deduct stock
            await connection.execute('UPDATE products SET qty = qty - ? WHERE id = ?', [item.qty, item.pid]);

            // Log inventory change
            await connection.execute(
                `INSERT INTO inventory_log (product_id, change_type, qty_change, note) VALUES (?, ?, ?, ?)`,
                [item.pid, 'sale', -item.qty, `Sale #${saleId}`]
            );
        }

        // Add Loyalty points if customer exists
        if (customer_id) {
            const points = Math.floor(total / 10);
            await connection.execute('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?', [points, customer_id]);
        }

        await connection.commit(); // Save all changes
        res.status(201).json({ message: 'Sale completed successfully', saleId });

    } catch (error) {
        await connection.rollback(); // Cancel transaction on any error
        console.error(error);
        res.status(500).json({ message: 'Error processing sale' });
    } finally {
        connection.release();
    }
};

exports.getRecentSales = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM sales ORDER BY id DESC LIMIT 50');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching sales' });
    }
};

exports.getSaleItems = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching sale items' });
    }
};
