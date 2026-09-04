@echo off
title EvalAssist AI Platform - Launcher
color 0A

echo ============================================
echo   EvalAssist AI Platform - Starting Up...
echo ============================================
echo.

:: Resolve project root directory
set "PROJECT_ROOT=%~dp0"

:: ---- Start Backend Server ----
echo [1/3] Starting Backend Server on http://0.0.0.0:8001 ...
start "EvalAssist Backend" cmd /k "cd /d %PROJECT_ROOT%backend && %PROJECT_ROOT%backend\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"

:: ---- Wait for backend to initialize ----
echo [2/3] Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

:: ---- Start Frontend Dev Server ----
echo [3/3] Starting Frontend Dev Server on http://0.0.0.0:3001 ...
start "EvalAssist Frontend" cmd /k "cd /d %PROJECT_ROOT%frontend && npx next dev -H 0.0.0.0 -p 3001"

:: ---- Wait for frontend to initialize ----
echo.
echo Waiting for frontend to compile...
timeout /t 10 /nobreak >nul

:: ---- Open Browser ----
echo.
echo Opening EvalAssist in your default browser...
start "" http://localhost:3001

echo.
echo ============================================
echo   EvalAssist is running!
echo   Frontend: http://localhost:3001
echo   Backend:  http://0.0.0.0:8001
echo   API Docs: http://localhost:8001/docs
echo ============================================
echo.
echo Close this window when done. Backend and
echo frontend windows must also be closed.
echo.
pause
