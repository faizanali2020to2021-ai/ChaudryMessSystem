@echo off
title Chaudry Mess System - Web Application
echo ========================================================
echo  Starting Chaudry Mess System Web Application...
echo  Connected to: Microsoft SQL Server 2014 (ChaudryMessDB)
echo ========================================================
cd /d "%~dp0webapp"

start "" "http://localhost:3000"
node server/index.js
pause
