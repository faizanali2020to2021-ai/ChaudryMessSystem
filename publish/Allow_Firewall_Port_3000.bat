@echo off
title Chaudry Mess System - Firewall Configuration
color 0B
echo ========================================================
echo   Configuring Windows Firewall for Port 3000...
echo ========================================================
echo.

:: Auto-elevate to Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges to add firewall rule...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

netsh advfirewall firewall delete rule name="Chaudry Mess System WebApp (Port 3000)" >nul 2>&1
netsh advfirewall firewall add rule name="Chaudry Mess System WebApp (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=any

echo.
echo ========================================================
echo  SUCCESS: Port 3000 is now OPEN in Windows Firewall!
echo  Any user on your Wi-Fi or LAN can now access the app at:
echo  http://10.0.0.191:3000
echo ========================================================
echo.
pause
