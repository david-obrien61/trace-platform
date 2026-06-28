@echo off
echo ===================================================
echo      Raw Element Asset Library Setup Launcher
echo ===================================================
echo.
echo Checking and installing required dependencies...
pip install -r requirements.txt
echo.
echo Starting the Application...
start python main.py
exit