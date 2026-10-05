# Build Publish Script for Chaudry Mess System
$baseDir = "D:\AI Video\Szkundimess"
$publishDir = "$baseDir\publish"
$zipPath = "$baseDir\ChaudryMess_Publish.zip"

Write-Host "Creating clean publish directory..." -ForegroundColor Cyan
if (!(Test-Path $publishDir)) {
    New-Item -ItemType Directory -Force -Path $publishDir | Out-Null
}
New-Item -ItemType Directory -Force -Path "$publishDir\backups" | Out-Null

Write-Host "Updating server files..." -ForegroundColor Cyan
Copy-Item -Recurse -Force "$baseDir\webapp\server" "$publishDir\server"

Write-Host "Updating frontend public files..." -ForegroundColor Cyan
Copy-Item -Recurse -Force "$baseDir\webapp\public" "$publishDir\public"

Write-Host "Updating sql scripts..." -ForegroundColor Cyan
Copy-Item -Recurse -Force "$baseDir\sql_scripts" "$publishDir\sql_scripts"

Write-Host "Updating configuration and package files..." -ForegroundColor Cyan
Copy-Item -Force "$baseDir\webapp\package.json" "$publishDir\"
Copy-Item -Force "$baseDir\webapp\package-lock.json" "$publishDir\"
Copy-Item -Force "$baseDir\webapp\.env" "$publishDir\"

# Create Desktop Shortcut
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Chaudry Mess System.lnk'
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = "$publishDir\Start_App.bat"
$sc.WorkingDirectory = $publishDir
$sc.Description = "Chaudry Mess System - Expense & Reports Management"
$sc.Save()

Write-Host "Re-packaging zip with tar..." -ForegroundColor Cyan
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
tar -a -c -f $zipPath -C $baseDir publish

Write-Host "Publish updated successfully at: $publishDir" -ForegroundColor Green
Write-Host "Zip updated successfully at: $zipPath" -ForegroundColor Green
