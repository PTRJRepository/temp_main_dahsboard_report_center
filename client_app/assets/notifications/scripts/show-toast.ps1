# ============================================================================
# INDEX TOAST-PS1 — tampilkan Windows Toast dari file XML.
#
# Dipanggil oleh src/notifications/toast-notifier.js (INDEX NOTIF):
#   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass `
#     -File show-toast.ps1 -XmlFile <path-xml> -AppId <AUMID>
#
# Catatan desain:
#   - Sengaja memakai Windows PowerShell 5.1 bawaan Windows 10/11 (bukan
#     pwsh): sintaks ', ContentType = WindowsRuntime' hanya berlaku di sana.
#   - XML dibaca dari FILE (bukan argumen/stdin) agar bebas masalah quoting.
#   - Exit code != 0 atau exception -> ditangani JS sebagai sinyal untuk
#     fallback balloon tip (INDEX BALLOON-PS1).
# ============================================================================

param(
    [Parameter(Mandatory = $true)][string] $XmlFile,
    [Parameter(Mandatory = $true)][string] $AppId
)

$ErrorActionPreference = 'Stop'

$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]

$xmlDocument = New-Object Windows.Data.Xml.Dom.XmlDocument
$xmlDocument.LoadXml((Get-Content -Raw -LiteralPath $XmlFile))

$toast = New-Object Windows.UI.Notifications.ToastNotification($xmlDocument)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId).Show($toast)

exit 0
