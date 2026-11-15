# Chrome Native Messaging Bridge

macOS 与 Windows 上的 Google Chrome Manifest V3 原生消息桥接扩展。扩展通过 Native Messaging 连接本机 Node.js 宿主，并仅允许访问用户在弹窗中授权的 Web Origin。

## 安装

### macOS

1. 安装 Node.js 18+。
2. 在终端执行（注册时会把 node 绝对路径烘焙进宿主启动脚本，绕过 Chrome 精简 PATH 的限制）：

   ```sh
   ./install.sh
   ```

### Windows

1. 安装 Node.js 18+。
2. 在 PowerShell 中执行（写入当前用户注册表，无需管理员权限）：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
   ```

Windows 下注册脚本会生成 `host\com.local.native_bridge.cmd` 启动器和 `host\com.local.native_bridge.win.json` manifest，并写入注册表 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.local.native_bridge`（同时兼容 32 位 Chrome 的 `WOW6432Node` 位置），默认值指向 manifest 的绝对路径。注册时会优先把解析到的 node 绝对路径写入启动器（纯 ASCII 路径时），并保留常见安装位置与 PATH 作为回退；若刚安装 Node.js，请重启 Chrome。

## 加载扩展

1. 打开 `chrome://extensions`，开启“开发者模式”，点击“加载已解压的扩展”，选择本项目的 `extension` 目录。
2. 确认页面显示的扩展 ID 为固定值 `jgebafkdklihibbdblhlbmfibdmelfhk`（由 `extension/manifest.json` 的 `key` 字段固定，换机器或移动目录都不会变化）。

扩展会自动连接本机宿主（Chrome 启动、扩展安装/更新时自动 connect，并每分钟保活重连），本地 HTTP bridge 在 Chrome 运行期间常驻 `http://127.0.0.1:8765`，通常无需手动点击 Connect。

macOS 的宿主注册文件位于 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.local.native_bridge.json`，Windows 的注册信息位于上述注册表项。移动项目目录后需重新执行对应平台的安装脚本。

## 配置与安全

- 原生宿主名称为 `com.local.native_bridge`。
- Web Origin 必须在弹窗中添加并由 Chrome 授权。
- 支持 `ping`、受限 `fetch` 和 `getCookieHeader` 消息。
- 支持 macOS 与 Windows 上的 Google Chrome，不包含 Edge。

## 打包分发

macOS：

```sh
./scripts/package-release.sh
```

Windows：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-release.ps1
```

生成 `dist/MyNativeMessagingBridge-0.1.0.zip`。目标机器解压后执行对应平台的安装脚本，再加载 `extension` 目录。

## 卸载

macOS：

```sh
./uninstall.sh
```

Windows：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1
```

然后在 `chrome://extensions` 移除扩展。
