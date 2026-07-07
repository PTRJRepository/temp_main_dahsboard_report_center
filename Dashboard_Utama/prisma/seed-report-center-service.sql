USE extend_db_ptrj;
GO

-- Insert report-center service (skip if already exists)
IF NOT EXISTS (SELECT * FROM service_ptrj WHERE serviceId = 'report-center')
BEGIN
    INSERT INTO service_ptrj (serviceId, name, description, serviceUrl, path, enabled, imagePath)
    VALUES (
        'report-center',
        'Report Center',
        'Dashboard laporan inventaris, analisis stok, dan pergerakan barang',
        'http://localhost:3001/report-center',
        '/report-center',
        1,
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop'
    );
    PRINT 'Service report-center inserted';
END
ELSE
BEGIN
    UPDATE service_ptrj
    SET serviceUrl = 'http://localhost:3001/report-center',
        path = '/report-center',
        updatedAt = GETDATE()
    WHERE serviceId = 'report-center';
    PRINT 'Service report-center already exists, skipping';
END
GO

-- Assign report-center to ADMIN role only
IF NOT EXISTS (
    SELECT * FROM role_service_permission
    WHERE role = 'ADMIN' AND serviceId = 'report-center'
)
BEGIN
    INSERT INTO role_service_permission (role, serviceId)
    VALUES ('ADMIN', 'report-center');
    PRINT 'ADMIN permission for report-center inserted';
END
ELSE
BEGIN
    PRINT 'ADMIN permission already exists, skipping';
END
GO
