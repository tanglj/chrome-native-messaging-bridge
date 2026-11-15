# macOS / Windows Chrome 安装使用指南

1. 在 Chrome 的 `chrome://extensions` 开启开发者模式，加载项目中的 `extension` 目录。
2. 确认扩展 ID 为固定值 `jgebafkdklihibbdblhlbmfibdmelfhk`（由 `extension/manifest.json` 的 `key` 字段固定，换机器或移动目录都不会变化）。
3. 注册 Native Messaging 宿主（顺序不限）：
   - macOS：执行 `./install.sh`。注册时会把 node 绝对路径烘焙进宿主启动脚本，绕过 Chrome 精简 PATH 的限制。
   - Windows：在 PowerShell 执行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1`。注册脚本会生成 `.cmd` 启动器与宿主 manifest，并写入当前用户注册表，无需管理员权限。
4. 扩展会自动连接宿主：Chrome 启动、扩展安装/更新时自动 connect，并每分钟保活重连。本地 HTTP bridge 常驻 `http://127.0.0.1:8765`，通常无需手动操作；也可在扩展弹窗手动点击 Connect 和 Ping。
5. 添加需要访问的 Web Origin，并使用 Fetch URL 验证请求。

注册位置：

- macOS：`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.local.native_bridge.json`。
- Windows：注册表 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.local.native_bridge`（兼容 32 位 Chrome 的 `WOW6432Node` 位置），默认值指向 `host\com.local.native_bridge.win.json`。

注册信息内是项目绝对路径，移动项目目录后需重新执行对应平台的安装脚本。Windows 注册时会优先把 node 绝对路径写入启动器（纯 ASCII 路径时），并保留常见安装位置与 PATH 回退；若刚安装 Node.js，请重启 Chrome。

卸载时执行对应平台的卸载脚本（macOS `./uninstall.sh`，Windows `powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1`），再从 `chrome://extensions` 移除扩展。
