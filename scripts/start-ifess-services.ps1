$ErrorActionPreference = 'Stop'
$bun = 'C:\Users\nbgmf\AppData\Roaming\npm\node_modules\bun\bin\bun.exe'

Write-Host 'Starting Firebird Query Service on port 8004'
$env:PORT = '8004'
Start-Process -FilePath $bun -ArgumentList 'run','Services/firebird-query-service/src/index.js' -WorkingDirectory 'D:\Gawean Rebinmas\Main Dashboard' -WindowStyle Hidden | Out-Null

Write-Host 'Starting IFESS client gateway on port 8003'
$env:PORT = '8003'
Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory 'D:\Gawean Rebinmas\IFESS_Server_Web' -WindowStyle Hidden | Out-Null

Write-Host 'IFESS services launcher started'
