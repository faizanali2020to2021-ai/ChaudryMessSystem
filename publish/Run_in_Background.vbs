' Chaudry Mess System - Background Server Runner
' Starts the Node.js server silently in the background without any CMD window

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = scriptDir

' Launch server hidden (0 = hidden window)
WshShell.Run "cmd /c node server/index.js", 0, False

' Wait 2 seconds for server to initialize
WScript.Sleep 2000

' Open application in default web browser
WshShell.Run "http://localhost:3000"
