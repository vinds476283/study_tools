@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem %~dp0 末尾带反斜杠，直接塞进引号里会变成 \" 把引号转义掉，所以先去掉
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo ============================================================
echo   铟子vinds 的学习工具 - 一键启动
echo ============================================================
echo.

rem ------------------------------------------------ 1. 检查 Python
where python >nul 2>nul
if errorlevel 1 (
	echo [x] 没找到 python。
	echo     先装 Python 3.10 以上，安装时勾选 "Add python.exe to PATH"。
	echo.
	pause
	exit /b 1
)
for /f "delims=" %%v in ('python --version 2^>^&1') do set "PYVER=%%v"
echo [√] 找到 %PYVER%

rem ------------------------------------------------ 2. 静态站点 8000
call :listening 8000
if errorlevel 1 (
	start "静态站点 8000" /min python -m http.server 8000 --directory "%ROOT%"
	ping -n 4 127.0.0.1 >nul
	call :listening 8000
	if errorlevel 1 (
		echo [x] 静态站点没起来，看看 8000 是不是被别的程序占了
	) else (
		echo [√] 静态站点 :  http://127.0.0.1:8000/
	)
) else (
	echo [=] 端口 8000 已经在跑，跳过
)

rem ------------------------------------------------ 3. Wolfram 代理 8018
if not exist "wolfram_alpha\server\data\appid.txt" goto :no_wa
if not exist "wolfram_alpha\server\data\tokens.json" goto :no_wa
call :listening 8018
if errorlevel 1 (
	start "Wolfram 代理 8018" /min python -X utf8 "wolfram_alpha\server\wa_server.py"
	ping -n 4 127.0.0.1 >nul
	call :listening 8018
	if errorlevel 1 (
		echo [x] Wolfram 代理没起来，看看 8018 是不是被占了
	) else (
		echo [√] Wolfram 代理 : http://127.0.0.1:8018/health
	)
) else (
	echo [=] 端口 8018 已经在跑，跳过
)
goto :open

:no_wa
echo [提示] 没有 wolfram_alpha\server\data\appid.txt 或 tokens.json，
echo     Wolfram Alpha 那个页面暂时算不了，其它功能不受影响。
echo        怎么配见 wolfram_alpha\server\README.md

:open
echo.
echo ------------------------------------------------------------
start "" "http://127.0.0.1:8000/"
echo   浏览器已打开 http://127.0.0.1:8000/
echo.
echo   局域网内别的电脑可以试：
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /I "IPv4"') do (
	set "IP=%%a"
	set "IP=!IP: =!"
	echo      http://!IP!:8000/
)
echo   （有多张网卡时，挑和同学在同一网段的那一个）
echo.
echo   上面那些最小化的窗口是服务本身，用的时候别关。
echo   关掉本窗口不会停服务；要停服务就关掉那些小窗口。
echo ------------------------------------------------------------
echo.
pause
exit /b 0

rem ------------------------------------------------ 子程序：查端口
:listening
netstat -ano | findstr /C:"LISTENING" | findstr /C:":%~1" >nul 2>nul
exit /b %errorlevel%