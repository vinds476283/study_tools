@echo off
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
	echo 没找到 python，请先安装 Python 3.10+
	echo 安装时记得勾选 "Add python.exe to PATH"
	pause
	exit /b 1
)

python -X utf8 wa_server.py %*
echo.
echo 服务已结束，按任意键关闭窗口
pause >nul