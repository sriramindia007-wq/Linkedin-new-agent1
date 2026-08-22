@echo off
setlocal enabledelayedexpansion
title Push Changes to GitHub - Linkedin-new-agent1
echo =================================================================
echo   Pushing Latest Lending Agent Updates to GitHub
echo   Repository: https://github.com/sriramindia007-wq/Linkedin-new-agent1
echo =================================================================
echo.
cd /d "%~dp0"

set "GIT_CMD=git"
if exist "C:\Users\srira\.gemini\antigravity\tools\git\cmd\git.exe" (
  set "GIT_CMD=C:\Users\srira\.gemini\antigravity\tools\git\cmd\git.exe"
) else if exist "C:\Program Files\Git\cmd\git.exe" (
  set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
)

echo [1/3] Adding modified files...
"%GIT_CMD%" add .

echo [2/3] Committing changes...
set /p commit_msg="Enter commit message (or press ENTER for default): "
if "!commit_msg!"=="" set "commit_msg=Update target sources, add BankNBFC.com and bug fixes"
"%GIT_CMD%" commit -m "!commit_msg!"

echo [3/3] Pushing to GitHub (origin main)...
"%GIT_CMD%" push origin main

echo.
echo =================================================================
echo   ✅ Changes successfully pushed to GitHub!
echo   Render will auto-deploy the latest changes.
echo =================================================================
pause
