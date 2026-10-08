@echo off
title Antigravity Chat Studio & Organizer
chcp 65001 > nul

echo =======================================================
echo    ⚡ Antigravity Chat Studio & Project Organizer
echo =======================================================
echo.
echo [1/2] جاري تشغيل خادم لوحة التحكم...
echo.

start "" "http://localhost:4949"

node server.js

pause
