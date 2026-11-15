# Windows Chrome 一键安装：注册原生宿主并提示加载扩展。
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 [扩展ID] [宿主名称]
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$ExtensionId = "",
  [Parameter(Position = 1)]
  [string]$HostName = "com.local.native_bridge"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RegisterScript = Join-Path $Root "scripts\register-chrome.ps1"

& $RegisterScript -ExtensionId $ExtensionId -HostName $HostName

Write-Host ""
Write-Host "下一步："
Write-Host "  1. 打开 chrome://extensions，开启右上角「开发者模式」"
Write-Host "  2. 点击「加载已解压的扩展程序」，选择目录: $(Join-Path $Root 'extension')"
Write-Host "  3. 确认扩展页显示的 ID 与上方打印的「扩展 ID」一致"
Write-Host "  4. 点击工具栏扩展图标，Connect 后即可通过 http://127.0.0.1:8765/rpc 调用"
