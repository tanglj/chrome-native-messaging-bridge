#!/bin/sh
# 由 scripts/register-chrome.sh 生成：node 为注册时解析的绝对路径，宿主脚本按本文件位置解析。
NODE="/opt/homebrew/bin/node"
[ -x "$NODE" ] || NODE=$(command -v node 2>/dev/null || true)
[ -n "$NODE" ] || { echo '未找到 node' >&2; exit 1; }
HOST_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$NODE" "$HOST_DIR/native-host.mjs"
