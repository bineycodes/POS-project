const pool = require('../config/db');

exports.getAllProducts = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM products ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching products' });
    }
};

exports.addProduct = async (req, res) => {
    const { name, category, price, qty, barcode, supplier } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO products (name, category, price, qty, barcode, supplier) VALUES (?, ?, ?, ?, ?, ?)',
            [name, category, price, qty, barcode || null, supplier || null]
        );
        
        const newProductId = result.insertId;
        
        // Log initial inventory
        await pool.execute(
            'INSERT INTO inventory_log (product_id, change_type, qty_change, note) VALUES (?, ?, ?, ?)',
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
        await pool.execute(
            'UPDATE products SET name=?, category=?, price=?, qty=?, barcode=?, supplier=? WHERE id=?',
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
        await pool.execute('DELETE FROM products WHERE id=?', [id]);
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
        // change_type usually 'add' or 'remove'
        const changeVal = change_type === 'add' ? parseInt(qty_change) : -parseInt(qty_change);
        
        await pool.execute('UPDATE products SET qty = qty + ? WHERE id = ?', [changeVal, id]);
        
        await pool.execute(
            'INSERT INTO inventory_log (product_id, change_type, qty_change, note) VALUES (?, ?, ?, ?)',
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
        const [rows] = await pool.execute(`
            SELECT il.*, p.name as pname 
            FROM inventory_log il 
            JOIN products p ON il.product_id = p.id 
            ORDER BY il.id DESC LIMIT 50
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching inventory logs' });
    }
};
