# Create Desktop & Startup Shortcuts for Chaudry Mess System
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Chaudry Mess System.lnk'

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "D:\AI Video\Szkundimess\publish\Start_App.bat"
$shortcut.WorkingDirectory = "D:\AI Video\Szkundimess\publish"
$shortcut.Description = "Chaudry Mess System - Expense & Reports Management"
$shortcut.Save()

Write-Host "Desktop shortcut created successfully: $shortcutPath" -ForegroundColor Green
