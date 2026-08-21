@echo off
title LinkedIn Lending Intelligence Agent - M2P Fintech
echo =================================================================
echo   LinkedIn Lending Intelligence & AI Comment Automation Agent
echo   Calibrated for Sriram Ganesan (Head of LOS Product & Solutions)
echo =================================================================
echo.
echo [1/2] Starting local intelligence server & scheduler (7am & 6pm)...
cd /d "%~dp0"
start "" "C:\Program Files\nodejs\node.exe" server_standalone.js
timeout /t 2 /nobreak >nul

echo [2/2] Launching dashboard in browser...
start http://localhost:3000

echo.
echo =================================================================
echo  App is LIVE at: http://localhost:3000
echo  Keep this window running to maintain the 7am & 6pm auto-scrapes!
echo =================================================================
