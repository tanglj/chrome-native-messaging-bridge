#!/bin/sh
# 注册 Chrome Native Messaging Host（macOS）。
# 用法: scripts/register-chrome.sh [扩展ID] [宿主名称]
# 缺省扩展 ID 从 extension/manifest.json 的 key 字段派生（与 Chrome 的 ID 算法一致）。
# Chrome 在 macOS 读取的 manifest 位置:
#   ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/<宿主名称>.json
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
EXTENSION_ID=${1:-}
HOST_NAME=${2:-com.local.native_bridge}

MANIFEST_SRC="$ROOT/extension/manifest.json"
HOST_DIR="$ROOT/host"
LAUNCHER="$HOST_DIR/$HOST_NAME.sh"
HOST_SCRIPT="$HOST_DIR/native-host.mjs"
NM_DIR=${CHROME_NM_DIR:-"$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"}
NM_MANIFEST="$NM_DIR/$HOST_NAME.json"

command -v node >/dev/null 2>&1 || { echo '未找到 node，请先安装 Node.js 18+（brew install node）。' >&2; exit 1; }
[ -f "$HOST_SCRIPT" ] || { echo "未找到宿主脚本: $HOST_SCRIPT" >&2; exit 1; }
[ -f "$MANIFEST_SRC" ] || { echo "未找到扩展 manifest: $MANIFEST_SRC" >&2; exit 1; }
printf '%s' "$HOST_NAME" | grep -Eq '^[a-z0-9_]+(\.[a-z0-9_]+)*$' || { echo "非法宿主名称: $HOST_NAME" >&2; exit 1; }

# 1. 解析 node 绝对路径。
#    Chrome 启动原生宿主时 PATH 只有 /usr/bin:/bin:/usr/sbin:/sbin，
#    Homebrew(/opt/homebrew/bin) 或 nvm 的 node 不在其中，必须烘焙绝对路径。
NODE_PATH=$(command -v node)

# 2. 生成宿主启动脚本：node 使用注册时解析的绝对路径，失效时回退到 PATH 查找；
#    宿主脚本按启动脚本自身位置解析（Chrome 保证以 manifest 中的绝对路径调用本脚本），
#    因此项目目录整体移动后启动脚本仍然有效，只有 NM manifest 需要重新注册。
esc_json() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}
NODE_PATH_ESC=$(esc_json "$NODE_PATH")
cat > "$LAUNCHER" <<EOF
#!/bin/sh
# 由 scripts/register-chrome.sh 生成：node 为注册时解析的绝对路径，宿主脚本按本文件位置解析。
NODE="$NODE_PATH_ESC"
[ -x "\$NODE" ] || NODE=\$(command -v node 2>/dev/null || true)
[ -n "\$NODE" ] || { echo '未找到 node' >&2; exit 1; }
HOST_DIR=\$(CDPATH= cd -- "\$(dirname -- "\$0")" && pwd)
exec "\$NODE" "\$HOST_DIR/native-host.mjs"
EOF
chmod +x "$LAUNCHER"

# 3. 派生缺省扩展 ID：SHA256(SPKI DER) 前 128bit，0-9a-f 映射为 a-p（与 Chrome 算法一致）。
if [ -z "$EXTENSION_ID" ]; then
  KEY=$(sed -n 's/.*"key"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$MANIFEST_SRC")
  [ -n "$KEY" ] || { echo 'manifest.json 中没有 key 字段，请显式传入扩展 ID。' >&2; exit 1; }
  EXTENSION_ID=$(printf '%s' "$KEY" | openssl base64 -d -A \
    | openssl dgst -sha256 -hex \
    | sed -n 's/^.*= //p' \
    | cut -c1-32 \
    | tr '0123456789abcdef' 'abcdefghijklmnop')
fi
printf '%s' "$EXTENSION_ID" | grep -Eq '^[a-p]{32}$' || { echo "非法扩展 ID: $EXTENSION_ID" >&2; exit 1; }

# 4. 写入 Chrome Native Messaging manifest。
LAUNCHER_ESC=$(esc_json "$LAUNCHER")
mkdir -p "$NM_DIR"
cat > "$NM_MANIFEST" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Chrome Native Messaging bridge host",
  "path": "$LAUNCHER_ESC",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "已注册 Chrome 原生宿主:"
echo "  宿主名称: $HOST_NAME"
echo "  manifest: $NM_MANIFEST"
echo "  启动脚本: $LAUNCHER"
echo "  node:     $NODE_PATH"
echo "  扩展 ID:  $EXTENSION_ID"
