@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

rem ============================================================
rem  有机分子名称转换服务 —— Windows 启动脚本（双击运行）
rem  虚拟环境放在 %LOCALAPPDATA%\vinds-iupac，不塞进网站目录
rem ============================================================

set "HERE=%~dp0"
set "DATA=%LOCALAPPDATA%\vinds-iupac"
set "VENV=%DATA%\venv"
set "LOG=%DATA%\install.log"
set "RUNC=%HERE%iupac_server.py"

if not exist "%DATA%" mkdir "%DATA%" >nul 2>&1

echo ============================================================
echo    有机分子名称转换服务
echo ============================================================
echo.

rem ---------- 1. Python ----------
set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo [x] 没找到 Python。请先装 Python 3.10 以上（安装时勾选 Add to PATH）：
  echo     https://www.python.org/downloads/
  echo.
  pause
  exit /b 1
)
echo [1/3] Python 就绪

rem ---------- 2. Java ----------
where java >nul 2>nul
if errorlevel 1 (
  echo [x] 没找到 Java。Orthonym 和 OPSIN 都需要 Java 17 以上：
  echo     https://adoptium.net/temurin/releases/
  echo.
  pause
  exit /b 1
)
echo [2/3] Java 就绪

rem ---------- 3. 依赖 ----------
if exist "%VENV%\Scripts\python.exe" (
  echo [3/3] 依赖已装好
) else (
  echo [3/3] 第一次运行：安装依赖（约 60 MB，要几分钟，请不要关窗口）
  echo       安装日志：%LOG%
  %PY% -m venv "%VENV%" > "%LOG%" 2>&1
  if errorlevel 1 (
    echo [x] 创建虚拟环境失败，日志在 %LOG%
    pause
    exit /b 1
  )
  "%VENV%\Scripts\python.exe" -m pip install --upgrade pip >> "%LOG%" 2>&1
  "%VENV%\Scripts\python.exe" -m pip install -r "%HERE%requirements.txt" >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [x] 安装依赖失败，日志在 %LOG%
    echo     常见原因：没联网、或者公司/学校网络挡住了 pip
    pause
    exit /b 1
  )
  echo       依赖安装完成
)

echo.
echo 环境自检...
"%VENV%\Scripts\python.exe" -X utf8 "%RUNC%" --check
if errorlevel 1 (
  echo.
  echo 自检没通过，先按上面的提示处理；还搞不定就把这段内容发给我。
  pause
  exit /b 1
)

echo.
echo 启动服务，这个窗口要一直开着（关掉窗口服务就停了）。
echo.
"%VENV%\Scripts\python.exe" -X utf8 "%RUNC%" %*

echo.
echo 服务已退出。如果是意外退出，请把上面的报错发给我。
pause
exit /b 0
