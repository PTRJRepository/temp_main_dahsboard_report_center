<#
.SYNOPSIS
  Central launcher for all Module Services (dev or prod mode) + optional Dashboard portal.

.DESCRIPTION
  Starts every runnable module service from one command, skipping anything whose port is
  already occupied. In prod mode it builds first when the build artifact is missing
  (or when -Rebuild is given). Logs go to logs/modules/, started PIDs are tracked in
  logs/modules/module-pids.json so -Stop can stop exactly what this script started.

.USAGE
  powershell -ExecutionPolicy Bypass -File scripts/start-module-services.ps1                # prod, all modules
  powershell -ExecutionPolicy Bypass -File scripts/start-module-services.ps1 -Mode dev      # dev, all modules
  powershell -ExecutionPolicy Bypass -File scripts/start-module-services.ps1 -Only rebinmas-jaya-server,rjfm
  powershell -ExecutionPolicy Bypass -File scripts/start-module-services.ps1 -IncludeDashboard   # also portal :3100
  powershell -ExecutionPolicy Bypass -File scripts/start-module-services.ps1 -Status
  powershell -ExecutionPolicy Bypass -File scripts/start-module-services.ps1 -Stop          # never touches gateway :3001
#>
param(
  [ValidateSet('dev', 'prod')][string]$Mode = 'prod',
  [switch]$Stop,
  [switch]$Status,
  [switch]$Rebuild,
  [switch]$IncludeDashboard,
  [string]$Only = ''
)

$ErrorActionPreference = 'Stop'
$ROOT = Split-Path -Parent $PSScriptRoot
$LOGDIR = Join-Path $ROOT 'logs\modules'
New-Item -ItemType Directory -Force -Path $LOGDIR | Out-Null
$PIDFILE = Join-Path $LOGDIR 'module-pids.json'

# --- resolve runners ---------------------------------------------------------
function Resolve-Exe([string]$name, [string]$fallback) {
  # paksa .exe agar tidak dapat shim non-Win32 (bun shims tanpa ekstensi)
  foreach ($candidate in @("$name.exe", $name)) {
    $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source.EndsWith('.exe')) { return $cmd.Source }
  }
  if ($fallback -and (Test-Path $fallback)) { return $fallback }
  return $null
}
$BUN = Resolve-Exe 'bun' "$env:USERPROFILE\.bun\bin\bun.exe"
if (-not $BUN) { throw 'bun tidak ditemukan di PATH maupun ~/.bun/bin/bun.exe' }
function Resolve-Node {
  $n = Resolve-Exe 'node' ''
  if (-not $n) { throw 'node tidak ditemukan di PATH (dibutuhkan untuk dashboard portal)' }
  return $n
}

# --- registry ----------------------------------------------------------------
# Port WAJIB sama dengan target di routes-config.json.
$MODULES = @(
  @{ Name = 'report-center';        Dir = 'Module Services/report-center';        Port = 3101;
    Runner = $BUN; Dev = @('run','dev'); Prod = @('run','start');
    Build = @('run','build');        Marker = '.next/BUILD_ID' },
  @{ Name = 'rebinmas-jaya-server'; Dir = 'Module Services/rebinmas-jaya-server'; Port = 3102;
    Runner = $BUN; Dev = @('run','dev'); Prod = @('run','start');
    Build = @('run','build');        Marker = 'dist/index.html';
    Env = @{ PORT = '3102' } },
  @{ Name = 'rjfm';                 Dir = 'Module Services/rjfm';                 Port = 8011;
    Runner = $BUN; Dev = @('run','dev'); Prod = @('run','start');
    Env = @{ RJFM_STORAGE_PATH = 'D:/RJFM_Storage/uploads' } },
  @{ Name = 'sql-gateway';          Dir = 'Module Services/sql-gateway';          Port = 8001;
    Runner = $BUN; Dev = @('run','dev'); Prod = @('run','start'); },
  @{ Name = 'daftar-upah';          Dir = 'Module Services/daftar-upah';          Port = 3104;
    Runner = $BUN; Dev = @('run','dev'); Prod = @('run','start');
    Build = @('run','build:frontend'); Marker = 'frontend/dist/index.html';
    Env = @{ PORT = '3104' } },   # default internal 8002, tapi gateway route menunjuk 3104
  @{ Name = 'ifess-server';         Dir = 'Module Services/ifess-server';         Port = 8003;
    Runner = $BUN; Dev = @('run','dev'); Prod = @('run','start');
    Env = @{ IFESS_PORT = '8003' } }   # legacy ControlServer port; routes ifess-control/api-ifess/api-clients → 127.0.0.1:8003
)
if ($IncludeDashboard) {
  $MODULES += @{ Name = 'dashboard-portal'; Dir = 'Dashboard_Utama'; Port = 3100;
    RunnerName = 'node'; Dev = $null; Prod = @('.next/standalone/Dashboard_Utama/server.js');
    Marker = '.next/standalone/Dashboard_Utama/server.js';
    Env = @{ PORT = '3100'; HOSTNAME = '0.0.0.0'; NODE_ENV = 'production' };
    PreStart = 'sync-static';
    NoDev = $true }
}

if ($Only -ne '') {
  $wanted = $Only.Split(',') | ForEach-Object { $_.Trim().ToLower() }
  $MODULES = @($MODULES | Where-Object { $wanted -contains $_.Name.ToLower() })
}

# --- helpers -----------------------------------------------------------------
function Test-PortListening([int]$p) {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue)
}

function Get-PortOwnerPid([int]$p) {
  $c = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($c) { return $c.OwningProcess }
  return $null
}

function Read-PidStore {
  if (Test-Path $PIDFILE) {
    try {
      $raw = Get-Content $PIDFILE -Raw | ConvertFrom-Json
      # hanya ambil entri valid (punya pid numerik) — buang sampah serialisasi lama
      $clean = [pscustomobject]@{}
      foreach ($p in $raw.PSObject.Properties) {
        if ($p.Value -and $p.Value.pid) { $clean | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value }
      }
      return $clean
    } catch { return [pscustomobject]@{} }
  }
  return [pscustomobject]@{}
}

function Write-PidStore($store) {
  # normalisasi ke PSCustomObject murni agar JSON-nya bersih di PS 5.1 maupun 7
  $clean = [pscustomobject]@{}
  foreach ($p in $store.PSObject.Properties) {
    if ($p.Value -and $p.Value.pid) { $clean | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value }
  }
  $clean | ConvertTo-Json -Depth 4 | Set-Content -Path $PIDFILE -Encoding UTF8
}

function Invoke-Build($m) {
  $markerPath = Join-Path (Join-Path $ROOT $m.Dir) ($m.Marker -replace '/', '\')
  if (-not $m.Build) { return }
  if ((Test-Path $markerPath) -and -not $Rebuild) { return }
  $cwd = Join-Path $ROOT $m.Dir
  Write-Host "[build ] $($m.Name) ..." -NoNewline
  Push-Location $cwd
  try {
    & $BUN @($m.Build) 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) { throw "build gagal untuk $($m.Name) (exit $LASTEXITCODE)" }
  } finally { Pop-Location }
  Write-Host "[build ] $($m.Name) OK" -ForegroundColor Green
}

function Sync-DashboardStandalone {
  # `next build` tidak menyalin .next/static ke folder standalone — tanpa ini
  # HTML portal ter-serve tapi CSS/JS-nya 404. Sinkronkan tiap start, dan
  # ulangi penuh saat BUILD_ID berubah (hasil build lama tidak valid).
  $dashRoot = Join-Path $ROOT 'Dashboard_Utama'
  $src = Join-Path $dashRoot '.next\static'
  $dst = Join-Path $dashRoot '.next\standalone\Dashboard_Utama\.next\static'
  $buildIdFile = Join-Path $dashRoot '.next\BUILD_ID'
  if (-not (Test-Path $src)) {
    Write-Host '[warn  ] dashboard-portal: .next\static tidak ada — jalankan build dashboard dulu' -ForegroundColor Yellow
    return
  }
  $buildId = if (Test-Path $buildIdFile) { (Get-Content $buildIdFile -Raw).Trim() } else { '' }
  $stamp = Join-Path $dst '.copied-build-id'
  $stampedId = if (Test-Path $stamp) { (Get-Content $stamp -Raw).Trim() } else { '' }
  if ((Test-Path $dst) -and ($stampedId -eq $buildId)) { return }
  Write-Host "[prep  ] dashboard-portal: salin .next/static -> standalone (BUILD_ID $buildId) ..." -NoNewline
  if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Copy-Item -Path (Join-Path $src '*') -Destination $dst -Recurse -Force
  Set-Content -Path $stamp -Value $buildId -Encoding ASCII
  Write-Host ' OK' -ForegroundColor Green
}

function Start-Service($m) {
  if (Test-PortListening $m.Port) {
    $owner = Get-PortOwnerPid $m.Port
    Write-Host ("[skip  ] {0,-20} port {1} sudah dipakai (PID {2})" -f $m.Name, $m.Port, $owner) -ForegroundColor Yellow
    return
  }
  if ($Mode -eq 'prod') { Invoke-Build $m }

  # hook pra-start khusus service (mis. dashboard: sinkron .next/static standalone)
  if ($m.PreStart -eq 'sync-static') { Sync-DashboardStandalone }

  $args_ = if ($Mode -eq 'dev') { $m.Dev } else { $m.Prod }
  if (-not $args_) { Write-Host "[warn  ] $($m.Name) tidak punya perintah $Mode — dilewati" -ForegroundColor Yellow; return }

  $outLog = Join-Path $LOGDIR "$($m.Name)-$Mode.out.log"
  $errLog = Join-Path $LOGDIR "$($m.Name)-$Mode.err.log"

  # runner: default bun, dashboard pakai node
  if ($m.RunnerName -eq 'node') { $runnerExe = Resolve-Node } else { $runnerExe = $BUN }

  # set env khusus service (child mewarisi), lalu pulihkan setelah start
  $savedEnv = @{}
  if ($m.Env) {
    foreach ($k in $m.Env.Keys) {
      $savedEnv[$k] = [Environment]::GetEnvironmentVariable($k)
      Set-Item -Path "env:$k" -Value ([string]$m.Env[$k])
    }
  }

  Write-Host "[start ] $($m.Name) ($Mode) -> port $($m.Port) ..."
  try {
    # Bungkus lewat cmd /c supaya redirect log dimiliki cmd, bukan PowerShell —
    # Start-Process -RedirectStandardOutput menduplikasi handle stdout induk dan
    # membuat pemanggil `pwsh -File` tidak pernah kembali (pipe tak pernah EOF).
    # Kutip HANYA argumen yang mengandung spasi — memaksa kutip di sekeliling
    # SEMUA argumen membuat `bun run "start"` gagal diam-diam (exit 1 tanpa
    # jejak di log; error cmd-nya hilang ke void karena 2>> ikut tak jalan).
    $argStr = ($args_ | ForEach-Object { if ($_ -match '[ &()^%!"|<>]') { '"' + $_ + '"' } else { $_ } }) -join ' '
    # NB: -ArgumentList HARUS berupa SATU array literal, bukan ('...') — bentuk
    # parenthesized membuat PowerShell mengikat seluruhnya sebagai $arg ke-4
    # TANPA pemisah argumen, sehingga cmd menerima /c sebagai perintah dan
    # string command-nya jadi token liar → "'""' is not recognized" (exit 1
    # diam-diam, tanpa jejak di log).
    # NB: JANGAN beri kutip di sekeliling path runner — `"bun.exe"` yang dikutip
    # membuat cmd gagal diam-diam (exit 1, tanpa jejak di log) SEBELUM redirection
    # dibuka. Runner di-resolve ke nama 8.3 agar bebas spasi tanpa kutip.
    $runnerShort = if ($runnerExe -match ' ') {
      $s = (Get-Item $runnerExe).GetShortPathName(); if ($s) { $s } else { '"' + $runnerExe + '"' }
    } else { $runnerExe }
    $cmdLine = $runnerShort + ' ' + $argStr +
      ' >> "' + $outLog + '" 2>> "' + $errLog + '"'
    $proc = Start-Process -FilePath $env:ComSpec `
      -ArgumentList @('/d', '/s', '/c', $cmdLine) `
      -WorkingDirectory (Join-Path $ROOT $m.Dir) `
      -WindowStyle Hidden -PassThru
  } catch {
    Write-Host ("[fail  ] {0,-20} gagal start: {1}" -f $m.Name, $_.Exception.Message) -ForegroundColor Red
    return
  } finally {
    foreach ($k in $savedEnv.Keys) {
      if ($null -eq $savedEnv[$k]) { Remove-Item "env:$k" -ErrorAction SilentlyContinue }
      else { Set-Item -Path "env:$k" -Value $savedEnv[$k] }
    }
  }

  # tunggu port terbuka (maks 40 detik)
  $ready = $false
  for ($i = 0; $i -lt 80; $i++) {
    Start-Sleep -Milliseconds 500
    if ($proc.HasExited) { break }
    if (Test-PortListening $m.Port) { $ready = $true; break }
  }
  if ($ready) {
    Write-Host ("[ok    ] {0,-20} http://localhost:{1}  (PID {2})" -f $m.Name, $m.Port, $proc.Id) -ForegroundColor Green
  } elseif ($proc.HasExited) {
    Write-Host ("[fail  ] {0,-20} proses keluar (code {1}) — lihat {2}" -f $m.Name, $proc.ExitCode, $errLog) -ForegroundColor Red
    return
  } else {
    Write-Host ("[slow  ] {0,-20} belum listen dalam 40s — cek log {1}" -f $m.Name, $errLog) -ForegroundColor Yellow
  }

  # catat PID PROSES NYA yang memegang port (bukan wrapper cmd — kalau wrapper
  # yang dicatat, stop tidak menyentuh server anak dan start berikutnya bentrok
  # dengan instans lama yang masih hidup → gagal diam-diam dengan exit 1).
  $realPid = Get-PortOwnerPid $m.Port
  if (-not $realPid) { $realPid = $proc.Id }

  $store = Read-PidStore
  $entry = @{ pid = $realPid; port = $m.Port; mode = $Mode; startedAt = (Get-Date -Format o); wrapper = 'cmd' }
  if ($store.PSObject.Properties[$m.Name]) { $store.$($m.Name) = $entry }
  else { $store | Add-Member -NotePropertyName $m.Name -NotePropertyValue $entry }
  Write-PidStore $store
}

function Stop-Services {
  $store = Read-PidStore
  $stopped = @()
  foreach ($prop in $store.PSObject.Properties) {
    $e = $prop.Value
    $proc = Get-Process -Id $e.pid -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $e.pid -Force -ErrorAction SilentlyContinue
      Write-Host ("[stop  ] {0,-20} PID {1} (port {2}) dimatikan" -f $prop.Name, $e.pid, $e.port) -ForegroundColor Cyan
      $stopped += $prop.Name
    }
  }
  # jaring pengaman: apa pun yang masih memegang port registry (kecuali gateway :3001)
  foreach ($m in $MODULES) {
    if (Test-PortListening $m.Port) {
      $owner = Get-PortOwnerPid $m.Port
      if ($owner -and (Get-Process -Id $owner -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
        Write-Host ("[stop  ] {0,-20} pemegang port {1} (PID {2}) dimatikan" -f $m.Name, $m.Port, $owner) -ForegroundColor Cyan
        $stopped += $m.Name
      }
    }
  }
  if ($stopped.Count -eq 0) { Write-Host '[stop  ] tidak ada service yang berjalan' }
  Remove-Item $PIDFILE -ErrorAction SilentlyContinue
}

function Show-Status {
  Write-Host ("`n{0,-22}{1,-7}{2,-10}{3}" -f 'SERVICE', 'PORT', 'STATUS', 'PID') 
  Write-Host ('-' * 60)
  foreach ($m in $MODULES) {
    if (Test-PortListening $m.Port) {
      $owner = Get-PortOwnerPid $m.Port
      Write-Host ("{0,-22}{1,-7}{2,-10}{3}" -f $m.Name, $m.Port, 'RUNNING', $owner) -ForegroundColor Green
    } else {
      Write-Host ("{0,-22}{1,-7}{2,-10}{3}" -f $m.Name, $m.Port, 'DOWN', '-') -ForegroundColor Red
    }
  }
  Write-Host "`nGateway (:3001) & service eksternal tidak dikelola script ini."
}

# --- main --------------------------------------------------------------------
if ($Status)            { Show-Status; exit 0 }
if ($Stop)              { Stop-Services; exit 0 }

Write-Host "=== Module Services — mode $Mode ==="
foreach ($m in $MODULES) { Start-Service $m }
Show-Status
exit 0
