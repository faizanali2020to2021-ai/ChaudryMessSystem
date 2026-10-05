@echo off
title Chaudry Mess System - Stop Server
color 0C
echo ========================================================
echo        Stopping Chaudry Mess System Server...
echo ========================================================
echo.

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Stopping process PID %%a listening on port 3000...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Server has been stopped successfully.
echo.
timeout /t 3
