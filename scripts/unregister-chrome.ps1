# 注销 Chrome Native Messaging Host（Windows）。
# 用法: scripts\unregister-chrome.ps1 [-HostName <宿主名称>]
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$HostName = "com.local.native_bridge"
)

$ErrorActionPreference = "Stop"

if ($HostName -notmatch '^[a-z0-9_]+(\.[a-z0-9_]+)*$') {
  throw "非法宿主名称: $HostName"
}

$Root = Split-Path -Parent $PSScriptRoot
$Launcher = Join-Path $Root "host\$HostName.cmd"
$HostManifest = Join-Path $Root "host\$HostName.win.json"

$RegistryPaths = @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName",
  "HKCU:\Software\WOW6432Node\Google\Chrome\NativeMessagingHosts\$HostName"
)

$Found = $false
foreach ($RegistryPath in $RegistryPaths) {
  if (Test-Path $RegistryPath) {
    Remove-Item -Path $RegistryPath -Recurse -Force
    Write-Host "已注销注册表项: $RegistryPath"
    $Found = $true
  }
}

foreach ($Generated in @($Launcher, $HostManifest)) {
  if (Test-Path $Generated) {
    Remove-Item -Path $Generated -Force
    Write-Host "已删除生成文件: $Generated"
    $Found = $true
  }
}

if (-not $Found) {
  Write-Host "未注册，无需注销。"
}
