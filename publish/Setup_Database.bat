@echo off
title Chaudry Mess System - SQL Server 2014 Setup
color 0B
echo ========================================================
echo    Initializing Chaudry Mess Database in SQL Server
echo ========================================================
echo.
echo 1. Configuring SQL Login and permissions...
sqlcmd -E -S "." -i "%~dp0sql_scripts\create_login_user.sql"
echo.
echo 2. Creating Database schema and initial tables...
sqlcmd -E -S "." -i "%~dp0sql_scripts\schema.sql"
echo.
echo ========================================================
echo  Database Setup Complete!
echo  You can now launch the application via Start_ChaudryMess.bat
echo ========================================================
pause
