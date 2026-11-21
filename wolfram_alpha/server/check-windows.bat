@echo off
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
	echo 没找到 python，请先安装 Python 3.10+
	pause
	exit /b 1
)

python -X utf8 wa_server.py --check %*
echo.
echo （想顺便真发一次请求测试，运行: python -X utf8 wa_server.py --check --online）
pause >nul