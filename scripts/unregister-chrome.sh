#!/bin/sh
# 注销 Chrome Native Messaging Host（macOS）。
# 用法: scripts/unregister-chrome.sh [宿主名称]
set -eu

HOST_NAME=${1:-com.local.native_bridge}
NM_DIR=${CHROME_NM_DIR:-"$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"}
NM_MANIFEST="$NM_DIR/$HOST_NAME.json"

if [ -f "$NM_MANIFEST" ]; then
  rm -f "$NM_MANIFEST"
  echo "已注销 Chrome 原生宿主: $NM_MANIFEST"
else
  echo "未注册，无需注销: $NM_MANIFEST"
fi
