-- ==============================================================================
-- Chaudry Mess System - TiDB (MySQL Compatible) Database Schema & Seed Script
-- Port: 4000 | Database: ChaudryMessDB
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `ChaudryMessDB` 
DEFAULT CHARACTER SET utf8mb4 
DEFAULT COLLATE utf8mb4_unicode_ci;

USE `ChaudryMessDB`;

-- 1. AppUser Table (Application authentication & shop settings)
CREATE TABLE IF NOT EXISTS `AppUser` (
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(100) NOT NULL UNIQUE,
    `shopName` VARCHAR(200) NOT NULL DEFAULT 'Chaudry Mess System',
    `passwordHash` VARCHAR(255) NOT NULL,
    `passwordSalt` VARCHAR(255) NOT NULL,
    `shopAddress` VARCHAR(500) NOT NULL DEFAULT '',
    `hasLoggedInOnce` TINYINT(1) NOT NULL DEFAULT 0,
    `role` VARCHAR(50) NOT NULL DEFAULT 'admin',
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Persons Table (Mess members)
CREATE TABLE IF NOT EXISTS `Persons` (
    `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `mobileNumber` VARCHAR(50) NOT NULL DEFAULT '',
    `isActive` TINYINT(1) NOT NULL DEFAULT 1,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `IX_Persons_Name` (`name`),
    INDEX `IX_Persons_IsActive` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Expenses Table
CREATE TABLE IF NOT EXISTS `Expenses` (
    `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `expenseDate` BIGINT NOT NULL, -- Epoch milliseconds
    `description` VARCHAR(500) NOT NULL,
    `amount` DECIMAL(18,2) NOT NULL,
    `paidByPersonId` BIGINT NOT NULL,
    `category` VARCHAR(50) NULL,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `IX_Expenses_Date` (`expenseDate`),
    INDEX `IX_Expenses_PaidBy` (`paidByPersonId`),
    INDEX `IX_Expenses_Category` (`category`),
    CONSTRAINT `FK_Expenses_PaidBy` FOREIGN KEY (`paidByPersonId`) REFERENCES `Persons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. ExpenseShares Table (Split details per member)
CREATE TABLE IF NOT EXISTS `ExpenseShares` (
    `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `expenseId` BIGINT NOT NULL,
    `personId` BIGINT NOT NULL,
    `shareAmount` DECIMAL(18,2) NOT NULL,
    INDEX `IX_ExpenseShares_Expense` (`expenseId`),
    INDEX `IX_ExpenseShares_Person` (`personId`),
    CONSTRAINT `FK_ExpenseShares_Expense` FOREIGN KEY (`expenseId`) REFERENCES `Expenses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_ExpenseShares_Person` FOREIGN KEY (`personId`) REFERENCES `Persons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ExpensePayers Table (Multi-payer support)
CREATE TABLE IF NOT EXISTS `ExpensePayers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `expenseId` BIGINT NOT NULL,
    `personId` BIGINT NOT NULL,
    `amountPaid` DECIMAL(18,2) NOT NULL,
    INDEX `IX_ExpensePayers_Expense` (`expenseId`),
    INDEX `IX_ExpensePayers_Person` (`personId`),
    CONSTRAINT `FK_ExpensePayers_Expense` FOREIGN KEY (`expenseId`) REFERENCES `Expenses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_ExpensePayers_Person` FOREIGN KEY (`personId`) REFERENCES `Persons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. GoogleAccount Table
CREATE TABLE IF NOT EXISTS `GoogleAccount` (
    `id` INT NOT NULL PRIMARY KEY DEFAULT 1,
    `email` VARCHAR(255) NOT NULL DEFAULT '',
    `lastBackupTimestamp` BIGINT NULL,
    `lastRestoreTimestamp` BIGINT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- Initial Seeding (Admin & User credentials)
-- Admin: username 'admin', password 'changeme123'
-- User : username 'user',  password 'user123'
-- ==============================================================================
INSERT INTO `AppUser` (`id`, `username`, `shopName`, `passwordHash`, `passwordSalt`, `shopAddress`, `hasLoggedInOnce`, `role`)
VALUES 
(1, 'admin', 'Chaudry Mess System', 'c0cb14de0ca2817bbf5a6b4be3a071e39c751d7d39f7a006712b43cf3b56028a', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', 'Main Road, Lahore', 0, 'admin')
ON DUPLICATE KEY UPDATE `username` = VALUES(`username`);

INSERT INTO `AppUser` (`id`, `username`, `shopName`, `passwordHash`, `passwordSalt`, `shopAddress`, `hasLoggedInOnce`, `role`)
VALUES 
(2, 'user', 'Chaudry Mess System', '7856b764ca46162fa6ec593d7c4ba4a8d56b07f9ed2089f55c70fa7dedb84558', 'd7cf84e77be767536cdd17d57dc719e6', '', 1, 'user')
ON DUPLICATE KEY UPDATE `username` = VALUES(`username`);

INSERT INTO `GoogleAccount` (`id`, `email`, `lastBackupTimestamp`, `lastRestoreTimestamp`)
VALUES (1, 'chaudrymess@gmail.com', NULL, NULL)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

SELECT 'TiDB ChaudryMessDB tables created and seeded successfully!' AS status;
