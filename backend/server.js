const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors()); // Allow cross-origin requests from the frontend
app.use(express.json()); // Allow parsing JSON incoming requests

// Initialize DB (just checking the connection pooling)
const pool = require('./config/db');
pool.getConnection()
    .then(conn => {
        console.log('✅ Connected to MySQL Database successfully!');
        conn.release();
    })
    .catch(err => {
        console.error('❌ MySQL Connection Failed:');
        console.error(err.message);
        console.log('Hint: Make sure XAMPP Apache and MySQL are running, and the pos_system database is created!');
    });

// Basic Health Check Route
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running', version: '1.0.0' });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/sales', require('./routes/salesRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
