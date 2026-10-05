================================================================================
          CHAUDRY MESS SYSTEM - STANDALONE DEPLOYMENT GUIDE
================================================================================

Ye application bilkul standalone hai aur kisi bhi coding software ya tool ke
baghair direct Windows par chalti hai. Isko aapke computer par aur aapke Wi-Fi
ya local network par mojood kisi bhi mobile ya PC par chalaya ja sakta hai.

--------------------------------------------------------------------------------
FILE STRUCTURE & TOOLS:
--------------------------------------------------------------------------------
1. Start_App.bat              : Application start karta hai aur browser open karta hai
2. Run_in_Background.vbs      : Background mein silent chalata hai (koi black window nahi aati)
3. Stop_App.bat               : Server ko stop / close karta hai
4. Allow_Firewall_Port_3000.bat: Network access enable karta hai (Run as Admin)
5. AutoStart_With_Windows.bat : Windows start hone par automatically run hone ke liye
6. Setup_Database.bat         : Pehli dafa SQL Server 2014 database banane ke liye
7. Desktop Shortcut           : "Chaudry Mess System" aapke Desktop par ban chuka hai!

--------------------------------------------------------------------------------
HOW TO RUN ON THIS COMPUTER (Apne System Par Chalana):
--------------------------------------------------------------------------------
Tareeqa 1 (Direct Shortcut):
  - Apne Desktop par "Chaudry Mess System" shortcut par double click karein.
  - Server start hoga aur browser khud ba khud http://localhost:3000 par khul jayega.

Tareeqa 2 (Background Silent Mode):
  - "Run_in_Background.vbs" par double click karein.
  - Server background mein chalna shuru ho jayega aur browser open ho jayega.
  - Koi black CMD window khuli nahi rahegi.

--------------------------------------------------------------------------------
HOW TO USE FROM MOBILE / OTHER PCS (Network Par Chalana):
--------------------------------------------------------------------------------
Agar aap chahte hain ke aapke Wi-Fi / router par connected koi bhi mobile phone,
laptop ya doosra PC is system ko chala sake:

1. Pehli dafa "Allow_Firewall_Port_3000.bat" par double click karein (Windows Firewall allow karein).
2. Apne computer ka local IP address check karein (Default: 10.0.0.191).
3. Apne mobile phone ya doosre computer ke browser (Chrome / Safari / Firefox) mein ye link open karein:
   
   http://10.0.0.191:3000

4. Ab mess ka koi bhi member apne mobile se live expenses, balances aur reports dekh sakta hai!

--------------------------------------------------------------------------------
LOGIN CREDENTIALS:
--------------------------------------------------------------------------------
Username : admin
Password : changeme123
(Password app ke andar side menu se kisi bhi waqt change ho sakta hai)

--------------------------------------------------------------------------------
AUTO-START WITH WINDOWS (Har waqt online rakhna):
--------------------------------------------------------------------------------
- Agar aap chahte hain ke computer on hote hi system khud ba khud background mein
  chal jaye (baghair kisi click ke), to "AutoStart_With_Windows.bat" par 1 dafa click kar dein.
================================================================================
