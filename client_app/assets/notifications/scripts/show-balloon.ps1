# ============================================================================
# INDEX BALLOON-PS1 — fallback notifikasi balloon tip (tray) Windows Forms.
#
# Dipanggil oleh src/notifications/toast-notifier.js (INDEX NOTIF) ketika
# Windows Toast gagal (Windows lama / Focus Assist / policy memblokir toast):
#   powershell.exe ... -File show-balloon.ps1 -Title ".." -Message ".."
#                      [-IconType Info|Warning|Error] [-DurationMs 8000]
# ============================================================================

param(
    [Parameter(Mandatory = $true)][string] $Title,
    [Parameter(Mandatory = $true)][string] $Message,
    [ValidateSet('Info', 'Warning', 'Error')][string] $IconType = 'Info',
    [int] $DurationMs = 8000
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
try {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Information
    $notifyIcon.BalloonTipIcon = $IconType
    $notifyIcon.BalloonTipTitle = $Title
    $notifyIcon.BalloonTipText = $Message
    $notifyIcon.Visible = $true
    $notifyIcon.ShowBalloonTip($DurationMs)
    # Proses harus tetap hidup selama balloon tampil, lalu bersihkan tray.
    Start-Sleep -Milliseconds ($DurationMs + 500)
} finally {
    $notifyIcon.Dispose()
}

exit 0
