# superapp-watchdog.ps1 — keep IFESS.SuperApp running; restart on crash OR on exe update.
# Detects an "update" as the exe's LastWriteTime changing (a rebuild/redeploy landed a new binary).
# On update: kill the old instance, start the new one. On crash: restart after 2s.
#
# Usage (Console session):
#   powershell -ExecutionPolicy Bypass -File scripts\superapp-watchdog.ps1
# Optional flags:
#   -Build  rebuild from source on each update before restarting (dotnet build -c Release)

param([switch]$Build)

$ErrorActionPreference = 'SilentlyContinue'
$ExeDir = 'D:\Gawean Rebinmas\Kerani_Super_App\IFESS.SuperApp\src\IFESS.SuperApp\bin\Release\net8.0-windows\win-x64'
$Exe    = Join-Path $ExeDir 'IFESS.SuperApp.exe'
$Csproj = 'D:\Gawean Rebinmas\Kerani_Super_App\IFESS.SuperApp\src\IFESS.SuperApp\IFESS.SuperApp.csproj'

if (-not (Test-Path $Exe)) {
  Write-Host "[watchdog] exe not found: $Exe" -ForegroundColor Red
  Write-Host "[watchdog] building now..." -ForegroundColor Yellow
  dotnet build $Csproj -c Release
  if (-not (Test-Path $Exe)) { Write-Host "[watchdog] build failed, exiting" -ForegroundColor Red; exit 1 }
}

function Start-SuperApp {
  Write-Host "[watchdog] starting SuperApp..." -ForegroundColor Green
  Push-Location $ExeDir
  Start-Process -FilePath $Exe -WindowStyle Hidden
  Pop-Location
}

function Stop-SuperApp {
  Get-Process -Name 'IFESS.SuperApp' -ErrorAction SilentlyContinue | Stop-Process -Force
}

$knownMtime = (Get-Item $Exe).LastWriteTime
Start-SuperApp

while ($true) {
  Start-Sleep -Seconds 3

  # --- update detection ---
  if (Test-Path $Exe) {
    $nowMtime = (Get-Item $Exe).LastWriteTime
    if ($nowMtime -ne $knownMtime) {
      Write-Host "[watchdog] UPDATE detected (exe mtime $($knownMtime) -> $($nowMtime))" -ForegroundColor Cyan
      $knownMtime = $nowMtime
      if ($Build) {
        Write-Host "[watchdog] rebuilding..." -ForegroundColor Yellow
        dotnet build $Csproj -c Release | Out-Null
        $knownMtime = (Get-Item $Exe).LastWriteTime
      }
      Write-Host "[watchdog] restarting instance..." -ForegroundColor Cyan
      Stop-SuperApp
      Start-Sleep -Seconds 2
      Start-SuperApp
      continue
    }
  }

  # --- crash detection ---
  $alive = Get-Process -Name 'IFESS.SuperApp' -ErrorAction SilentlyContinue
  if (-not $alive) {
    Write-Host "[watchdog] process not running. Restarting in 2s..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    Start-SuperApp
  }
}
