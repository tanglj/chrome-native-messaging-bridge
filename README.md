# Chrome Native Messaging Bridge

macOS + Google Chrome 专用的 Manifest V3 原生消息桥接扩展。扩展通过 Native Messaging 连接本机 Node.js 宿主，并仅允许访问用户在弹窗中授权的 Web Origin。

## 安装

1. 安装 Node.js 18+。
2. 在终端执行（注册时会把 node 绝对路径烘焙进宿主启动脚本，绕过 Chrome 精简 PATH 的限制）：

   ```sh
   ./install.sh
   ```

3. 打开 `chrome://extensions`，开启“开发者模式”，点击“加载已解压的扩展”，选择本项目的 `extension` 目录。
4. 确认页面显示的扩展 ID 为固定值 `jgebafkdklihibbdblhlbmfibdmelfhk`（由 `extension/manifest.json` 的 `key` 字段固定，换机器或移动目录都不会变化）。

扩展会自动连接本机宿主（Chrome 启动、扩展安装/更新时自动 connect，并每分钟保活重连），本地 HTTP bridge 在 Chrome 运行期间常驻 `http://127.0.0.1:8765`，通常无需手动点击 Connect。

宿主注册文件位于 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.local.native_bridge.json`。移动项目目录后需重新执行 `./install.sh`。

## 配置与安全

- 原生宿主名称为 `com.local.native_bridge`。
- Web Origin 必须在弹窗中添加并由 Chrome 授权。
- 支持 `ping`、受限 `fetch` 和 `getCookieHeader` 消息。
- 本项目只支持 macOS Chrome，不包含 Edge、Windows 或 PowerShell 安装入口。

## 打包分发

```sh
./scripts/package-release.sh
```

生成 `dist/MyNativeMessagingBridge-0.1.0.zip`。目标机器解压后执行 `./install.sh`，再加载 `extension` 目录。

## 卸载

```sh
./uninstall.sh
```

然后在 `chrome://extensions` 移除扩展。
