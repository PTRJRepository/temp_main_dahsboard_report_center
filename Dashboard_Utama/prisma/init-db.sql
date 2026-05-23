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
        enabled
    )
VALUES (
        'payroll-frontend',
        'Dashboard Utama',
        'Payroll Frontend (Vite/React)',
        'http://localhost:5175',
        '/',
        1
    ),
    (
        'upah',
        'Upah/Payroll',
        'Sistem Penggajian',
        'http://localhost:5175',
        '/upah',
        1
    ),
    (
        'absen',
        'Absensi',
        'Sistem Absensi Karyawan',
        'http://localhost:5176',
        '/absen',
        1
    ),
    (
        'monitoring-beras',
        'Monitoring Beras',
        'Monitoring Distribusi Beras',
        'http://localhost:5177',
        '/monitoring-beras',
        1
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
    ('ADMIN', 'monitoring-beras');
-- KERANI gets all services
INSERT INTO role_service_permission (role, serviceId)
VALUES ('KERANI', 'payroll-frontend'),
    ('KERANI', 'upah'),
    ('KERANI', 'absen'),
    ('KERANI', 'monitoring-beras');
-- ACCOUNTING gets all services
INSERT INTO role_service_permission (role, serviceId)
VALUES ('ACCOUNTING', 'payroll-frontend'),
    ('ACCOUNTING', 'upah'),
    ('ACCOUNTING', 'absen'),
    ('ACCOUNTING', 'monitoring-beras');
-- VISITOR gets all services
INSERT INTO role_service_permission (role, serviceId)
VALUES ('VISITOR', 'payroll-frontend'),
    ('VISITOR', 'upah'),
    ('VISITOR', 'absen'),
    ('VISITOR', 'monitoring-beras');
PRINT 'Role permissions seeded';
END
GO -- Note: User passwords will be seeded via application (bcrypt hash)
    -- The app will check if users exist and create them on first run
    PRINT 'Database initialization complete';
GO