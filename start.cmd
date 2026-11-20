@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto use_python
py -3 -B launcher.py
goto finished
:use_python
where python >nul 2>nul
if errorlevel 1 goto missing_python
python -B launcher.py
goto finished
:missing_python
echo Python 3.10 or newer is required. Install from https://www.python.org/downloads/
:finished
pause
