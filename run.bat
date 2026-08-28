@echo off
title MEP BOM Collector Bot & Dashboard
color 0A
cd /d "%~dp0"
echo ======================================================================
echo             MEP BOM COLLECTOR BOT & DASHBOARD v1.0
echo ======================================================================
echo Starting server and launching dashboard...
echo.
python bot.py
pause
