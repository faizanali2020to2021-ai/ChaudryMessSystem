@echo off
setlocal enabledelayedexpansion
title Restore ChaudryMess Database
echo ========================================================
echo   Restoring ChaudryMessDB from Backup...
echo ========================================================
echo.

set "BAK_FILE=%~dp0ChaudryMessDB.bak"

if not exist "!BAK_FILE!" (
    echo [ERROR] Backup file not found at: !BAK_FILE!
    echo Please make sure ChaudryMessDB.bak is in the same folder.
    pause
    exit /b 1
)

echo Found backup file: !BAK_FILE!
echo.
echo Running SQL Server Restore...

sqlcmd -S localhost -E -Q "IF EXISTS (SELECT name FROM sys.databases WHERE name = N'ChaudryMessDB') ALTER DATABASE [ChaudryMessDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [ChaudryMessDB] FROM DISK = N'!BAK_FILE!' WITH REPLACE; ALTER DATABASE [ChaudryMessDB] SET MULTI_USER;"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   Database restored successfully!
    echo ========================================================
) else (
    echo.
    echo [WARNING] Default Windows Auth restore failed. Trying with SA login...
    echo If prompted, enter SA password:
    sqlcmd -S localhost -U sa -Q "IF EXISTS (SELECT name FROM sys.databases WHERE name = N'ChaudryMessDB') ALTER DATABASE [ChaudryMessDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [ChaudryMessDB] FROM DISK = N'!BAK_FILE!' WITH REPLACE; ALTER DATABASE [ChaudryMessDB] SET MULTI_USER;"
)

echo.
pause
