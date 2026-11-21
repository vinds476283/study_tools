@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

rem 只做环境自检，不启动服务。出问题先双击这个，把结果发给我。

set "DATA=%LOCALAPPDATA%\vinds-iupac"
set "VENV=%DATA%\venv"
set "RUNC=%~dp0iupac_server.py"

if not exist "%VENV%\Scripts\python.exe" (
  echo 还没装好依赖，先双击 start-windows.bat 跑一次。
  pause
  exit /b 1
)

"%VENV%\Scripts\python.exe" -X utf8 "%RUNC%" --check
pause
exit /b %ERRORLEVEL%
