/**
 * Script untuk update password Kerani menjadi {divisi}2025
 */

const sql = require('mssql');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });

const config = {
    user: process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASSWORD || 'ptrj@123',
    server: process.env.MSSQL_HOST || 'localhost',
    port: parseInt(process.env.MSSQL_PORT) || 1433,
    database: process.env.MSSQL_DATABASE || 'extend_db_ptrj',
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
};

// Daftar divisi
const divisions = [
    'PG1A', 'PG1B', 'PG2A', 'PG2B', 'DME', 'ARA',
    'ARB1', 'ARB2', 'INFRA', 'AREC', 'IJL', 'STF-OFFICE', 'SECURITY'
];

async function updatePasswords() {
    let pool;
    const updatedAccounts = [];

    try {
        console.log('Connecting to database...');
        pool = await sql.connect(config);
        console.log('Connected!\n');

        for (const divisi of divisions) {
            const username = `kerani_${divisi.toLowerCase().replace('-', '_')}`;
            // Password baru: {divisi}2025
            const newPassword = `${divisi}2025`;

            // Hash password baru
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            const result = await pool.request()
                .input('email', sql.NVarChar, username)
                .input('password', sql.NVarChar, hashedPassword)
                .query(`
                    UPDATE user_ptrj 
                    SET password = @password, updatedAt = GETDATE()
                    WHERE email = @email
                `);

            if (result.rowsAffected[0] > 0) {
                console.log(`Updated password for ${username}`);
                updatedAccounts.push({ divisi, username, password: newPassword });
            } else {
                console.log(`User ${username} not found, skipping...`);
            }
        }

        console.log('\n========================================');
        console.log('DAFTAR AKUN KERANI DENGAN PASSWORD BARU:');
        console.log('========================================\n');

        console.log('| No | Divisi      | Username                 | Password       |');
        console.log('|----|-------------|--------------------------|----------------|');

        updatedAccounts.forEach((acc, idx) => {
            const no = String(idx + 1).padStart(2, ' ');
            const divisi = acc.divisi.padEnd(11, ' ');
            const username = acc.username.padEnd(24, ' ');
            const password = acc.password.padEnd(14, ' ');
            console.log(`| ${no} | ${divisi} | ${username} | ${password} |`);
        });

        console.log('\n========================================');
        console.log(`Total: ${updatedAccounts.length} password berhasil diupdate`);
        console.log('========================================\n');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

updatePasswords();
