@echo off
echo ========================================
echo  WorkNotes Pro - Build Script (MSVC)
echo ========================================
echo.

where cl >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] cl.exe not found. Please run from "x64 Native Tools Command Prompt for VS"
    echo         or run vcvarsall.bat first.
    echo.
    echo Common locations:
    echo   "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64
    echo   "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvarsall.bat" x64
    pause
    exit /b 1
)

echo Compiling resources ...
rc /nologo WorkNotesPro.rc

echo Compiling main.cpp ...
cl /nologo /EHsc /O2 /DUNICODE /D_UNICODE /W3 main.cpp WorkNotesPro.res /link /SUBSYSTEM:WINDOWS user32.lib gdi32.lib comctl32.lib comdlg32.lib shell32.lib winhttp.lib /OUT:WorkNotesPro.exe

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
