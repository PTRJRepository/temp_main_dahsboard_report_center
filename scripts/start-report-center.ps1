param(
  [string]$Port = "3100",
  [string]$HostName = "0.0.0.0"
)

$ErrorActionPreference = 'Stop'
$root = 'D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama'
$next = 'C:\Users\nbgmf\AppData\Roaming\npm\node_modules\bun\bin\bun.exe'

Write-Host "Starting Report Center on ${HostName}:$Port"
Start-Process -FilePath $next -ArgumentList 'run','dev','--','-p',$Port,'--hostname',$HostName -WorkingDirectory $root -WindowStyle Hidden | Out-Null
Write-Host "Report Center launcher started"
