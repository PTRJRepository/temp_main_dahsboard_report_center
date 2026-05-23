const sql = require('mssql');
const bcrypt = require('bcryptjs');

const config = {
    server: '10.0.0.110',
    port: 1433,
    user: 'sa',
    password: 'ptrj@123',
    database: 'extend_db_ptrj',
    options: {
        encrypt: false,
        trustServerCertificate: true,
    }
};

async function resetAdminPassword() {
    try {
        await sql.connect(config);
        console.log('✅ Connected to database');

        // Hash new password
        const newPassword = 'admin123'; // Password baru yang mudah diingat
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password admin
        const request = new sql.Request();
        request.input('password', sql.VarChar, hashedPassword);
        request.input('email', sql.VarChar, 'admin');

        await request.query(`
            UPDATE user_ptrj
            SET password = @password, updatedAt = GETDATE()
            WHERE email = @email
        `);

        console.log('✅ Password admin berhasil direset!');
        console.log('Email: admin');
        console.log('Password baru:', newPassword);
        console.log('\nSilakan login dengan kredensial baru ini.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await sql.close();
    }
}

resetAdminPassword();