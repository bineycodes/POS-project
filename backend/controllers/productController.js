const pool = require('../config/db');

exports.getAllProducts = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching products' });
    }
};

exports.addProduct = async (req, res) => {
    const { name, category, price, qty, barcode, supplier } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO products (name, category, price, qty, barcode, supplier) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [name, category, price, qty, barcode || null, supplier || null]
        );
        
        const newProductId = result.rows[0].id;
        
        // Log initial inventory
        await pool.query(
            'INSERT INTO inventory_log (product_id, change_type, qty_change, note) VALUES ($1, $2, $3, $4)',
            [newProductId, 'initial', qty, 'Initial stock added']
        );

        res.status(201).json({ message: 'Product added successfully', id: newProductId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding product' });
    }
};

exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, category, price, qty, barcode, supplier } = req.body;
    try {
        await pool.query(
            'UPDATE products SET name=$1, category=$2, price=$3, qty=$4, barcode=$5, supplier=$6 WHERE id=$7',
            [name, category, price, qty, barcode || null, supplier || null, id]
        );
        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating product' });
    }
};

exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM products WHERE id=$1', [id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting product' });
    }
};

// Inventory Adjustment Route
exports.adjustStock = async (req, res) => {
    const { id } = req.params;
    const { change_type, qty_change, note } = req.body; 

    try {
        const changeVal = change_type === 'add' ? parseInt(qty_change) : -parseInt(qty_change);
        
        await pool.query('UPDATE products SET qty = qty + $1 WHERE id = $2', [changeVal, id]);
        
        await pool.query(
            'INSERT INTO inventory_log (product_id, change_type, qty_change, note) VALUES ($1, $2, $3, $4)',
            [id, change_type === 'add' ? 'restock' : 'adjustment', changeVal, note]
        );

        res.json({ message: 'Stock adjusted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adjusting stock' });
    }
};

exports.getInventoryLogs = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT il.*, p.name as pname 
            FROM inventory_log il 
            JOIN products p ON il.product_id = p.id 
            ORDER BY il.id DESC LIMIT 50
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching inventory logs' });
    }
};
