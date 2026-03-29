const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString,
    // Render often requires ssl to be set to true or an object for external connections
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect()
    .then(() => console.log('✅ Connected to PostgreSQL Database successfully!'))
    .catch(err => {
        console.error('❌ PostgreSQL Connection Failed:');
        console.error(err.message);
    });

module.exports = pool;
