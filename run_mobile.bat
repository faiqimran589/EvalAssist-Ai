@echo off
title EvalAssist AI Platform - Mobile Mode Launcher
color 0B

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_mobile.ps1"

echo.
echo Press any key to exit launcher...
pause >nul
