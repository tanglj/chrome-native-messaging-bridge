#!/bin/sh
# macOS Chrome 一键安装：注册原生宿主并提示加载扩展。
# 可选参数透传给 register-chrome.sh: install.sh [扩展ID] [宿主名称]
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

command -v node >/dev/null 2>&1 || { echo '未找到 node，请先安装 Node.js 18+（brew install node）。' >&2; exit 1; }

"$ROOT/scripts/register-chrome.sh" "$@"

echo
echo '下一步：'
echo '  1. 打开 chrome://extensions，开启右上角「开发者模式」'
echo "  2. 点击「加载已解压的扩展程序」，选择目录: $ROOT/extension"
echo '  3. 确认扩展页显示的 ID 与上方打印的「扩展 ID」一致'
echo '  4. 点击工具栏扩展图标，Connect 后即可通过 http://127.0.0.1:8765/rpc 调用'
