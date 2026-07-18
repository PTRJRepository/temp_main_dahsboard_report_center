# Phase 4 integration test
param([string]$port = "3001")
$ErrorActionPreference = "Continue"

$env:START_DASHBOARD = "false"
$env:START_MODULE_SERVICES = "false"
$env:PORT = $port

$bunExe = "C:\Users\nbgmf\AppData\Roaming\npm\node_modules\bun\bin\bun.exe"
$proc = Start-Process -FilePath $bunExe -ArgumentList "run","server_bun.js" `
    -WorkingDirectory "D:\Gawean Rebinmas\Main Dashboard" `
    -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 5

$base = "http://localhost:$port"

function Test-Url($path, $expected, $desc) {
    $status = 0
    try {
        $r = Invoke-WebRequest -Uri "$base$path" -UseBasicParsing -TimeoutSec 3
        $status = $r.StatusCode
    } catch {
        if ($_.Exception -is [System.Net.WebException]) {
            $status = [int]$_.Exception.Response.StatusCode
        }
    }
    $ok = $status -eq $expected
    Write-Host "  $desc -> $status (expect $expected) $(if($ok){'OK'}else{'FAIL'})"
    return $ok
}

Write-Host "=== Phase 4 Tests on port $port ==="
$pass = $true

$pass = (Test-Url "/health/live" 200 "GET /health/live") -and $pass
$pass = (Test-Url "/health/ready" 200 "GET /health/ready") -and $pass
$pass = (Test-Url "/version" 200 "GET /version") -and $pass
$pass = (Test-Url "/health" 200 "GET /health") -and $pass
$pass = (Test-Url "/backend/upah" 401 "GET /backend/upah no key -> 401") -and $pass

try {
    $r = Invoke-WebRequest -Uri "$base/backend/upah" -Headers @{"X-API-Key"="ptrj-upath-key"} -UseBasicParsing -TimeoutSec 3
    $s = $r.StatusCode
} catch {
    if ($_.Exception -is [System.Net.WebException]) {
        $s = [int]$_.Exception.Response.StatusCode
    } else { $s = 0 }
}
$ok = $s -ne 401 -and $s -ne 403
Write-Host "  GET /backend/upah correct key -> $s (not 401/403 = auth bypassed) $(if($ok){'OK'}else{'FAIL'})"
$pass = $pass -and $ok

$pass = (Test-Url "/query" 401 "GET /query no key -> 401") -and $pass
$pass = (Test-Url "/ifess" 401 "GET /ifess no key -> 401") -and $pass

Write-Host ""
if ($pass) { Write-Host "ALL TESTS PASSED" -ForegroundColor Green }
else { Write-Host "SOME TESTS FAILED" -ForegroundColor Red }

if (!$proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
exit [int](-not $pass)
