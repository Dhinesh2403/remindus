@echo off
setlocal EnableDelayedExpansion
title RemindMe Dev Tools

set ROOT=%~dp0
set FRONTEND=%ROOT%frontend
set BACKEND=%ROOT%backend
set ANDROID=%FRONTEND%\android

:MENU
cls
echo ============================================================
echo   RemindMe Dev Tools
echo ============================================================
echo.
echo   [1]  Run Dev  (Frontend + Backend)
echo   [2]  Run Frontend only  (dev config)
echo   [3]  Run Backend only   (dev config)
echo.
echo   [4]  Build APK  ^>  DEV     (debug)
echo   [5]  Build APK  ^>  STAGING (release)
echo   [6]  Build APK  ^>  PROD    (release)
echo.
echo   [7]  Cap Sync (build web + sync to Capacitor)
echo   [8]  Git Commit
echo   [9]  Git Status / Log
echo.
echo   [0]  Exit
echo.
set /p CHOICE="  Choose an option: "

if "%CHOICE%"=="1" goto RUN_DEV_BOTH
if "%CHOICE%"=="2" goto RUN_FRONTEND
if "%CHOICE%"=="3" goto RUN_BACKEND
if "%CHOICE%"=="4" goto BUILD_DEV_APK
if "%CHOICE%"=="5" goto BUILD_STAGING_APK
if "%CHOICE%"=="6" goto BUILD_PROD_APK
if "%CHOICE%"=="7" goto CAP_SYNC
if "%CHOICE%"=="8" goto GIT_COMMIT
if "%CHOICE%"=="9" goto GIT_STATUS
if "%CHOICE%"=="0" goto EXIT

echo.
echo   Invalid option. Try again.
pause
goto MENU

:: ============================================================
::  [1] Run Dev — Frontend + Backend in separate windows
:: ============================================================
:RUN_DEV_BOTH
echo.
echo   Starting Backend (dev)...
start "RemindMe Backend" cmd /k "cd /d %BACKEND% && npm run dev"

echo   Starting Frontend (dev)...
start "RemindMe Frontend" cmd /k "cd /d %FRONTEND% && npm run start:dev"

echo.
echo   Both servers launched in separate windows.
echo   Backend  : http://localhost:3000  (check your .env for the actual port)
echo   Frontend : http://localhost:8100
echo.
pause
goto MENU

:: ============================================================
::  [2] Frontend only
:: ============================================================
:RUN_FRONTEND
echo.
echo   Starting Frontend (dev)...
start "RemindMe Frontend" cmd /k "cd /d %FRONTEND% && npm run start:dev"
echo   Frontend launched: http://localhost:8100
echo.
pause
goto MENU

:: ============================================================
::  [3] Backend only
:: ============================================================
:RUN_BACKEND
echo.
echo   Starting Backend (dev)...
start "RemindMe Backend" cmd /k "cd /d %BACKEND% && npm run dev"
echo   Backend launched.
echo.
pause
goto MENU

:: ============================================================
::  [4] Build DEV APK  (debug)
:: ============================================================
:BUILD_DEV_APK
echo.
echo   [1/3] Building Angular app (development config)...
cd /d %FRONTEND%
call npm run build:dev
if errorlevel 1 ( echo   BUILD FAILED at Angular step. & pause & goto MENU )

echo.
echo   [2/3] Syncing to Capacitor...
call npx cap sync android
if errorlevel 1 ( echo   BUILD FAILED at Cap Sync step. & pause & goto MENU )

echo.
echo   [3/3] Assembling DEBUG APK with Gradle...
cd /d %ANDROID%
call gradlew.bat assembleDebug
if errorlevel 1 ( echo   BUILD FAILED at Gradle step. & pause & goto MENU )

echo.
echo   ✓  DEV APK ready:
echo      %ANDROID%\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
goto MENU

:: ============================================================
::  [5] Build STAGING APK  (release)
:: ============================================================
:BUILD_STAGING_APK
echo.
echo   [1/3] Building Angular app (staging config)...
cd /d %FRONTEND%
call npm run build:staging
if errorlevel 1 ( echo   BUILD FAILED at Angular step. & pause & goto MENU )

echo.
echo   [2/3] Syncing to Capacitor...
call npx cap sync android
if errorlevel 1 ( echo   BUILD FAILED at Cap Sync step. & pause & goto MENU )

echo.
echo   [3/3] Assembling RELEASE APK with Gradle...
cd /d %ANDROID%
call gradlew.bat assembleRelease
if errorlevel 1 ( echo   BUILD FAILED at Gradle step. & pause & goto MENU )

echo.
echo   ✓  STAGING APK ready:
echo      %ANDROID%\app\build\outputs\apk\release\app-release.apk
echo.
pause
goto MENU

:: ============================================================
::  [6] Build PROD APK  (release)
:: ============================================================
:BUILD_PROD_APK
echo.
echo   [1/3] Building Angular app (production config)...
cd /d %FRONTEND%
call npm run build:prod
if errorlevel 1 ( echo   BUILD FAILED at Angular step. & pause & goto MENU )

echo.
echo   [2/3] Syncing to Capacitor...
call npx cap sync android
if errorlevel 1 ( echo   BUILD FAILED at Cap Sync step. & pause & goto MENU )

echo.
echo   [3/3] Assembling RELEASE APK with Gradle...
cd /d %ANDROID%
call gradlew.bat assembleRelease
if errorlevel 1 ( echo   BUILD FAILED at Gradle step. & pause & goto MENU )

echo.
echo   ✓  PROD APK ready:
echo      %ANDROID%\app\build\outputs\apk\release\app-release.apk
echo.
pause
goto MENU

:: ============================================================
::  [7] Cap Sync  (build web only + sync — no APK)
:: ============================================================
:CAP_SYNC
echo.
echo   Which config to build before syncing?
echo   [1] Development
echo   [2] Staging
echo   [3] Production
echo   [0] Back
echo.
set /p SYNC_CHOICE="  Choose: "

if "%SYNC_CHOICE%"=="0" goto MENU

cd /d %FRONTEND%

if "%SYNC_CHOICE%"=="1" (
    call npm run build:dev
) else if "%SYNC_CHOICE%"=="2" (
    call npm run build:staging
) else if "%SYNC_CHOICE%"=="3" (
    call npm run build:prod
) else (
    echo Invalid choice. & pause & goto MENU
)

if errorlevel 1 ( echo   BUILD FAILED. & pause & goto MENU )

echo.
echo   Syncing to Capacitor...
call npx cap sync android
if errorlevel 1 ( echo   SYNC FAILED. & pause & goto MENU )

echo.
echo   ✓  Cap Sync complete.
echo.
pause
goto MENU

:: ============================================================
::  [8] Git Commit
:: ============================================================
:GIT_COMMIT
cd /d %ROOT%
echo.
git status
echo.
set /p COMMIT_MSG="  Commit message (leave blank to cancel): "
if "!COMMIT_MSG!"=="" (
    echo   Cancelled.
    pause
    goto MENU
)

echo.
git add -A
git commit -m "!COMMIT_MSG!"
if errorlevel 1 ( echo   COMMIT FAILED. & pause & goto MENU )

echo.
set /p PUSH_NOW="  Push to remote? (y/n): "
if /i "!PUSH_NOW!"=="y" (
    echo.
    git push
    if errorlevel 1 ( echo   PUSH FAILED. & pause & goto MENU )
    echo   ✓  Pushed.
)

echo.
echo   ✓  Commit done.
echo.
pause
goto MENU

:: ============================================================
::  [9] Git Status / Log
:: ============================================================
:GIT_STATUS
cd /d %ROOT%
echo.
echo ---- git status ----
git status
echo.
echo ---- last 10 commits ----
git log --oneline -10
echo.
pause
goto MENU

:: ============================================================
::  Exit
:: ============================================================
:EXIT
echo.
echo   Bye!
endlocal
exit /b 0
