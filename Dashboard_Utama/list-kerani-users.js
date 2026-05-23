/**
 * Script untuk melihat daftar user Kerani yang sudah dibuat
 * Updated with connectivity checks and 2025 credentials
 */

const sql = require('mssql');
require('dotenv').config({ path: './.env' });

const DB_NAME = process.env.MSSQL_DATABASE || 'extend_db_ptrj';

const configs = [
    {
        name: 'Environment Config',
        user: process.env.MSSQL_USER || 'sa',
        password: process.env.MSSQL_PASSWORD || 'ptrj@123',
        server: process.env.MSSQL_HOST || '10.0.0.110',
        port: parseInt(process.env.MSSQL_PORT) || 1433,
        database: DB_NAME,
        options: { encrypt: false, trustServerCertificate: true },
        timeout: 5000
    },
    {
        name: 'Localhost Default',
        user: 'sa',
        password: 'ptrj@123',
        server: 'localhost',
        port: 1433,
        database: DB_NAME,
        options: { encrypt: false, trustServerCertificate: true },
        timeout: 5000
    },
    {
        name: 'Localhost Alternate',
        user: 'sa',
        password: 'Password123',
        server: 'localhost',
        port: 1433,
        database: DB_NAME,
        options: { encrypt: false, trustServerCertificate: true },
        timeout: 5000
    }
];

async function connectWithStrategy() {
    for (const conf of configs) {
        try {
            const pool = await sql.connect(conf);
            return pool;
        } catch (err) {
            // Check if error is DB missing, if so, we can't list users
            if (err.message.includes('cannot open database') || err.message.includes('does not exist')) {
                // console.log(`Database ${conf.database} missing on ${conf.server}.`);
            }
        }
    }
    throw new Error('Could not connect to database on any configured server.');
}

async function listKeraniUsers() {
    let pool;

    try {
        pool = await connectWithStrategy();

        const result = await pool.request().query(`
            SELECT id, name, email, role, divisi 
            FROM user_ptrj 
            WHERE role IN ('KERANI', 'ADMIN')
            ORDER BY role, id
        `);

        console.log('\n========================================');
        console.log('DAFTAR AKUN USER (Termasuk Admin):');
        console.log('========================================\n');

        console.log('| No | Role     | Divisi      | Username (Email)         | Nama            |');
        console.log('|----|----------|-------------|--------------------------|-----------------|');

        result.recordset.forEach((user, idx) => {
            const no = String(idx + 1).padStart(2, ' ');
            const role = user.role.padEnd(8, ' ');
            const divisi = (user.divisi || 'ALL').padEnd(11, ' ');
            const email = user.email.padEnd(24, ' ');
            const name = (user.name || '').padEnd(15, ' ');
            console.log(`| ${no} | ${role} | ${divisi} | ${email} | ${name} |`);
        });

        console.log('\n========================================');
        console.log(`Total: ${result.recordset.length} akun`);
        console.log('========================================\n');

        console.log('\nKREDENSIAL LOGIN TERBARU (Format: {Divisi}2025):');
        console.log('=================================================');
        console.log('Catatan: Untuk INF, password adalah INFRA2025');
        console.log('         Untuk Admin, password adalah ADMIN2025');
        console.log('         Untuk Lainnya, format Divisi + 2025\n');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

listKeraniUsers();
