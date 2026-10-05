@echo off
title Chaudry Mess System - Web Application
color 0A
echo ========================================================
echo        CHAUDRY MESS SYSTEM - EXPENSE MANAGEMENT
echo          Connected to Microsoft SQL Server 2014
echo ========================================================
echo.
echo Starting application on http://localhost:3000 ...
cd /d "%~dp0"

start "" "http://localhost:3000"
node server/index.js
pause
