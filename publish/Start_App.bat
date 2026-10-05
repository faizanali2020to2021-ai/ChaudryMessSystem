@echo off
title Chaudry Mess System - Server
color 0A

cd /d "%~dp0"

echo =====================================================================
echo                 CHAUDRY MESS SYSTEM - LIVE SERVER
echo               Connected to Microsoft SQL Server 2014
echo =====================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b
)

:: Get Local IPv4 Address
for /f "tokens=4" %%a in ('route print 0.0.0.0 ^| findstr 0.0.0.0 ^| findstr /v "Default"') do (
    set LOCAL_IP=%%a
    goto :ip_found
)
:ip_found
if "%LOCAL_IP%"=="" set LOCAL_IP=localhost

echo  [Local Access]   : http://localhost:3000
echo  [Network Access] : http://%LOCAL_IP%:3000
echo.
echo  * Any mobile phone, laptop or PC on your Wi-Fi/LAN can open:
echo    http://%LOCAL_IP%:3000
echo.
echo =====================================================================
echo  Starting server and opening browser...
echo  (Keep this window open or minimized while using the application)
echo =====================================================================
echo.

start "" "http://localhost:3000"
node server/index.js

echo.
echo Server has stopped.
pause
