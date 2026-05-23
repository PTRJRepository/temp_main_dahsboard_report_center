// Script to add targetUrl column and update services with target URLs from routes-config.json
// Run with: node prisma/update-target-url.js

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
    server: process.env.MSSQL_HOST || '10.0.0.110',
    port: parseInt(process.env.MSSQL_PORT || '1433'),
    user: process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASSWORD || 'ptrj@123',
    database: process.env.MSSQL_DATABASE || 'extend_db_ptrj',
    options: {
        encrypt: false,
        trustServerCertificate: true,
    }
};

// Load routes from routes-config.json
const routesConfigPath = path.join(__dirname, '..', '..', 'routes-config.json');

async function updateTargetUrls() {
    let pool = null;

    try {
        // Load routes config
        console.log('Loading routes from:', routesConfigPath);
        const routesData = fs.readFileSync(routesConfigPath, 'utf8');
        const routes = JSON.parse(routesData);
        console.log(`Found ${routes.length} routes in config`);

        console.log('\nConnecting to SQL Server...');
        console.log('Server:', config.server + ':' + config.port);
        console.log('Database:', config.database);

        pool = await sql.connect(config);
        console.log('Connected!');

        // Check if targetUrl column exists
        const columnCheck = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'service_ptrj' AND COLUMN_NAME = 'targetUrl'
        `);

        if (columnCheck.recordset.length === 0) {
            console.log('\nAdding targetUrl column to service_ptrj table...');
            await pool.request().query(`
                ALTER TABLE service_ptrj 
                ADD targetUrl NVARCHAR(500) NULL
            `);
            console.log('✅ Column targetUrl added');
        } else {
            console.log('\n✅ Column targetUrl already exists');
        }

        // Update services with targetUrl from routes-config.json
        console.log('\nUpdating services with targetUrl...');

        for (const route of routes) {
            // Try to match by path or id
            const result = await pool.request()
                .input('path', route.path)
                .input('id', route.id)
                .input('targetUrl', route.target)
                .query(`
                    UPDATE service_ptrj 
                    SET targetUrl = @targetUrl
                    WHERE path = @path OR serviceId = @id
                `);

            if (result.rowsAffected[0] > 0) {
                console.log(`✅ Updated: ${route.id} -> ${route.target}`);
            } else {
                console.log(`⚠️  No match found for: ${route.id} (path: ${route.path})`);

                // Try to create the service if it doesn't exist
                const existingCheck = await pool.request()
                    .input('id', route.id)
                    .query('SELECT serviceId FROM service_ptrj WHERE serviceId = @id');

                if (existingCheck.recordset.length === 0) {
                    console.log(`   Creating new service: ${route.id}`);
                    await pool.request()
                        .input('serviceId', route.id)
                        .input('name', route.description || route.id)
                        .input('description', route.description || '')
                        .input('serviceUrl', route.target)
                        .input('path', route.path)
                        .input('targetUrl', route.target)
                        .input('enabled', route.enabled ? 1 : 0)
                        .query(`
                            INSERT INTO service_ptrj (serviceId, name, description, serviceUrl, path, targetUrl, enabled)
                            VALUES (@serviceId, @name, @description, @serviceUrl, @path, @targetUrl, @enabled)
                        `);
                    console.log(`   ✅ Created: ${route.id}`);

                    // Also add permissions for all roles
                    const roles = ['ADMIN', 'KERANI', 'ACCOUNTING'];
                    for (const role of roles) {
                        try {
                            await pool.request()
                                .input('role', role)
                                .input('serviceId', route.id)
                                .query(`
                                    INSERT INTO role_service_permission (role, serviceId)
                                    VALUES (@role, @serviceId)
                                `);
                            console.log(`   ✅ Added permission: ${role} -> ${route.id}`);
                        } catch (e) {
                            // Permission might already exist
                        }
                    }
                }
            }
        }

        // Show current services
        console.log('\n--- Current Services ---');
        const services = await pool.request().query('SELECT serviceId, name, path, targetUrl, enabled FROM service_ptrj');
        console.table(services.recordset);

        console.log('\n✅ Update completed!');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (pool) {
            await pool.close();
        }
        process.exit(0);
    }
}

updateTargetUrls();
