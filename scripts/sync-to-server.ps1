<#
.SYNOPSIS
  Pack tarot-clone and upload via scp/ssh. By default EXCLUDES tarot-server/.env so server DB/JWT secrets are not overwritten.

.PARAMETER IncludeEnv
  Include tarot-server/.env in the archive (overwrites server .env — only if you intend to).

Example:
  .\scripts\sync-to-server.ps1 -RemoteHost 106.75.23.170 -Port 2223 -User ubuntu `
    -KeyPath "C:\Users\admin\Documents\beiji123.pem" -RemotePath "~/tarot-clone"

  .\scripts\sync-to-server.ps1 ... -SkipBuild
  .\scripts\sync-to-server.ps1 ... -IncludeEnv   # 打包本机 .env（会覆盖服务器 DB 等配置，慎用）
#>
param(
  [Parameter(Mandatory = $true)][string]$RemoteHost,
  [int]$Port = 22,
  [string]$User = "ubuntu",
  [Parameter(Mandatory = $true)][string]$KeyPath,
  [string]$RemotePath = "~/tarot-clone",
  [switch]$SkipBuild,
  # 默认排除 .env；仅在你明确要覆盖服务器环境时加 -IncludeEnv
  [switch]$IncludeEnv
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "Key file not found: $KeyPath"
}
$keyFull = (Resolve-Path -LiteralPath $KeyPath).Path

if (-not $SkipBuild) {
  Write-Host "INFO: build tarot-server..." -ForegroundColor Cyan
  Push-Location (Join-Path $repoRoot "tarot-server")
  npm run build
  Pop-Location
  Write-Host "INFO: build tarot-vue..." -ForegroundColor Cyan
  Push-Location (Join-Path $repoRoot "tarot-vue")
  npm run build
  Pop-Location
}

$tarName = "tarot-clone-deploy.tar"
$tarPath = Join-Path (Split-Path $repoRoot -Parent) $tarName
if (Test-Path $tarPath) { Remove-Item $tarPath -Force }

$excludes = @(
  "--exclude=tarot-vue/node_modules",
  "--exclude=tarot-server/node_modules",
  "--exclude=.git"
)
if (-not $IncludeEnv) {
  $excludes += "--exclude=tarot-server/.env"
  Write-Host "INFO: excluding tarot-server/.env (pass -IncludeEnv to include)" -ForegroundColor Yellow
}
else {
  $envFile = Join-Path $repoRoot "tarot-server\.env"
  if (Test-Path -LiteralPath $envFile) {
    Write-Host "WARN: including tarot-server/.env — will overwrite server secrets" -ForegroundColor Yellow
  }
  else {
    Write-Host "WARN: -IncludeEnv but no local tarot-server/.env" -ForegroundColor Yellow
  }
}

Write-Host "INFO: packing $tarPath" -ForegroundColor Cyan
& tar -cf $tarPath @excludes .

Write-Host "INFO: scp upload -> ${User}@${RemoteHost}:/tmp/$tarName" -ForegroundColor Cyan
& scp -i $keyFull -P $Port -o StrictHostKeyChecking=accept-new $tarPath "${User}@${RemoteHost}:/tmp/$tarName"

$remoteTar = "/tmp/$tarName"
$extractCmd = "mkdir -p $RemotePath && tar xf $remoteTar -C $RemotePath && rm -f $remoteTar"
Write-Host "INFO: remote extract to $RemotePath" -ForegroundColor Cyan
& ssh -i $keyFull -p $Port -o StrictHostKeyChecking=accept-new "${User}@${RemoteHost}" $extractCmd

Remove-Item $tarPath -Force -ErrorAction SilentlyContinue
Write-Host "DONE: sync finished." -ForegroundColor Green
Write-Host "On server (example): cd $RemotePath/tarot-server ; npm ci --omit=dev ; bash ../deploy.sh restart" -ForegroundColor Gray
