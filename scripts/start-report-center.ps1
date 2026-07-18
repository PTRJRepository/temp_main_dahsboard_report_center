param(
  [string]$Port = "3100"
)

$ErrorActionPreference = 'Stop'
$root = 'D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama'
$next = 'C:\Users\nbgmf\AppData\Roaming\npm\node_modules\bun\bin\bun.exe'

Write-Host "Starting Report Center on port $Port"
Start-Process -FilePath $next -ArgumentList 'run','dev','--','-p',$Port,'--hostname','127.0.0.1' -WorkingDirectory $root -WindowStyle Hidden | Out-Null
Write-Host "Report Center launcher started"
