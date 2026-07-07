-- Create database extend_db_ptrj if not exists
-- Run this script manually on SQL Server if database doesn't exist
-- USE master;
-- GO
-- IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'extend_db_ptrj')
-- BEGIN
--     CREATE DATABASE extend_db_ptrj;
-- END
-- GO
USE extend_db_ptrj;
GO -- Create user_ptrj table
    IF NOT EXISTS (
        SELECT *
        FROM sysobjects
        WHERE name = 'user_ptrj'
            AND xtype = 'U'
    ) BEGIN CREATE TABLE user_ptrj (
        id INT IDENTITY(1, 1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        role NVARCHAR(50) NOT NULL DEFAULT 'KERANI',
        createdAt DATETIME DEFAULT GETDATE(),
        updatedAt DATETIME DEFAULT GETDATE()
    );
PRINT 'Table user_ptrj created';
END
GO -- Create service_ptrj table
    IF NOT EXISTS (
        SELECT *
        FROM sysobjects
        WHERE name = 'service_ptrj'
            AND xtype = 'U'
    ) BEGIN CREATE TABLE service_ptrj (
        serviceId NVARCHAR(255) NOT NULL PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        serviceUrl NVARCHAR(500) NOT NULL,
        path NVARCHAR(255),
        enabled BIT DEFAULT 1,
        imagePath NVARCHAR(500),
        createdAt DATETIME DEFAULT GETDATE(),
        updatedAt DATETIME DEFAULT GETDATE()
    );
PRINT 'Table service_ptrj created';
END
GO -- Create role_service_permission table (uses serviceId string, not INT)
    IF NOT EXISTS (
        SELECT *
        FROM sysobjects
        WHERE name = 'role_service_permission'
            AND xtype = 'U'
    ) BEGIN CREATE TABLE role_service_permission (
        id INT IDENTITY(1, 1) PRIMARY KEY,
        role NVARCHAR(50) NOT NULL,
        serviceId NVARCHAR(255) NOT NULL,
        FOREIGN KEY (serviceId) REFERENCES service_ptrj(serviceId) ON DELETE CASCADE,
        CONSTRAINT UQ_role_service UNIQUE (role, serviceId)
    );
PRINT 'Table role_service_permission created';
END
GO -- Seed Services (from routes-config.json)
    IF NOT EXISTS (
        SELECT *
        FROM service_ptrj
        WHERE serviceId = 'payroll-frontend'
    ) BEGIN
INSERT INTO service_ptrj (
        serviceId,
        name,
        description,
        serviceUrl,
        path,
        enabled,
        imagePath
    )
VALUES (
        'payroll-frontend',
        'Dashboard Utama',
        'Payroll Frontend (Vite/React)',
        'http://localhost:3001/',
        '/',
        1,
        NULL
    ),
    (
        'upah',
        'Upah/Payroll',
        'Sistem Penggajian',
        'http://localhost:3001/upah',
        '/upah',
        1,
        '/assets/payroll_banner.webp'
    ),
    (
        'absen',
        'Absensi',
        'Sistem Absensi Karyawan',
        'http://localhost:3001/absen',
        '/absen',
        1,
        '/assets/absen_monitoring.webp'
    ),
    (
        'monitoring-beras',
        'Monitoring Beras',
        'Monitoring Distribusi Beras',
        'http://localhost:3001/monitoring-beras',
        '/monitoring-beras',
        1,
        '/assets/monitoring_beras_banner.webp'
    ),
    (
        'server-monitor',
        'Server Monitor',
        'Monitoring kesehatan server fisik dan virtual',
        'http://localhost:3001/server-monitor/servers',
        '/server-monitor/servers',
        1,
        'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSN1vftvyItd3fdfM2j7rZAI9cUJMT6Xwkvt56n2NMw_g&s=10'
    ),
    (
        'network-monitor',
        'Network Monitor',
        'Monitoring perangkat jaringan, switch, router, firewall, dan access point',
        'http://localhost:3001/network-monitor/',
        '/network-monitor/',
        1,
        'https://myfirstblog123.hashnode.dev/_next/image?url=https%3A%2F%2Fcdn.hashnode.com%2Fres%2Fhashnode%2Fimage%2Fupload%2Fv1727268180677%2Ff42f8ec4-32c9-4494-af41-c93c68aacf22.jpeg&w=3840&q=75'
    ),
    (
        'report-center',
        'Report Center',
        'Dashboard laporan inventaris, analisis stok, dan pergerakan barang',
        'http://localhost:3001/report-center',
        '/report-center',
        1,
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop'
    );
PRINT 'Services seeded';
END
GO -- Seed Role Permissions (all roles get all services for now)
DECLARE @permCount INT;
SELECT @permCount = COUNT(*)
FROM role_service_permission;
IF @permCount = 0 BEGIN -- ADMIN gets all services
INSERT INTO role_service_permission (role, serviceId)
VALUES ('ADMIN', 'payroll-frontend'),
    ('ADMIN', 'upah'),
    ('ADMIN', 'absen'),
    ('ADMIN', 'monitoring-beras'),
    ('ADMIN', 'server-monitor'),
    ('ADMIN', 'network-monitor'),
    ('ADMIN', 'report-center');
-- KERANI gets all services
INSERT INTO role_service_permission (role, serviceId)
VALUES ('KERANI', 'payroll-frontend'),
    ('KERANI', 'upah'),
    ('KERANI', 'absen'),
    ('KERANI', 'monitoring-beras'),
    ('KERANI', 'server-monitor'),
    ('KERANI', 'network-monitor');
-- ACCOUNTING gets all services
INSERT INTO role_service_permission (role, serviceId)
VALUES ('ACCOUNTING', 'payroll-frontend'),
    ('ACCOUNTING', 'upah'),
    ('ACCOUNTING', 'absen'),
    ('ACCOUNTING', 'monitoring-beras'),
    ('ACCOUNTING', 'server-monitor'),
    ('ACCOUNTING', 'network-monitor');
-- VISITOR gets all services
INSERT INTO role_service_permission (role, serviceId)
VALUES ('VISITOR', 'payroll-frontend'),
    ('VISITOR', 'upah'),
    ('VISITOR', 'absen'),
    ('VISITOR', 'monitoring-beras'),
    ('VISITOR', 'server-monitor'),
    ('VISITOR', 'network-monitor');
PRINT 'Role permissions seeded';
END
GO -- Note: User passwords will be seeded via application (bcrypt hash)
    -- The app will check if users exist and create them on first run
    PRINT 'Database initialization complete';
GO
