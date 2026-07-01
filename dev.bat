@echo off
setlocal EnableDelayedExpansion
title RemindUs Dev Tools

set ROOT=%~dp0
set FRONTEND=%ROOT%frontend
set BACKEND=%ROOT%backend
set ANDROID=%FRONTEND%\android
set APK_OUT=%ROOT%build-apk

:MENU
cls
echo ============================================================
echo   RemindUs Dev Tools
echo ============================================================
echo.
echo   [1]  Run Dev  (Frontend + Backend)
echo   [2]  Run Frontend only  (dev config)
echo   [3]  Run Frontend only  (staging db)
echo   [4]  Run Backend only   (dev config)
echo.
echo   [5]  Build APK  ^>  DEV     (debug)
echo   [6]  Build APK  ^>  STAGING
echo   [7]  Build APK  ^>  PROD    (release)
echo.
echo   [8]  Cap Sync (build web + sync to Capacitor)
echo   [9]  Git Commit
echo   [10] Git Status / Log
echo   [11] Deploy  ^>  move changes to PROD branch (back to main after)
echo.
echo   [0]  Exit
echo.
set /p CHOICE="  Choose an option: "

if "%CHOICE%"=="1" goto RUN_DEV_BOTH
if "%CHOICE%"=="2" goto RUN_FRONTEND
if "%CHOICE%"=="3" goto RUN_FRONTEND_STAGING
if "%CHOICE%"=="4" goto RUN_BACKEND
if "%CHOICE%"=="5" goto BUILD_DEV_APK
if "%CHOICE%"=="6" goto BUILD_STAGING_APK
if "%CHOICE%"=="7" goto BUILD_PROD_APK
if "%CHOICE%"=="8" goto CAP_SYNC
if "%CHOICE%"=="9" goto GIT_COMMIT
if "%CHOICE%"=="10" goto GIT_STATUS
if "%CHOICE%"=="11" goto DEPLOY_PROD
if "%CHOICE%"=="0" goto EXIT

echo.
echo   Invalid option. Try again.
pause
goto MENU

:: ============================================================
::  Helper: copy APK to build-apk folder and open it
::  Usage: call :DELIVER_APK <src_apk_path> <type_label>
:: ============================================================
:DELIVER_APK
set _SRC=%~1
set _TYPE=%~2
set _DEST=%APK_OUT%\%_TYPE%

if not exist "%_DEST%" mkdir "%_DEST%"

:: Read versionName from build.gradle, then auto-increment minor if file already exists
:: e.g. v1.0 exists → use v1.1, v1.1 exists → v1.2, etc.
set _VER=1.0
for /f "delims=" %%V in ('powershell -NoProfile -Command "(gc '%ANDROID%\app\build.gradle' | where{$_ -match '^ *versionName ' -and $_ -notmatch 'Suffix'}).Trim().Split([char]34)[1]"') do set _VER=%%V

:: Auto-increment: if RemindUs-<type>-v<ver>.apk already exists, bump minor version
for /f "delims=" %%F in ('powershell -NoProfile -Command ^
  "$v='!_VER!'.Split('.'); $maj=[int]$v[0]; $min=[int]$v[1]; $t='%_TYPE%'; $d='%_DEST%'; while(Test-Path \"$d\RemindUs-$t-v$maj.$min.apk\"){$min++}; \"$maj.$min\""') do set _VER=%%F

set _FNAME=RemindUs-%_TYPE%-v!_VER!.apk

:: Copy versioned file
copy /Y "%_SRC%" "%_DEST%\%_FNAME%" >nul
:: Always overwrite latest.apk (this is what git tracks)
copy /Y "%_SRC%" "%_DEST%\latest.apk" >nul

echo.
echo   ✓  %_FNAME%
echo   ✓  latest.apk  (git-tracked)
echo      ^> %_DEST%
echo.
echo   Opening build-apk folder...
explorer "%_DEST%"
goto :EOF

:: ============================================================
::  [1] Run Dev — Frontend + Backend in separate windows
:: ============================================================
:RUN_DEV_BOTH
echo.
echo   Starting Backend (dev)...
start "RemindUs Backend" cmd /k "cd /d %BACKEND% && npm run dev"

echo   Starting Frontend (dev)...
start "RemindUs Frontend" cmd /k "cd /d %FRONTEND% && npm run start:dev"

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
start "RemindUs Frontend" cmd /k "cd /d %FRONTEND% && npm run start:dev"
echo   Frontend launched: http://localhost:8100
echo.
pause
goto MENU

:: ============================================================
::  [3] Frontend only â€” STAGING db (staging config)
:: ============================================================
:RUN_FRONTEND_STAGING
echo.
echo   Starting Frontend (staging db)...
start "RemindUs Frontend (staging)" cmd /k "cd /d %FRONTEND% && npm run start:staging"
echo   Frontend launched: http://localhost:8100  (staging config / db)
echo.
pause
goto MENU

:: ============================================================
::  [4] Backend only
:: ============================================================
:RUN_BACKEND
echo.
echo   Starting Backend (dev)...
start "RemindUs Backend" cmd /k "cd /d %BACKEND% && npm run dev"
echo   Backend launched.
echo.
pause
goto MENU

:: ============================================================
::  [5] Build DEV APK  (debug — package ID: com.remindus.app.debug)
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
echo   [3/3] Assembling DEV (debug) APK with Gradle...
cd /d %ANDROID%
call gradlew.bat assembleDebug
if errorlevel 1 ( echo   BUILD FAILED at Gradle step. & pause & goto MENU )

call :DELIVER_APK "%ANDROID%\app\build\outputs\apk\debug\app-debug.apk" "dev"
pause
goto MENU

:: ============================================================
::  [6] Build STAGING APK
::      Same package ID as prod, debug-signed.
::      Installing over production triggers "package appears to be invalid".
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
echo   [3/3] Assembling STAGING APK with Gradle...
cd /d %ANDROID%
call gradlew.bat assembleStaging
if errorlevel 1 ( echo   BUILD FAILED at Gradle step. & pause & goto MENU )

call :DELIVER_APK "%ANDROID%\app\build\outputs\apk\staging\app-staging.apk" "staging"
pause
goto MENU

:: ============================================================
::  [7] Build PROD APK  (release — package ID: com.remindus.app)
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
echo   [3/3] Assembling PROD (release) APK with Gradle...
cd /d %ANDROID%
call gradlew.bat assembleRelease
if errorlevel 1 ( echo   BUILD FAILED at Gradle step. & pause & goto MENU )

call :DELIVER_APK "%ANDROID%\app\build\outputs\apk\release\app-release-unsigned.apk" "prod"
pause
goto MENU

:: ============================================================
::  [8] Cap Sync  (build web only + sync — no APK)
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
::  [9] Git Commit
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
::  [10] Git Status / Log
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
::  [11] Deploy — merge main into prod, push, return to main
:: ============================================================
:DEPLOY_PROD
cd /d %ROOT%
echo.
echo   This will:
echo     1. checkout main and pull latest
echo     2. checkout prod and merge main into it
echo     3. push prod
echo     4. switch back to main
echo.
echo   Make sure your changes are committed first (uncommitted changes
echo   can block branch switching / merging).
echo.
set /p DEPLOY_CONFIRM="  Continue? (y/n): "
if /i not "!DEPLOY_CONFIRM!"=="y" (
    echo   Cancelled.
    pause
    goto MENU
)

echo.
echo   [1/6] Checking out main...
git checkout main
if errorlevel 1 ( echo   FAILED to checkout main. & pause & goto MENU )

echo   [2/6] Pulling latest main...
git pull origin main
if errorlevel 1 ( echo   FAILED to pull main. & pause & goto MENU )

echo   [3/6] Checking out prod...
git checkout prod
if errorlevel 1 ( echo   FAILED to checkout prod. & pause & goto MENU )

echo   [4/6] Pulling latest prod...
git pull origin prod
if errorlevel 1 ( echo   FAILED to pull prod. & pause & goto MENU )

echo   [5/6] Merging main into prod...
git merge main
if errorlevel 1 (
    echo.
    echo   MERGE FAILED / conflicts. Resolve them on prod, then push manually.
    echo   You are currently on the prod branch.
    pause
    goto MENU
)

git push origin prod
if errorlevel 1 ( echo   PUSH FAILED. You are on prod. & pause & goto MENU )

echo   [6/6] Switching back to main...
git checkout main
if errorlevel 1 ( echo   Merge/push done, but FAILED to switch back to main. & pause & goto MENU )

echo.
echo   ✓  Deployed main -^> prod and back on main.
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
