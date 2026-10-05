-- ==============================================================================
-- Add Role column and create 'user' account in ChaudryMessDB & FoodExpenseManagerDB
-- ==============================================================================

USE [ChaudryMessDB];
GO

IF COL_LENGTH('dbo.AppUser', 'role') IS NULL
BEGIN
    ALTER TABLE dbo.AppUser ADD role NVARCHAR(50) NOT NULL CONSTRAINT DF_AppUser_Role DEFAULT ('admin');
    PRINT 'Added role column to ChaudryMessDB.dbo.AppUser';
END
GO

UPDATE dbo.AppUser SET role = 'admin' WHERE username = 'admin' OR id = 1;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AppUser WHERE username = 'user' OR id = 2)
BEGIN
    INSERT INTO dbo.AppUser (id, username, shopName, passwordHash, passwordSalt, shopAddress, hasLoggedInOnce, role)
    VALUES (
        2,
        N'user',
        N'Chaudry Mess System',
        N'7856b764ca46162fa6ec593d7c4ba4a8d56b07f9ed2089f55c70fa7dedb84558',
        N'd7cf84e77be767536cdd17d57dc719e6',
        N'',
        1,
        N'user'
    );
    PRINT 'Inserted user account in ChaudryMessDB';
END
ELSE
BEGIN
    UPDATE dbo.AppUser SET role = 'user' WHERE username = 'user' OR id = 2;
    PRINT 'Updated user account in ChaudryMessDB';
END
GO

-- Dual-sync with FoodExpenseManagerDB if exists
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'FoodExpenseManagerDB')
BEGIN
    USE [FoodExpenseManagerDB];

    IF COL_LENGTH('dbo.AppUser', 'role') IS NULL
    BEGIN
        ALTER TABLE dbo.AppUser ADD role NVARCHAR(50) NOT NULL CONSTRAINT DF_AppUser_Role_FE DEFAULT ('admin');
        PRINT 'Added role column to FoodExpenseManagerDB.dbo.AppUser';
    END

    UPDATE dbo.AppUser SET role = 'admin' WHERE username = 'admin' OR id = 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.AppUser WHERE username = 'user' OR id = 2)
    BEGIN
        INSERT INTO dbo.AppUser (id, username, shopName, passwordHash, passwordSalt, shopAddress, hasLoggedInOnce, role)
        VALUES (
            2,
            N'user',
            N'Chaudry Mess System',
            N'7856b764ca46162fa6ec593d7c4ba4a8d56b07f9ed2089f55c70fa7dedb84558',
            N'd7cf84e77be767536cdd17d57dc719e6',
            N'',
            1,
            N'user'
        );
        PRINT 'Inserted user account in FoodExpenseManagerDB';
    END
    ELSE
    BEGIN
        UPDATE dbo.AppUser SET role = 'user' WHERE username = 'user' OR id = 2;
        PRINT 'Updated user account in FoodExpenseManagerDB';
    END
END
GO
