@echo off
title Chaudry Mess System - AutoStart Setup
color 0B
echo ========================================================
echo   Setting Chaudry Mess System to start with Windows...
echo ========================================================
echo.

powershell -Command "
`$startup = [Environment]::GetFolderPath('Startup');
`$shortcutPath = Join-Path `$startup 'Chaudry Mess System.lnk';
`$wsh = New-Object -ComObject WScript.Shell;
`$sc = `$wsh.CreateShortcut(`$shortcutPath);
`$sc.TargetPath = 'wscript.exe';
`$sc.Arguments = '\"D:\AI Video\Szkundimess\publish\Run_in_Background.vbs\"';
`$sc.WorkingDirectory = 'D:\AI Video\Szkundimess\publish';
`$sc.Description = 'Chaudry Mess System - Background Service';
`$sc.Save();
Write-Host 'Autostart shortcut created in Startup folder successfully.' -ForegroundColor Green;
"

echo.
echo ========================================================
echo  SUCCESS!
echo  Whenever your computer turns on or restarts,
echo  the Chaudry Mess System will automatically run in the
echo  background and remain available on your network.
echo ========================================================
echo.
pause
