#!/usr/bin/env bash
# 有机分子名称转换服务 —— Linux / macOS 启动脚本
# 依赖装在 ~/.local/share/vinds-iupac/venv，不塞进网站目录
set -e
cd "$(dirname "$0")"

HERE="$(pwd)"
DATA="$HOME/.local/share/vinds-iupac"
VENV="$DATA/venv"
LOG="$DATA/install.log"
mkdir -p "$DATA"

echo "============================================================"
echo "   有机分子名称转换服务"
echo "============================================================"

command -v python3 >/dev/null || {
  echo "[x] 没找到 python3，请先安装 Python 3.10+"
  exit 1
}
echo "[1/3] Python 就绪"

command -v java >/dev/null || {
  echo "[x] 没找到 java，Orthonym 和 OPSIN 都需要 Java 17+"
  exit 1
}
echo "[2/3] Java 就绪"

if [ -x "$VENV/bin/python" ]; then
  echo "[3/3] 依赖已装好"
else
  echo "[3/3] 第一次运行：安装依赖（约 60 MB，要几分钟）"
  echo "      安装日志：$LOG"
  python3 -m venv "$VENV" >>"$LOG" 2>&1 || { echo "[x] 创建虚拟环境失败，日志在 $LOG"; exit 1; }
  "$VENV/bin/python" -m pip install --upgrade pip >>"$LOG" 2>&1
  "$VENV/bin/python" -m pip install -r "$HERE/requirements.txt" >>"$LOG" 2>&1 || {
    echo "[x] 安装依赖失败，日志在 $LOG"; exit 1;
  }
  echo "      依赖安装完成"
fi

echo
echo "环境自检..."
if ! "$VENV/bin/python" -X utf8 "$HERE/iupac_server.py" --check; then
  echo
  echo "自检没通过，先按上面的提示处理。"
  exit 1
fi

echo
echo "启动服务，这个终端要一直开着。"
exec "$VENV/bin/python" -X utf8 "$HERE/iupac_server.py" "$@"
