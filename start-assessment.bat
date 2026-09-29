@echo off
title ISM DATA TECHNOLOGY ASSESSMENT - server
cd /d "%~dp0"

echo.
echo   Starting the ISM Data Technology Assessment server...
echo   Keep this window OPEN for the whole exam. Closing it stops the test.
echo.

if not exist "node_modules\express" (
  echo   Installing dependencies for the first time, please wait...
  call npm install
  echo.
)

node server.js

echo.
echo   The server has stopped.
pause
