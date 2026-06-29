@echo off
echo Starting RemindUs Frontend Development Server...
echo.
echo Serving on http://localhost:8100
echo.
cd /d "%~dp0"
ng serve --host localhost --port 8100
pause
