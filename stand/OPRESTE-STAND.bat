@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0OPRESTE-STAND.ps1"
if errorlevel 1 pause
