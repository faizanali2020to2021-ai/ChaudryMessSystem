-- ==============================================================================
-- Chaudry Mess System - SQL Server Login & Permission Setup Script
-- ==============================================================================

USE [master];
GO

-- 1. Create SQL Server Login if not exists
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = 'expense_user')
BEGIN
    CREATE LOGIN [expense_user] WITH PASSWORD = N'ExpensePass@123', DEFAULT_DATABASE = [master], CHECK_EXPIRATION = OFF, CHECK_POLICY = OFF;
    PRINT 'Login expense_user created successfully.';
END
ELSE
BEGIN
    ALTER LOGIN [expense_user] WITH PASSWORD = N'ExpensePass@123', CHECK_EXPIRATION = OFF, CHECK_POLICY = OFF;
    PRINT 'Login expense_user updated successfully.';
END
GO

-- 2. Grant sysadmin role so it can create/backup databases
ALTER SERVER ROLE [sysadmin] ADD MEMBER [expense_user];
GO

PRINT 'Permissions granted to expense_user successfully.';
GO
