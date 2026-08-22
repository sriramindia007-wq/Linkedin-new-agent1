@echo off
title Save LinkedIn Session - M2P Lending Agent
echo =================================================================
echo   LinkedIn Authentication & Session Setup
echo =================================================================
echo.
echo 1. Opening a Chrome/Edge browser window...
echo 2. Please log in to your LinkedIn account.
echo 3. Once you see your LinkedIn Feed, come back to this window and press ENTER.
echo =================================================================
echo.
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" setup_session.js
pause
