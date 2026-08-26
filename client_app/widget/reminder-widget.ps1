# ============================================================================
# INDEX REMWIDGET — Widget Pengingat Terpin (pinned) untuk Kerani.
#
# Jendela kecil ALWAYS-ON-TOP dua mode:
#   COLLAPSED : pil bulat 56x56 (logo + badge jumlah belum dibaca)
#   EXPANDED  : panel ~400px berisi kartu-kartu reminder/notifikasi,
#               tombol hapus per kartu (x) dan "Bersihkan semua".
#
# Sumber data (INDEX REMDATA):
#   <DataDir>\inbox.jsonl      -> ditulis APPEND oleh client
#                                 (src/modules/push-notification.js, INDEX PUSHMOD);
#                                 widget hanya MEMBACA dengan byte-offset.
#   <DataDir>\inbox-state.json -> dimiliki PENUH oleh widget (posisi jendela,
#                                 offset baca, daftar kartu + flag read).
# Pola single-writer per file => tidak ada konflik tulis client vs widget.
#
# Jalankan manual:
#   powershell.exe -NoProfile -ExecutionPolicy Bypass `
#     -File widget\reminder-widget.ps1 [-DataDir data\notifications]
# Auto-launch dilakukan PushNotificationModule saat autoLaunchWidget=true.
# Instance ganda dicegah mutex Global\IFESS_ReminderWidget.
#
# Tekan: klik pil = memperbesar | tombol - atau Esc = kecilkan lagi |
#        seret header = pindahkan (posisi diingat) | x pada kartu = hapus.
# ============================================================================

param(
    [string] $DataDir = (Join-Path $PSScriptRoot '..\data\notifications'),
    [string] $AssetsDir = (Join-Path $PSScriptRoot '..\assets\notifications')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

# ── Single instance ──────────────────────────────────────────────────────────
$mutexCreated = $false
$script:SingleInstance = New-Object System.Threading.Mutex($true, 'Global\IFESS_ReminderWidget', [ref]$mutexCreated)
if (-not $mutexCreated) { exit 0 }

# ── Palet korporat perkebunan (samakan dgn generate-branding.ps1) ───────────
$COL_DARK   = '#123524'  # hijau tua
$COL_MID    = '#2D6A4F'
$COL_GOLD   = '#D4A017'
$COL_PANEL  = '#F7F4EC'  # krem
$COL_CARD   = '#FFFFFF'
$COL_LINE   = '#E4E0D5'
$COL_TEXT   = '#1E2B24'
$COL_MUTED  = '#6B7A70'

$PRIORITY_COLOR = @{ critical = '#B23A2E'; high = '#D4820A'; normal = '#2D6A4F'; low = '#8AA096' }
$CATEGORY_CHIP = @{
    announcement = @('#F1E3C0', '#7A5A08'); update = @('#DDEBE0', '#1F5B38')
    instruction  = @('#DCE9EE', '#20596B'); alert = @('#F4DCD7', '#8E2B1F')
    maintenance  = @('#F0E4D6', '#7A4A12'); reminder = @('#E6E1F0', '#4A3D77')
}

$STATE_PATH = Join-Path $DataDir 'inbox-state.json'
$INBOX_PATH = Join-Path $DataDir 'inbox.jsonl'
$LOGO_PATH  = Join-Path $AssetsDir 'logo.png'

# ── State (dimiliki widget) ─────────────────────────────────────────────────
function Load-State {
    $state = @{ offset = [long]0; left = [double]::NaN; top = [double]::NaN; items = @() }
    try {
        if (Test-Path -LiteralPath $STATE_PATH) {
            $saved = ConvertFrom-Json (Get-Content -LiteralPath $STATE_PATH -Raw -Encoding UTF8)
            if ($null -ne $saved.offset) { $state.offset = [long]$saved.offset }
            if ($null -ne $saved.left)   { $state.left   = [double]$saved.left }
            if ($null -ne $saved.top)    { $state.top    = [double]$saved.top }
            if ($null -ne $saved.items)  { $state.items  = @($saved.items) }
        }
    } catch { $state = @{ offset = [long]0; left = [double]::NaN; top = [double]::NaN; items = @() } }
    return $state
}

function Save-State {
    try {
        if (-not (Test-Path -LiteralPath $DataDir)) {
            New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
        }
        $payload = @{
            offset = $script:State.offset
            left   = $script:State.left
            top    = $script:State.top
            items  = $script:State.items
        }
        $tmp = "$STATE_PATH.tmp"
        [IO.File]::WriteAllText($tmp, (ConvertTo-Json $payload -Depth 6), (New-Object Text.UTF8Encoding($false)))
        Move-Item -Force -Path $tmp -Destination $STATE_PATH
    } catch { Write-Host "widget: gagal simpan state: $($_.Exception.Message)" }
}

$script:State = Load-State

# ── XAML dua-mode ───────────────────────────────────────────────────────────
$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="IFESS Pengingat Kerani" Width="56" Height="56"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ShowActivated="False"
        ResizeMode="NoResize" FontFamily="Segoe UI" TextOptions.TextRenderingMode="ClearType">
  <Grid x:Name="Root">

    <!-- ══ MODE PIL (collapsed) ══ -->
    <Grid x:Name="PillView" Width="56" Height="56" Cursor="Hand">
      <Ellipse Fill="#14301F" Stroke="#D4A017" StrokeThickness="2"/>
      <Image x:Name="LogoImage" Width="32" Height="32" Stretch="Uniform"/>
      <Grid HorizontalAlignment="Right" VerticalAlignment="Top" Margin="0,-2,-4,-2"
            x:Name="BadgeHost" Visibility="Collapsed">
        <Ellipse Width="21" Height="21" Fill="#D4A017" Stroke="#123524" StrokeThickness="2"/>
        <TextBlock x:Name="BadgeText" Text="0" FontSize="11" FontWeight="Bold"
                   Foreground="#123524" HorizontalAlignment="Center" VerticalAlignment="Center"/>
      </Grid>
      <ToolTipService.ToolTip>
        <ToolTip Content="Pengingat IFESS - klik untuk membuka"/>
      </ToolTipService.ToolTip>
    </Grid>

    <!-- ══ MODE PANEL (expanded) ══ -->
    <Border x:Name="PanelView" Visibility="Collapsed" Background="#F7F4EC"
            BorderBrush="#D4A017" BorderThickness="1" CornerRadius="16">
      <Grid>
        <Grid.RowDefinitions>
          <RowDefinition Height="58"/>
          <RowDefinition Height="*"/>
        </Grid.RowDefinitions>

        <Border x:Name="HeaderBorder" Grid.Row="0" Background="#123524" CornerRadius="15,15,0,0">
          <Grid Margin="16,0,10,0">
            <StackPanel VerticalAlignment="Center">
              <TextBlock Text="PENGINGAT KERANI" Foreground="#F8F5EC" FontWeight="Bold"
                         FontSize="13" LetterSpacing="0.5"/>
              <TextBlock x:Name="HeaderText" Text="0 pengingat aktif" Foreground="#D4A017" FontSize="10.5"/>
            </StackPanel>
            <StackPanel Orientation="Horizontal" HorizontalAlignment="Right" VerticalAlignment="Center">
              <Button x:Name="ClearAllBtn" Content="Bersihkan semua" Cursor="Hand"
                      Background="Transparent" Foreground="#D4A017" BorderThickness="0"
                      FontSize="11" Padding="6,4" Margin="0,0,4,0"/>
              <Button x:Name="CollapseBtn" Content="-" Cursor="Hand" FontSize="16" FontWeight="Bold"
                      Width="30" Height="30" Background="#1E4632" Foreground="#F8F5EC"
                      BorderThickness="0"/>
            </StackPanel>
          </Grid>
        </Border>

        <Grid Grid.Row="1" Margin="10">
          <ScrollViewer VerticalScrollBarVisibility="Auto">
            <StackPanel x:Name="CardList"/>
          </ScrollViewer>
          <TextBlock x:Name="EmptyText" Text="Belum ada pemberitahuan.&#x0a;Notifikasi dari server akan tampil di sini."
                     Foreground="#6B7A70" FontSize="12" TextAlignment="Center"
                     HorizontalAlignment="Center" VerticalAlignment="Center" TextWrapping="Wrap"
                     Width="260" Visibility="Collapsed"/>
        </Grid>
      </Grid>
    </Border>
  </Grid>
</Window>
'@

# LetterSpacing bukan properti WPF standar -> buang bila parser komplain.
try {
    $window = [Windows.Markup.XamlReader]::Parse($xaml)
} catch {
    $xaml = $xaml -replace '\sLetterSpacing="[^"]*"',''
    $window = [Windows.Markup.XamlReader]::Parse($xaml)
}

$pillView   = $window.FindName('PillView')
$panelView  = $window.FindName('PanelView')
$badgeHost  = $window.FindName('BadgeHost')
$badgeText  = $window.FindName('BadgeText')
$headerText = $window.FindName('HeaderText')
$cardList   = $window.FindName('CardList')
$emptyText  = $window.FindName('EmptyText')
$clearBtn   = $window.FindName('ClearAllBtn')
$collapseBtn= $window.FindName('CollapseBtn')
$logoImage  = $window.FindName('LogoImage')

# Logo pil dari aset branding proyek.
try {
    if (Test-Path -LiteralPath $LOGO_PATH) {
        $bitmap = New-Object System.Windows.Media.Imaging.BitmapImage
        $bitmap.BeginInit()
        $bitmap.CacheOption = 'OnLoad'
        $bitmap.UriSource = New-Object Uri(($LOGO_PATH -replace '\\','/'), [UriKind]::Absolute)
        $bitmap.EndInit()
        $bitmap.Freeze()
        $logoImage.Source = $bitmap
    }
} catch { Write-Host "widget: logo gagal dimuat: $($_.Exception.Message)" }

# ── Geometri: jangkar kanan-bawah agar membesar/mengecil tetap rapi ─────────
function Get-WorkArea { return [System.Windows.SystemParameters]::WorkArea }

function Set-AnchoredSize([double] $width, [double] $height) {
    $workArea = Get-WorkArea
    $right  = $window.Left + $window.Width
    $bottom = $window.Top + $window.Height
    if ([double]::IsNaN($right))  { $right  = $workArea.Right - 18 }
    if ([double]::IsNaN($bottom)) { $bottom = $workArea.Bottom - 18 }
    $window.Width  = $width
    $window.Height = $height
    $window.Left = [Math]::Max($workArea.Left,  $right  - $width)
    $window.Top  = [Math]::Max($workArea.Top,   $bottom - $height)
}

function Set-Mode([bool] $expanded) {
    $script:IsExpanded = $expanded
    if ($expanded) {
        $workArea = Get-WorkArea
        $targetHeight = [Math]::Min(560.0, $workArea.Height - 60)
        Set-AnchoredSize 400 $targetHeight
        $pillView.Visibility  = 'Collapsed'
        $panelView.Visibility = 'Visible'
        foreach ($item in $script:State.items) { $item.read = $true }
        Save-State
        Update-Badge
        Render-Cards
    } else {
        Set-AnchoredSize 56 56
        $panelView.Visibility = 'Collapsed'
        $pillView.Visibility  = 'Visible'
    }
}

function Update-Badge {
    $unread = @($script:State.items | Where-Object { -not $_.read }).Count
    if ($unread -gt 0) {
        $badgeText.Text = [string]$unread
        $badgeHost.Visibility = 'Visible'
    } else {
        $badgeHost.Visibility = 'Collapsed'
    }
    $total = $script:State.items.Count
    $headerText.Text = "$(if ($total -eq 0) { 'tidak ada pengingat aktif' } elseif ($total -eq 1) { '1 pengingat aktif' } else { "$total pengingat aktif" })"
    $emptyText.Visibility = $(if ($total -eq 0) { 'Visible' } else { 'Collapsed' })
}

# ── Kartu reminder ───────────────────────────────────────────────────────────
function Format-RelativeTime([datetime] $timestamp) {
    $elapsed = (Get-Date) - $timestamp
    if ($elapsed.TotalMinutes -lt 1)  { return 'baru saja' }
    if ($elapsed.TotalMinutes -lt 60) { return "$([int]$elapsed.TotalMinutes) mnt lalu" }
    if ($elapsed.TotalHours   -lt 24) { return "$([int]$elapsed.TotalHours) jam lalu" }
    return $timestamp.ToString('dd MMM HH:mm')
}

function New-Card([object] $item) {
    $priority = [string]$item.priority
    if (-not $PRIORITY_COLOR.ContainsKey($priority)) { $priority = 'normal' }
    $category = [string]$item.category
    if (-not $CATEGORY_CHIP.ContainsKey($category)) { $category = 'announcement' }
    $chipColors = $CATEGORY_CHIP[$category]

    $card = New-Object Windows.Controls.Border
    $card.CornerRadius = New-Object Windows.CornerRadius 12
    $card.Background = [Windows.Media.Brushes]::White
    $card.BorderBrush = [Windows.Media.BrushConverter]::new().ConvertFromString($COL_LINE)
    $card.BorderThickness = New-Object Windows.Thickness 1
    $card.Margin = New-Object Windows.Thickness 0,0,0,10

    $grid = New-Object Windows.Controls.Grid
    $grid.Margin = New-Object Windows.Thickness 0

    # Stripe prioritas di tepi kiri kartu (Rectangle butuh PresentationCore,
    # yang sudah dimuat via Add-Type di atas).
    $stripe = New-Object Windows.Shapes.Rectangle
    $stripe.Width = 6
    $stripe.RadiusX = 3; $stripe.RadiusY = 3
    $stripe.Fill = [Windows.Media.BrushConverter]::new().ConvertFromString($PRIORITY_COLOR[$priority])
    $stripe.VerticalAlignment = 'Stretch'
    $stripe.HorizontalAlignment = 'Left'
    $stripe.Margin = New-Object Windows.Thickness 8,10,0,10

    $stack = New-Object Windows.Controls.StackPanel
    $stack.Margin = New-Object Windows.Thickness 22,10,10,10

    # Baris 1: chip kategori + waktu.
    $rowMeta = New-Object Windows.Controls.StackPanel
    $rowMeta.Orientation = 'Horizontal'
    $chip = New-Object Windows.Controls.Border
    $chip.CornerRadius = New-Object Windows.CornerRadius 8
    $chip.Background = [Windows.Media.BrushConverter]::new().ConvertFromString($chipColors[0])
    $chip.Padding = New-Object Windows.Thickness 8,2,8,3
    $chip.VerticalAlignment = 'Center'
    $chipText = New-Object Windows.Controls.TextBlock
    $chipText.Text = $category.ToUpperInvariant()
    $chipText.FontSize = 9.5
    $chipText.FontWeight = 'SemiBold'
    $chipText.Foreground = [Windows.Media.BrushConverter]::new().ConvertFromString($chipColors[1])
    $chip.Child = $chipText
    $null = $rowMeta.Children.Add($chip)
    $timeText = New-Object Windows.Controls.TextBlock
    $timeText.Text = "   $(Format-RelativeTime ([datetime]$item.at))"
    $timeText.FontSize = 10
    $timeText.Foreground = [Windows.Media.BrushConverter]::new().ConvertFromString($COL_MUTED)
    $timeText.VerticalAlignment = 'Center'
    $null = $rowMeta.Children.Add($timeText)
    $null = $stack.Children.Add($rowMeta)

    # Baris 2: judul.
    $title = New-Object Windows.Controls.TextBlock
    $title.Text = [string]$item.title
    $title.FontSize = 14
    $title.FontWeight = 'Bold'
    $title.Foreground = [Windows.Media.BrushConverter]::new().ConvertFromString($COL_TEXT)
    $title.TextWrapping = 'Wrap'
    $title.Margin = New-Object Windows.Thickness 0,6,0,0
    $null = $stack.Children.Add($title)

    # Baris 3: isi pesan.
    $message = New-Object Windows.Controls.TextBlock
    $message.Text = [string]$item.message
    $message.FontSize = 12
    $message.Foreground = [Windows.Media.BrushConverter]::new().ConvertFromString('#3D4A42')
    $message.TextWrapping = 'Wrap'
    $message.Margin = New-Object Windows.Thickness 0,3,0,0
    $null = $stack.Children.Add($message)

    if ($item.details) {
        $details = New-Object Windows.Controls.TextBlock
        $details.Text = [string]$item.details
        $details.FontSize = 11
        $details.Foreground = [Windows.Media.BrushConverter]::new().ConvertFromString($COL_MUTED)
        $details.TextWrapping = 'Wrap'
        $details.Margin = New-Object Windows.Thickness 0,2,0,0
        $null = $stack.Children.Add($details)
    }

    # Baris 4: footer + tombol hapus.
    $rowFoot = New-Object Windows.Controls.DockPanel
    $deleteBtn = New-Object Windows.Controls.Button
    $deleteBtn.Content = 'Hapus'
    $deleteBtn.Cursor = 'Hand'
    $deleteBtn.FontSize = 10.5
    $deleteBtn.Padding = New-Object Windows.Thickness 10,2,10,3
    $deleteBtn.Margin = New-Object Windows.Thickness 0,8,0,0
    $deleteBtn.HorizontalAlignment = 'Right'
    $deleteBtn.Background = [Windows.Media.BrushConverter]::new().ConvertFromString('#F0EBDD')
    $deleteBtn.Foreground = [Windows.Media.BrushConverter]::new().ConvertFromString('#8E2B1F')
    $deleteBtn.BorderThickness = New-Object Windows.Thickness 0
    $itemId = [string]$item.id
    $deleteBtn.Add_Click({
        $script:State.items = @($script:State.items | Where-Object { $_.id -ne $itemId })
        Save-State
        Update-Badge
        Render-Cards
    }.GetNewClosure())
    [Windows.Controls.DockPanel]::SetDock($deleteBtn, 'Right')
    $footText = New-Object Windows.Controls.TextBlock
    $footText.Text = [string]$item.footer
    $footText.FontSize = 10.5
    $footText.FontStyle = 'Italic'
    $footText.Foreground = [Windows.Media.BrushConverter]::new().ConvertFromString($COL_MUTED)
    $footText.VerticalAlignment = 'Bottom'
    $footText.Margin = New-Object Windows.Thickness 0,8,0,0
    $null = $rowFoot.Children.Add($deleteBtn)
    $null = $rowFoot.Children.Add($footText)
    $null = $stack.Children.Add($rowFoot)

    $card.Child = $grid
    $null = $grid.Children.Add($stripe)
    $null = $grid.Children.Add($stack)
    return $card
}

function Render-Cards {
    $cardList.Children.Clear()
    foreach ($item in $script:State.items) {
        $null = $cardList.Children.Add((New-Card $item))
    }
}

# ── Konsumsi inbox.jsonl (client satu-satunya penulis file ini) ─────────────
function Consume-Inbox {
    if (-not (Test-Path -LiteralPath $INBOX_PATH)) { return }
    try {
        $stream = [IO.File]::Open($INBOX_PATH, 'Open', 'Read', 'ReadWrite')
        try {
            if ($stream.Length -le $script:State.offset) { return }
            $null = $stream.Seek($script:State.offset, 'Begin')
            $reader = New-Object IO.StreamReader($stream, (New-Object Text.UTF8Encoding($false)), $true)
            $fresh = @()
            while ($null -ne ($line = $reader.ReadLine())) {
                $trimmed = $line.Trim()
                if ($trimmed -eq '') { continue }
                try {
                    $entry = ConvertFrom-Json $trimmed
                    if ($entry.id -and $entry.title) {
                        $known = $script:State.items | Where-Object { $_.id -eq [string]$entry.id }
                        if (-not $known) {
                            $fresh += @{
                                id = [string]$entry.id
                                at = [string]$entry.at
                                category = [string]$entry.category
                                priority = [string]$entry.priority
                                title = [string]$entry.title
                                message = [string]$entry.message
                                details = [string]$entry.details
                                footer = [string]$entry.footer
                                read = $false
                            }
                        }
                    }
                } catch { continue }   # baris korup: lewati, jangan matikan widget
            }
            $script:State.offset = $stream.Position
            if ($fresh.Count -gt 0) {
                # Terbaru di atas.
                [array]::Reverse($fresh)
                $script:State.items = @($fresh) + @($script:State.items)
                Save-State
                Update-Badge
                if ($script:IsExpanded) { Render-Cards }
            }
        } finally { $stream.Dispose() }
    } catch { Write-Host "widget: baca inbox gagal: $($_.Exception.Message)" }
}

# ── Interaksi ────────────────────────────────────────────────────────────────
$script:IsExpanded = $false

$pillView.Add_MouseLeftButtonUp({ Set-Mode $true })
# Klik kanan pada pil = keluar dari widget.
$pillView.Add_MouseRightButtonUp({ $window.Close() })
$collapseBtn.Add_Click({ Set-Mode $false })
$window.Add_PreviewKeyDown({
    param($sender, $eventArgs)
    if ($eventArgs.Key -eq 'Escape' -and $script:IsExpanded) { Set-Mode $false }
})
$clearBtn.Add_Click({
    $script:State.items = @()
    Save-State
    Update-Badge
    Render-Cards
})

function Header_Drag([object]$sender, [Windows.Input.MouseButtonEventArgs]$eventArgs) {
    if ($eventArgs.ButtonState -eq 'MouseLeftButtonState') {
        $window.DragMove()
        $script:State.left = $window.Left
        $script:State.top = $window.Top
        Save-State
    }
}
# Handler drag dipasang manual (XamlReader.Parse tidak mendukung event XAML).
$headerBorder = $window.FindName('HeaderBorder')
$headerBorder.Add_MouseLeftButtonDown({ param($s, $e) Header_Drag $s $e })

# ── Posisi awal (ingat posisi terakhir; default kanan-bawah) ────────────────
$workArea = Get-WorkArea
if (-not [double]::IsNaN($script:State.left) -and -not [double]::IsNaN($script:State.top)) {
    $window.Left = [Math]::Min([Math]::Max($script:State.left, $workArea.Left),  $workArea.Right  - 60)
    $window.Top  = [Math]::Min([Math]::Max($script:State.top,  $workArea.Top),   $workArea.Bottom - 60)
} else {
    $window.Left = $workArea.Right - 76
    $window.Top  = $workArea.Bottom - 90
}
$window.Left = [math]::Floor($window.Left)
$window.Top  = [math]::Floor($window.Top)

Consume-Inbox
Update-Badge
$null = $window.Show()

# ── Loop penyegaran (tanpa busy-wait CPU tinggi: dispatcher timer) ──────────
$timer = New-Object Windows.Threading.DispatcherTimer
$timer.Interval = New-Object TimeSpan(0, 0, 0, 1, 500)
$timer.Add_Tick({ Consume-Inbox })
$timer.Start()

$window.Add_Closing({
    try {
        $script:State.left = $window.Left
        $script:State.top = $window.Top
        Save-State
        $timer.Stop()
    } catch { }
})

# Pompa pesan WPF: blokir di sini sampai jendela ditutup (klik kanan pil / Alt+F4).
$null = [System.Windows.Threading.Dispatcher]::RunDispatcher
$null = $window.Dispatcher.Invoke([action]{}, [Windows.Threading.DispatcherPriority]::Background)
[System.Windows.Threading.Dispatcher]::Run()
