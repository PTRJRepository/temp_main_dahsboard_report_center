param(
  [string]$Port = "3101",
  [string]$HostName = "0.0.0.0"
)

$ErrorActionPreference = 'Stop'
$root = 'D:\Gawean Rebinmas\Main Dashboard\Module Services\report-center'
$next = 'C:\Users\nbgmf\AppData\Roaming\npm\node_modules\bun\bin\bun.exe'

Write-Host "Starting Report Center (standalone) on ${HostName}:$Port"
Start-Process -FilePath $next -ArgumentList 'run','start','--','-p',$Port,'--hostname',$HostName -WorkingDirectory $root -WindowStyle Hidden | Out-Null
Write-Host "Report Center launcher started"
