# 打包 release zip（Windows）。
# 用法: scripts\package-release.ps1 [-Version <版本号>]
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Name = "MyNativeMessagingBridge-$Version"
$Dist = Join-Path $Root "dist"
$Stage = Join-Path $Dist $Name
$Zip = Join-Path $Dist "$Name.zip"

if (Test-Path $Stage) {
  Remove-Item -Path $Stage -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $Stage, $Dist | Out-Null

$Items = @(
  "extension", "host", "scripts", "docs", "README.md", "package.json",
  "install.sh", "uninstall.sh", "install.ps1", "uninstall.ps1"
)
foreach ($Item in $Items) {
  Copy-Item -Path (Join-Path $Root $Item) -Destination $Stage -Recurse -Force
}

# 清理注册脚本生成的、与本机绑定的文件与运行日志。
Get-ChildItem -Path $Stage -Recurse -File | Where-Object {
  $_.Extension -eq ".log" -or $_.Name -like "*.win.json" -or $_.Extension -eq ".cmd"
} | Remove-Item -Force

if (Test-Path $Zip) {
  Remove-Item -Path $Zip -Force
}
Compress-Archive -Path $Stage -DestinationPath $Zip -CompressionLevel Optimal
Write-Host "已生成: $Zip"
