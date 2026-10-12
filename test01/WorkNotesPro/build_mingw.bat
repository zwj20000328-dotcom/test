@echo off
echo ========================================
echo  WorkNotes Pro - Build Script (MinGW)
echo ========================================
echo.

where g++ >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] g++ not found. Please install MinGW-w64 and add to PATH.
    echo         Download: https://www.msys2.org/ or https://winlibs.com/
    pause
    exit /b 1
)

echo Compiling resources ...
windres WorkNotesPro.rc -o WorkNotesPro_res.o

echo Compiling main.cpp ...
g++ -std=c++17 -O2 -DUNICODE -D_UNICODE -Wall -Wextra -municode main.cpp WorkNotesPro_res.o -o WorkNotesPro.exe -lcomctl32 -lcomdlg32 -lshell32 -lgdi32 -luser32 -luxtheme -lwinhttp

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCESS] Build complete: WorkNotesPro.exe
    echo.
    echo Run: WorkNotesPro.exe
) else (
    echo.
    echo [FAILED] Build failed. Check errors above.
)

pause
