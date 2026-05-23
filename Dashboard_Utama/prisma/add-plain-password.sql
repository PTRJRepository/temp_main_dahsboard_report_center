-- Add plainPassword column to user_ptrj table
-- This allows admin to view passwords in admin mode
-- Run this script on SQL Server
USE extend_db_ptrj;
GO -- Add plainPassword column if it doesn't exist
    IF NOT EXISTS (
        SELECT *
        FROM sys.columns
        WHERE object_id = OBJECT_ID(N'user_ptrj')
            AND name = 'plainPassword'
    ) BEGIN
ALTER TABLE user_ptrj
ADD plainPassword NVARCHAR(255) NULL;
PRINT 'Column plainPassword added to user_ptrj';
END
ELSE BEGIN PRINT 'Column plainPassword already exists';
END
GO