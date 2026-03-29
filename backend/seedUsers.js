const bcrypt = require('bcrypt');
const pool = require('./config/db');

const seedUsers = async () => {
    try {
        const users = [
            { username: 'admin', password: 'password', role: 'Admin' },
            { username: 'cashier', password: 'password', role: 'Cashier' },
            { username: 'manager', password: 'password', role: 'Manager' }
        ];

        for (let user of users) {
             // Check if user already exists
             const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [user.username]);
             if (rows.length === 0) {
                 const hashedPassword = await bcrypt.hash(user.password, 10);
                 await pool.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 
                 [user.username, hashedPassword, user.role]);
                 console.log(`✅ Seeded user: ${user.username}`);
             } else {
                 console.log(`ℹ️ User ${user.username} already exists, skipping.`);
             }
        }
        console.log('✅ User seeding completed successfully!');
        process.exit();
    } catch (error) {
        console.error('❌ Error seeding users:', error);
        process.exit(1);
    }
}

seedUsers();
