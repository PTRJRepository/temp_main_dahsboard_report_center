/**
 * Script to setup database, create tables, and seed data.
 * Updated: Admin Password reset to 'admin123'
 * Updated: Service table now has 'imagePath' and is seeded with banners.
 */

const sql = require('mssql');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });

const DB_NAME = process.env.MSSQL_DATABASE || 'extend_db_ptrj';

const configs = [
    {
        name: 'Environment Config',
        user: process.env.MSSQL_USER || 'sa',
        password: process.env.MSSQL_PASSWORD || 'ptrj@123',
        server: process.env.MSSQL_HOST || '10.0.0.110',
        port: parseInt(process.env.MSSQL_PORT) || 1433,
        database: 'master',
        options: { encrypt: false, trustServerCertificate: true },
        timeout: 5000
    },
    {
        name: 'Localhost Default',
        user: 'sa',
        password: 'ptrj@123',
        server: 'localhost',
        port: 1433,
        database: 'master',
        options: { encrypt: false, trustServerCertificate: true },
        timeout: 5000
    },
    {
        name: 'Localhost Alternate',
        user: 'sa',
        password: 'Password123',
        server: 'localhost',
        port: 1433,
        database: 'master',
        options: { encrypt: false, trustServerCertificate: true },
        timeout: 5000
    }
];

// Users to seed
const usersToSeed = [
    { divisi: 'PG1A', username: 'kerani_pg1a', password: 'PG1A2025', role: 'KERANI', name: 'Kerani PG1A' },
    { divisi: 'PG1B', username: 'kerani_pg1b', password: 'PG1B2025', role: 'KERANI', name: 'Kerani PG1B' },
    { divisi: 'PG2A', username: 'kerani_pg2a', password: 'PG2A2025', role: 'KERANI', name: 'Kerani PG2A' },
    { divisi: 'PG2B', username: 'kerani_pg2b', password: 'PG2B2025', role: 'KERANI', name: 'Kerani PG2B' },
    { divisi: 'DME', username: 'kerani_dme', password: 'DME2025', role: 'KERANI', name: 'Kerani DME' },
    { divisi: 'ARA', username: 'kerani_ara', password: 'ARA2025', role: 'KERANI', name: 'Kerani ARA' },
    { divisi: 'ARB1', username: 'kerani_arb1', password: 'ARB12025', role: 'KERANI', name: 'Kerani ARB1' },
    { divisi: 'ARB2', username: 'kerani_arb2', password: 'ARB22025', role: 'KERANI', name: 'Kerani ARB2' },
    { divisi: 'INF', username: 'kerani_infra', password: 'INFRA2025', role: 'KERANI', name: 'Kerani INFRA' },
    { divisi: 'AREC', username: 'kerani_arec', password: 'AREC2025', role: 'KERANI', name: 'Kerani AREC' },
    { divisi: 'IJL', username: 'kerani_ijl', password: 'IJL2025', role: 'KERANI', name: 'Kerani IJL' },
    { divisi: 'STF-OFFICE', username: 'kerani_stf_office', password: 'STF-OFFICE2025', role: 'KERANI', name: 'Kerani STF OFFICE' },
    { divisi: 'SECURITY', username: 'kerani_security', password: 'SECURITY2025', role: 'KERANI', name: 'Kerani SECURITY' },
    { divisi: 'WKS_PG', username: 'kerani_wks_pg', password: 'WKS_PG2025', role: 'KERANI', name: 'Kerani Workshop PGE' },
    { divisi: 'WKS_AR', username: 'kerani_wks_ar', password: 'WKS_AR2025', role: 'KERANI', name: 'Kerani Workshop Air Ruak' },
    { divisi: 'NRS', username: 'kerani_nrs', password: 'NRS2025', role: 'KERANI', name: 'Kerani Nursery' },
    // ADMIN PASSWORD CHANGED TO admin123
    { divisi: null, username: 'admin', password: 'admin123', role: 'ADMIN', name: 'Administrator' }
];

// Services to seed (based on routes-config.json)
// Added imagePath
const servicesToSeed = [
    {
        serviceId: 'upah',
        name: 'Sistem Penggajian',
        description: 'Sistem Penggajian/Payroll',
        serviceUrl: 'http://10.0.0.110:5175',
        path: '/upah',
        enabled: true,
        imagePath: '/assets/payroll_banner.webp'
    },
    {
        serviceId: 'absen',
        name: 'Sistem Absensi',
        description: 'Sistem Absensi Karyawan',
        serviceUrl: 'http://10.0.0.110:5176',
        path: '/absen',
        enabled: true,
        imagePath: '/assets/absen_monitoring.webp'
    },
    {
        serviceId: 'monitoring-beras',
        name: 'Monitoring Beras',
        description: 'Monitoring Distribusi Beras',
        serviceUrl: 'http://10.0.0.110:5177',
        path: '/monitoring-beras',
        enabled: true,
        imagePath: '/assets/monitoring_beras_banner.webp'
    },
    {
        serviceId: 'query',
        name: 'SQL Gateway',
        description: 'SQL Gateway API',
        serviceUrl: 'http://localhost:8001',
        path: '/query',
        enabled: true,
        imagePath: null
    }
];

async function connectWithStrategy() {
    for (const conf of configs) {
        console.log(`Trying connection strategy: ${conf.name} (${conf.server})...`);
        try {
            const pool = await sql.connect(conf);
            console.log(`Connected successfully using ${conf.name}!`);
            return { pool, config: conf };
        } catch (err) {
            console.log(`Failed ${conf.name}: ${err.message}`);
        }
    }
    throw new Error('All connection strategies failed.');
}

async function setupAndSeed() {
    let pool;
    let activeConfig;

    try {
        const connection = await connectWithStrategy();
        pool = connection.pool;
        activeConfig = connection.config;

        // 1. Check DB
        const checkDb = await pool.request().query(`SELECT name FROM sys.databases WHERE name = '${DB_NAME}'`);
        if (checkDb.recordset.length === 0) {
            await pool.request().query(`CREATE DATABASE [${DB_NAME}]`);
            console.log(`Database ${DB_NAME} created.`);
        }

        await pool.close();
        const dbConfig = { ...activeConfig, database: DB_NAME };
        pool = await sql.connect(dbConfig);
        console.log(`Connected to database [${DB_NAME}].`);

        // 2. Create tables
        // Service Table - Check for imagePath column
        let serviceTableExists = false;
        try {
            const check = await pool.request().query("SELECT TOP 1 * FROM service_ptrj");
            serviceTableExists = true;
            // Check if column exists
            try {
                await pool.request().query("SELECT imagePath FROM service_ptrj");
            } catch (e) {
                console.log("Column 'imagePath' missing. Adding it...");
                await pool.request().query("ALTER TABLE service_ptrj ADD imagePath NVARCHAR(255)");
                console.log("Column 'imagePath' added.");
            }
        } catch (e) {
            // Table doesn't exist
        }

        if (!serviceTableExists) {
            await pool.request().query(`
                CREATE TABLE service_ptrj (
                    serviceId NVARCHAR(50) PRIMARY KEY,
                    name NVARCHAR(100) NOT NULL,
                    description NVARCHAR(255),
                    serviceUrl NVARCHAR(255) NOT NULL,
                    path NVARCHAR(100),
                    enabled BIT DEFAULT 1,
                    imagePath NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                );
            `);
            console.log('Table service_ptrj created.');
        }

        // Other tables (assume they exist or create if not)
        // USER TABLE
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_ptrj' AND xtype='U')
            BEGIN
                CREATE TABLE user_ptrj (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    email NVARCHAR(100) UNIQUE NOT NULL, 
                    name NVARCHAR(100),
                    password NVARCHAR(255) NOT NULL,
                    role NVARCHAR(50) NOT NULL DEFAULT 'KERANI',
                    divisi NVARCHAR(50),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                );
            END
        `);

        // ROLE PERMISSION TABLE
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_service_permission' AND xtype='U')
            BEGIN
                CREATE TABLE role_service_permission (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    role NVARCHAR(50) NOT NULL,
                    serviceId NVARCHAR(50) NOT NULL,
                    FOREIGN KEY (serviceId) REFERENCES service_ptrj(serviceId) ON DELETE CASCADE
                );
            END
        `);

        // 3. Seed Users
        console.log('\nSeeding/Updating users...');
        for (const user of usersToSeed) {
            const hashedPassword = await bcrypt.hash(user.password, 10);

            const checkUser = await pool.request()
                .input('email', sql.NVarChar, user.username)
                .query('SELECT id FROM user_ptrj WHERE email = @email');

            if (checkUser.recordset.length > 0) {
                await pool.request()
                    .input('email', sql.NVarChar, user.username)
                    .input('password', sql.NVarChar, hashedPassword)
                    .input('role', sql.NVarChar, user.role)
                    .input('divisi', sql.NVarChar, user.divisi)
                    .input('name', sql.NVarChar, user.name)
                    .query(`
                        UPDATE user_ptrj 
                        SET password = @password, role = @role, divisi = @divisi, name = @name, updatedAt = GETDATE()
                        WHERE email = @email
                    `);
            } else {
                await pool.request()
                    .input('email', sql.NVarChar, user.username)
                    .input('password', sql.NVarChar, hashedPassword)
                    .input('role', sql.NVarChar, user.role)
                    .input('divisi', sql.NVarChar, user.divisi)
                    .input('name', sql.NVarChar, user.name)
                    .query(`
                        INSERT INTO user_ptrj (email, password, role, divisi, name)
                        VALUES (@email, @password, @role, @divisi, @name)
                    `);
            }
        }
        console.log('Users seeded (Admin password set to admin123).');

        // 4. Seed Services
        console.log('\nSeeding/Updating services...');
        for (const svc of servicesToSeed) {
            // Upsert Service
            const checkSvc = await pool.request()
                .input('sid', sql.NVarChar, svc.serviceId)
                .query('SELECT serviceId FROM service_ptrj WHERE serviceId = @sid');

            if (checkSvc.recordset.length > 0) {
                await pool.request()
                    .input('sid', sql.NVarChar, svc.serviceId)
                    .input('name', sql.NVarChar, svc.name)
                    .input('desc', sql.NVarChar, svc.description)
                    .input('url', sql.NVarChar, svc.serviceUrl)
                    .input('path', sql.NVarChar, svc.path)
                    .input('enabled', sql.Bit, svc.enabled)
                    .input('img', sql.NVarChar, svc.imagePath)
                    .query(`
                        UPDATE service_ptrj 
                        SET name=@name, description=@desc, serviceUrl=@url, path=@path, enabled=@enabled, imagePath=@img, updatedAt=GETDATE()
                        WHERE serviceId=@sid
                    `);
            } else {
                await pool.request()
                    .input('sid', sql.NVarChar, svc.serviceId)
                    .input('name', sql.NVarChar, svc.name)
                    .input('desc', sql.NVarChar, svc.description)
                    .input('url', sql.NVarChar, svc.serviceUrl)
                    .input('path', sql.NVarChar, svc.path)
                    .input('enabled', sql.Bit, svc.enabled)
                    .input('img', sql.NVarChar, svc.imagePath)
                    .query(`
                        INSERT INTO service_ptrj (serviceId, name, description, serviceUrl, path, enabled, imagePath)
                        VALUES (@sid, @name, @desc, @url, @path, @enabled, @img)
                    `);
            }
        }
        console.log('Services seeded with image paths.');

        // 5. Default Permissions
        // Ensure Admin has everything
        console.log('Ensuring Admin permissions...');
        const allServices = servicesToSeed.map(s => s.serviceId);
        for (const sid of allServices) {
            const check = await pool.request()
                .input('role', sql.NVarChar, 'ADMIN')
                .input('sid', sql.NVarChar, sid)
                .query('SELECT id FROM role_service_permission WHERE role = @role AND serviceId = @sid');

            if (check.recordset.length === 0) {
                await pool.request()
                    .input('role', sql.NVarChar, 'ADMIN')
                    .input('sid', sql.NVarChar, sid)
                    .query('INSERT INTO role_service_permission (role, serviceId) VALUES (@role, @sid)');
            }
        }

        // Ensure KERANI has everything except maybe query if restricted, but for now giving all as per start
        // User can restrict later via UI.
        for (const sid of allServices) {
            if (sid === 'query') continue; // Maybe keep query for admin only initially? Or give all. Let's give all based on previous logic but user requested ability to change.
            // Actually, user said "munculkan services sesai dengan tingkatan role", usually query/admin tools are hidden.
            // But for now, seeding initial state.
            const check = await pool.request()
                .input('role', sql.NVarChar, 'KERANI')
                .input('sid', sql.NVarChar, sid)
                .query('SELECT id FROM role_service_permission WHERE role = @role AND serviceId = @sid');
            if (check.recordset.length === 0) {
                await pool.request()
                    .input('role', sql.NVarChar, 'KERANI')
                    .input('sid', sql.NVarChar, sid)
                    .query('INSERT INTO role_service_permission (role, serviceId) VALUES (@role, @sid)');
            }
        }

        // Ensure VISITOR has everything except query
        for (const sid of allServices) {
            if (sid === 'query') continue;
            const check = await pool.request()
                .input('role', sql.NVarChar, 'VISITOR')
                .input('sid', sql.NVarChar, sid)
                .query('SELECT id FROM role_service_permission WHERE role = @role AND serviceId = @sid');
            if (check.recordset.length === 0) {
                await pool.request()
                    .input('role', sql.NVarChar, 'VISITOR')
                    .input('sid', sql.NVarChar, sid)
                    .query('INSERT INTO role_service_permission (role, serviceId) VALUES (@role, @sid)');
            }
        }

        console.log('\nAll seeds completed successfully.');

    } catch (err) {
        console.error('CRITICAL ERROR:', err.message);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

setupAndSeed();
