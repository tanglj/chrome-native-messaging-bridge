# Windows Chrome 卸载：注销原生宿主。
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 [宿主名称]
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$HostName = "com.local.native_bridge"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $Root "scripts\unregister-chrome.ps1") -HostName $HostName
