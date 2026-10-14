#!/bin/sh
# 打包 release zip（macOS）。
# 用法: scripts/package-release.sh [版本号]
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=${1:-0.1.0}
NAME="MyNativeMessagingBridge-$VERSION"
DIST="$ROOT/dist"
STAGE="$DIST/$NAME"
ZIP="$DIST/$NAME.zip"

rm -rf "$STAGE"
mkdir -p "$STAGE" "$DIST"

for item in extension host scripts docs README.md package.json install.sh uninstall.sh; do
  cp -R "$ROOT/$item" "$STAGE/$item"
done

find "$STAGE" -name '*.log' -delete
find "$STAGE" -name '.DS_Store' -delete

rm -f "$ZIP"
(cd "$DIST" && zip -qr "$NAME.zip" "$NAME")
echo "已生成: $ZIP"
