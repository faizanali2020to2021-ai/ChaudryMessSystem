-- ==============================================================================
-- Chaudry Mess System - Microsoft SQL Server 2014 Database Schema & Seed Script
-- ==============================================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ChaudryMessDB')
BEGIN
    CREATE DATABASE [ChaudryMessDB]
    COLLATE Latin1_General_CI_AS;
END
GO

USE [ChaudryMessDB];
GO

-- 1. AppUser Table (Singleton application user / settings)
IF OBJECT_ID(N'dbo.AppUser', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppUser (
        id INT NOT NULL CONSTRAINT PK_AppUser PRIMARY KEY DEFAULT 1,
        username NVARCHAR(100) NOT NULL,
        shopName NVARCHAR(200) NOT NULL,
        passwordHash NVARCHAR(255) NOT NULL,
        passwordSalt NVARCHAR(255) NOT NULL,
        shopAddress NVARCHAR(500) NOT NULL CONSTRAINT DF_AppUser_ShopAddress DEFAULT (''),
        hasLoggedInOnce BIT NOT NULL CONSTRAINT DF_AppUser_HasLoggedIn DEFAULT (0),
        role NVARCHAR(50) NOT NULL CONSTRAINT DF_AppUser_Role DEFAULT ('admin'),
        updatedAt DATETIME2 NOT NULL CONSTRAINT DF_AppUser_UpdatedAt DEFAULT (SYSUTCDATETIME())
    );
END
GO

-- 2. Persons Table (Mess members / participants)
IF OBJECT_ID(N'dbo.Persons', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Persons (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Persons PRIMARY KEY,
        name NVARCHAR(150) NOT NULL,
        mobileNumber NVARCHAR(50) NOT NULL CONSTRAINT DF_Persons_Mobile DEFAULT (''),
        isActive BIT NOT NULL CONSTRAINT DF_Persons_IsActive DEFAULT (1),
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_Persons_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
    CREATE NONCLUSTERED INDEX IX_Persons_Name ON dbo.Persons(name);
    CREATE NONCLUSTERED INDEX IX_Persons_IsActive ON dbo.Persons(isActive);
END
GO

-- 3. Expenses Table
IF OBJECT_ID(N'dbo.Expenses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Expenses (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Expenses PRIMARY KEY,
        expenseDate BIGINT NOT NULL, -- Epoch milliseconds (matches mobile app Kotlin Room schema)
        description NVARCHAR(500) NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        paidByPersonId BIGINT NOT NULL CONSTRAINT FK_Expenses_PaidBy FOREIGN KEY REFERENCES dbo.Persons(id),
        category NVARCHAR(50) NULL, -- 'Breakfast', 'Lunch', 'Dinner', 'Others'
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_Expenses_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
    CREATE NONCLUSTERED INDEX IX_Expenses_Date ON dbo.Expenses(expenseDate);
    CREATE NONCLUSTERED INDEX IX_Expenses_PaidBy ON dbo.Expenses(paidByPersonId);
    CREATE NONCLUSTERED INDEX IX_Expenses_Category ON dbo.Expenses(category);
END
GO

-- 4. ExpenseShares Table (Equal split with exact remainder allocation)
IF OBJECT_ID(N'dbo.ExpenseShares', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ExpenseShares (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ExpenseShares PRIMARY KEY,
        expenseId BIGINT NOT NULL CONSTRAINT FK_ExpenseShares_Expense FOREIGN KEY REFERENCES dbo.Expenses(id) ON DELETE CASCADE,
        personId BIGINT NOT NULL CONSTRAINT FK_ExpenseShares_Person FOREIGN KEY REFERENCES dbo.Persons(id),
        shareAmount DECIMAL(18,2) NOT NULL
    );
    CREATE NONCLUSTERED INDEX IX_ExpenseShares_Expense ON dbo.ExpenseShares(expenseId);
    CREATE NONCLUSTERED INDEX IX_ExpenseShares_Person ON dbo.ExpenseShares(personId);
END
GO

-- 5. GoogleAccount / System Info Table
IF OBJECT_ID(N'dbo.GoogleAccount', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.GoogleAccount (
        id INT NOT NULL CONSTRAINT PK_GoogleAccount PRIMARY KEY DEFAULT 1,
        email NVARCHAR(255) NOT NULL DEFAULT (''),
        lastBackupTimestamp BIGINT NULL,
        lastRestoreTimestamp BIGINT NULL
    );
END
GO

-- ==============================================================================
-- Initial Seeding
-- Default credentials:
-- Admin: username 'admin', password 'changeme123'
-- User : username 'user',  password 'user123'
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.AppUser WHERE id = 1)
BEGIN
    INSERT INTO dbo.AppUser (id, username, shopName, passwordHash, passwordSalt, shopAddress, hasLoggedInOnce, role)
    VALUES (
        1,
        N'admin',
        N'Chaudry Mess System',
        N'c0cb14de0ca2817bbf5a6b4be3a071e39c751d7d39f7a006712b43cf3b56028a',
        N'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        N'Near Civil Hospital, Main Road',
        0,
        N'admin'
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AppUser WHERE id = 2)
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
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.GoogleAccount WHERE id = 1)
BEGIN
    INSERT INTO dbo.GoogleAccount (id, email, lastBackupTimestamp, lastRestoreTimestamp)
    VALUES (1, N'chaudrymess@gmail.com', NULL, NULL);
END
GO

PRINT 'ChaudryMessDB database and tables initialized successfully.';
GO
