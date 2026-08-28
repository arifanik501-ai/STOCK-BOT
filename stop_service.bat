@echo off
setlocal
echo Stopping any running BOM Collector Bot processes on port 8088...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8088" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Done.
endlocal
