# macOS Chrome 安装使用指南

1. 在 Chrome 的 `chrome://extensions` 开启开发者模式，加载项目中的 `extension` 目录。
2. 确认扩展 ID 为固定值 `jgebafkdklihibbdblhlbmfibdmelfhk`（由 `extension/manifest.json` 的 `key` 字段固定，换机器或移动目录都不会变化）。
3. 执行 `./install.sh` 注册 Native Messaging 宿主（顺序不限；注册时会把 node 绝对路径烘焙进宿主启动脚本，绕过 Chrome 精简 PATH 的限制）。
4. 扩展会自动连接宿主：Chrome 启动、扩展安装/更新时自动 connect，并每分钟保活重连。本地 HTTP bridge 常驻 `http://127.0.0.1:8765`，通常无需手动操作；也可在扩展弹窗手动点击 Connect 和 Ping。
5. 添加需要访问的 Web Origin，并使用 Fetch URL 验证请求。

宿主注册文件位于 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.local.native_bridge.json`；注册文件内是项目绝对路径，移动项目目录后需重新执行 `./install.sh`。

卸载时执行 `./uninstall.sh`，再从 `chrome://extensions` 移除扩展。
