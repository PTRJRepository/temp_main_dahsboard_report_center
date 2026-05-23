const crypto = require('crypto');
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const AUTH_SECRET = 'ptrj-rebinmas-secret-key-2024';

// Users to update with their plaintext passwords
const usersToUpdate = [
    { email: 'kerani_nursery@rebinmas.com', password: 'NURSERY2025' },
    { email: 'admin', password: 'admin123' },
];

function encryptPassword(password) {
    const key = crypto.createHash('sha256').update(AUTH_SECRET).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function updatePasswords() {
    const config = {
        server: '10.0.0.110',
        database: 'extend_db_ptrj',
        user: 'sa',
        password: 'ptrj@123',
        options: {
            encrypt: false,
            trustServerCertificate: true,
        }
    };

    try {
        await sql.connect(config);
        console.log('Connected to database');

        for (const user of usersToUpdate) {
            const encryptedPwd = encryptPassword(user.password);
            const hashedPwd = await bcrypt.hash(user.password, 10);

            console.log(`\nUpdating ${user.email}...`);
            console.log(`  Password: ${user.password}`);
            console.log(`  Bcrypt Hash: ${hashedPwd.substring(0, 30)}...`);
            console.log(`  AES Encrypted: ${encryptedPwd.substring(0, 30)}...`);

            const result = await sql.query`
                UPDATE user_ptrj 
                SET password = ${hashedPwd},
                    plainPassword = ${encryptedPwd}
                WHERE email = ${user.email}
            `;
            console.log(`  Rows affected: ${result.rowsAffected[0]}`);
        }

        console.log('\nDone!');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

updatePasswords();
