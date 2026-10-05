# Assemble the master transfer package
$baseDir = "D:\AI Video\Szkundimess"
$targetDir = "$baseDir\ChaudryMess_Transfer_Package"

if (Test-Path $targetDir) {
    Remove-Item -Path $targetDir -Recurse -Force
}

New-Item -ItemType Directory -Path "$targetDir\1_Mobile_APK" -Force | Out-Null
New-Item -ItemType Directory -Path "$targetDir\2_Mobile_App_Source_Code" -Force | Out-Null
New-Item -ItemType Directory -Path "$targetDir\3_Publish_Web_And_Database" -Force | Out-Null
New-Item -ItemType Directory -Path "$targetDir\4_Web_App_Source_Code" -Force | Out-Null

# 1. Mobile APK
Write-Host "Copying Mobile APK..."
Copy-Item "$baseDir\ChaudryMess.apk" "$targetDir\1_Mobile_APK\ChaudryMess.apk" -Force

# 2. Mobile App Source Code (Exclude build and .dart_tool for fast transfer)
Write-Host "Copying Mobile App Source Code..."
robocopy "$baseDir\mobile_app" "$targetDir\2_Mobile_App_Source_Code\mobile_app" /E /XD "build" ".dart_tool" ".gradle" /NFL /NDL /NJH /NJS

# 3. Publish for Web + Database Backup
Write-Host "Copying Publish Web..."
robocopy "$baseDir\publish" "$targetDir\3_Publish_Web_And_Database\publish" /E /NFL /NDL /NJH /NJS

Write-Host "Copying Database Backup & Scripts..."
New-Item -ItemType Directory -Path "$targetDir\3_Publish_Web_And_Database\database_backup" -Force | Out-Null
Copy-Item "$baseDir\database_backup\*" "$targetDir\3_Publish_Web_And_Database\database_backup\" -Recurse -Force
robocopy "$baseDir\sql_scripts" "$targetDir\3_Publish_Web_And_Database\sql_scripts" /E /NFL /NDL /NJH /NJS

# 4. Web Application Source Code
Write-Host "Copying Web Application Source Code..."
robocopy "$baseDir\webapp" "$targetDir\4_Web_App_Source_Code\webapp" /E /XD "node_modules" /NFL /NDL /NJH /NJS

# 5. Create README files
$readmeContent = @"
================================================================================
          CHAUDRY MESS SYSTEM - COMPLETE SYSTEM TRANSFER PACKAGE
================================================================================

This package contains everything needed to run or develop the Chaudry Mess System
on any new computer or mobile device.

--------------------------------------------------------------------------------
FOLDER CONTENTS:
--------------------------------------------------------------------------------

1. [1_Mobile_APK]
   - Contains 'ChaudryMess.apk' ready to install on any Android phone.
   - Simply copy this .apk file to your phone (via WhatsApp, Bluetooth, or USB)
     and tap to install.

2. [2_Mobile_App_Source_Code]
   - Complete Flutter source code for the Android Mobile Application.
   - Can be opened and edited in Android Studio / VS Code with Flutter.

3. [3_Publish_Web_And_Database]
   - Standalone web application with database backup.
   - Run without needing VS Code or any code editor!
   - Contents:
     * publish/                 : Pre-built web server (includes Node modules).
       - Start_App.bat          : Double-click to start the system and open browser.
       - Run_in_Background.vbs  : Silent background runner (no black CMD window).
       - Stop_App.bat           : Stops the server.
       - Allow_Firewall_Port_3000.bat : Opens network access for other devices.
     * database_backup/         : Contains ChaudryMessDB.bak & Restore_Database.bat
     * sql_scripts/             : All SQL schema & setup scripts.

4. [4_Web_App_Source_Code]
   - Full frontend and backend source code (Express.js, Vanilla JS, CSS, HTML).

--------------------------------------------------------------------------------
HOW TO SET UP ON A NEW COMPUTER:
--------------------------------------------------------------------------------

STEP 1: Install Prerequisites (One-time only)
   1. Node.js (v18 or higher): Download from https://nodejs.org
   2. Microsoft SQL Server (2014, 2016, 2019, 2022, or Express edition)
   3. SQL Server Management Studio (SSMS)

STEP 2: Restore the Database
   1. Open '3_Publish_Web_And_Database\database_backup'
   2. Double-click 'Restore_Database.bat' (or restore 'ChaudryMessDB.bak' in SSMS).
   3. Run '3_Publish_Web_And_Database\sql_scripts\create_login_user.sql' in SSMS
      to create the database login user.

STEP 3: Run the Web App
   1. Open '3_Publish_Web_And_Database\publish'
   2. Double-click 'Start_App.bat'
   3. The app will open in your browser at: http://localhost:3000
   4. To allow mobiles on the same WiFi to access:
      - Run 'Allow_Firewall_Port_3000.bat' as Administrator.
      - Mobiles can open: http://<YOUR_PC_IP>:3000

STEP 4: Mobile App Setup
   1. Install '1_Mobile_APK\ChaudryMess.apk' on the phone.
   2. Open the app -> tap the Server link at the bottom of login screen.
   3. Enter: http://<YOUR_PC_IP>:3000
   4. Login with Admin or User!

================================================================================
Default Logins:
  - Admin : admin / changeme123
  - User  : user  / user123
================================================================================
"@

Set-Content -Path "$targetDir\README_TRANSFER_INSTRUCTIONS.txt" -Value $readmeContent -Encoding UTF8

Write-Host "Assembly complete. Creating Master ZIP..."
$zipPath = "$baseDir\ChaudryMess_Complete_Transfer_Package.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

tar -a -c -f $zipPath -C $baseDir "ChaudryMess_Transfer_Package"
Write-Host "ZIP created successfully at: $zipPath"

Get-Item $zipPath | Select-Object Name, Length, LastWriteTime
