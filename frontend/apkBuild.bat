REM =====================================================
REM BUILD DEBUG APK
REM =====================================================

echo.
echo Building Debug APK...

cd android

IF EXIST gradlew.bat (

    call gradlew.bat assembleDebug

) ELSE (

    echo [ERROR] gradlew.bat not found
    pause
    exit /b

)

IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] APK build failed
    pause
    exit /b
)

cd ..

REM =====================================================
REM COPY APK TO build-apk FOLDER
REM =====================================================

echo.
echo Preparing APK output folder...

IF NOT EXIST "build-apk" (
    mkdir "build-apk"
)

set APK_SOURCE=android\app\build\outputs\apk\debug\app-debug.apk

IF NOT EXIST "%APK_SOURCE%" (
    echo [ERROR] APK not found:
    echo %APK_SOURCE%
    pause
    exit /b
)

REM Create timestamp

for /f "tokens=1-3 delims=/.- " %%a in ("%date%") do (
    set D1=%%a
    set D2=%%b
    set D3=%%c
)

for /f "tokens=1-2 delims=:." %%a in ("%time%") do (
    set HH=%%a
    set MN=%%b
)

set APK_NAME=RemindUs_%D3%%D2%%D1%_%HH%%MN%.apk

copy "%APK_SOURCE%" "build-apk\%APK_NAME%" >nul

IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to copy APK
    pause
    exit /b
)

REM Also keep latest build

copy "%APK_SOURCE%" "build-apk\latest.apk" >nul

REM =====================================================
REM BUILD SUCCESS
REM =====================================================

echo.
echo ============================================
echo BUILD SUCCESSFUL
echo ============================================
echo.

echo Latest APK:
echo %CD%\build-apk\latest.apk

echo.
echo Timestamped APK:
echo %CD%\build-apk\%APK_NAME%

echo.
echo Opening build-apk folder...

start "" "%CD%\build-apk"

pause