# ============================================================================
# INDEX BRANDGEN — generator aset branding Push Notification (PNG).
#
# Menggambar logo + banner tema bergaya korporat perkebunan memakai GDI+
# (System.Drawing) bawaan Windows, TANPA dependency eksternal. Dijalankan
# sekali saat setup atau kapan pun ingin mengganti visual:
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass `
#     -File generate-branding.ps1 [-OutDir <folder-tujuan>]
#
# Output (di folder induk scripts/, yaitu assets/notifications):
#   logo.png                    256x256  emblem palem bulat (toast appLogo)
#   banner-default.png          720x360  lanskap palem (fallback hero)
#   banner-harvest.png          720x360  varian panen (theme 'harvest')
#   banner-announcement.png     720x360  gelembung pesan emas
#   banner-update.png           720x360  panah melingkar pembaruan
#   banner-maintenance.png      720x360  roda gigi perawatan
#   banner-alert.png            720x360  segitiga peringatan
#
# Palet korporat: hijau tua #1B4332 / #123524, hijau medium #2D6A4F,
# emas #D4A017, krem #F8F5EC.
# ============================================================================

param(
    [string] $OutDir = (Join-Path $PSScriptRoot '..')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$deepGreen  = [System.Drawing.Color]::FromArgb(255, 0x12, 0x35, 0x24)
$midGreen   = [System.Drawing.Color]::FromArgb(255, 0x2D, 0x6A, 0x4F)
$gold       = [System.Drawing.Color]::FromArgb(255, 0xD4, 0xA0, 0x17)
$cream      = [System.Drawing.Color]::FromArgb(255, 0xF8, 0xF5, 0xEC)

function New-Color([int] $a, [System.Drawing.Color] $base) {
    return [System.Drawing.Color]::FromArgb($a, $base.R, $base.G, $base.B)
}

function New-Solid([System.Drawing.Color] $c) {
    return New-Object System.Drawing.SolidBrush($c)
}

function Add-VignetteBackground {
    param($graphics, [int] $w, [int] $h)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect, $midGreen, $deepGreen, 90.0)
    $graphics.FillRectangle($gradient, $rect)
    # Lingkaran emas transparan besar -> kesan premium berlapis.
    foreach ($layer in @(@(34, 620, -60), @(22, 700, -140))) {
        $halo = New-Solid (New-Color $layer[0] $gold)
        $graphics.FillEllipse($halo, ($w - $layer[1]) , $layer[2], ($layer[1] * 2), ($layer[1] * 2))
        $halo.Dispose()
    }
}

function Add-LeftPanel {
    param($graphics, [int] $h)
    $panel = New-Solid ([System.Drawing.Color]::FromArgb(150, 0x0B, 0x27, 0x19))
    $graphics.FillRectangle($panel, 0, 0, 300, $h)
    $panel.Dispose()
    $accentPen = New-Object System.Drawing.Pen((New-Color 200 $gold), 4)
    $graphics.DrawLine($accentPen, 303, 0, 303, $h)
    $accentPen.Dispose()
}

function Add-PalmTree {
    # Palem stilis: batang meruncing + mahkota 7 daun elips + tiga kelapa emas.
    param($graphics, [single] $cx, [single] $cy, [single] $s,
          [System.Drawing.Color] $trunk, [System.Drawing.Color] $frond)
    $state = $graphics.Save()
    $graphics.TranslateTransform($cx, $cy)

    $trunkPoints = [System.Drawing.PointF[]] @(
        (New-Object System.Drawing.PointF((-7 * $s), 0)),
        (New-Object System.Drawing.PointF((7 * $s), 0)),
        (New-Object System.Drawing.PointF((2 * $s), (-78 * $s))),
        (New-Object System.Drawing.PointF((-2 * $s), (-78 * $s)))
    )
    $trunkBrush = New-Solid $trunk
    $graphics.FillPolygon($trunkBrush, $trunkPoints)
    $trunkBrush.Dispose()

    $crownY = -82 * $s
    for ($i = 0; $i -lt 7; $i++) {
        $angle = -170 + ($i * 56)   # sebar daun 0..340 derajat
        $graphics.ResetTransform()
        $graphics.TranslateTransform($cx, $cy)
        $graphics.TranslateTransform(0, $crownY)
        $graphics.RotateTransform($angle)
        $frondBrush = New-Solid $frond
        $leafRect = New-Object System.Drawing.RectangleF((28 * $s), (-11 * $s), (62 * $s), (22 * $s))
        $graphics.FillEllipse($frondBrush, $leafRect)
        $frondBrush.Dispose()
    }
    $graphics.ResetTransform()
    $graphics.TranslateTransform($cx, $cy)

    $nutBrush = New-Solid (New-Color 235 $gold)
    foreach ($offset in @(@(-10, -84), @(10, -86), @(0, -74))) {
        $nut = New-Object System.Drawing.RectangleF(
            (($offset[0] - 6) * $s), (($offset[1]) * $s), (12 * $s), (12 * $s))
        $graphics.FillEllipse($nutBrush, $nut)
    }
    $nutBrush.Dispose()
    $graphics.Restore($state)
}

function Add-RoundedRectPath {
    param([single] $x, [single] $y, [single] $w, [single] $h, [single] $r)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $r, $r, 180, 90)
    $path.AddArc(($x + $w - $r), $y, $r, $r, 270, 90)
    $path.AddArc(($x + $w - $r), ($y + $h - $r), $r, $r, 0, 90)
    $path.AddArc($x, ($y + $h - $r), $r, $r, 90, 90)
    $path.CloseFigure()
    return $path
}

function ConvertTo-PngFile {
    param($bitmap, [string] $path)
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host ("  dibuat: {0}" -f $path)
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# ---------------------------------------------------------------------------
# 1. logo.png — emblem bulat untuk appLogoOverride toast.
# ---------------------------------------------------------------------------
$logobmp = New-Object System.Drawing.Bitmap(256, 256)
$logoG = [System.Drawing.Graphics]::FromImage($logobmp)
$logoG.SmoothingMode = 'AntiAlias'
$bgCircle = New-Solid $deepGreen
$logoG.FillEllipse($bgCircle, 4, 4, 248, 248)
$bgCircle.Dispose()
$ringPen = New-Object System.Drawing.Pen($gold, 9)
$logoG.DrawEllipse($ringPen, 16, 16, 224, 224)
$ringPen.Dispose()
Add-PalmTree $logoG 128 208 1.15 $cream $gold
$logoG.Dispose()
ConvertTo-PngFile $logobmp (Join-Path $OutDir 'logo.png')

# ---------------------------------------------------------------------------
# 2-7. Banner tema 720x360.
# ---------------------------------------------------------------------------
function New-BannerCanvas {
    $bmp = New-Object System.Drawing.Bitmap(720, 360)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    Add-VignetteBackground $g 720 360
    return @{ Bitmap = $bmp; Graphics = $g }
}

# --- default & harvest: lanskap palem di sisi kanan ---
foreach ($variant in @(@('banner-default.png', 0), @('banner-harvest.png', 1))) {
    $ctx = New-BannerCanvas
    Add-LeftPanel $ctx.Graphics 360
    $tint = if ($variant[1] -eq 1) { $gold } else { $cream }
    Add-PalmTree $ctx.Graphics 520 330 1.9 (New-Color 215 $tint) (New-Color 190 $midGreen)
    Add-PalmTree $ctx.Graphics 640 340 1.4 (New-Color 170 $tint) (New-Color 150 $midGreen)
    $ground = New-Solid ([System.Drawing.Color]::FromArgb(120, 0x0B, 0x27, 0x19))
    $ctx.Graphics.FillRectangle($ground, 300, 318, 420, 42)
    $ground.Dispose()
    $ctx.Graphics.Dispose(); ConvertTo-PngFile $ctx.Bitmap (Join-Path $OutDir $variant[0])
}

# --- announcement: gelembung pesan ---
$ctx = New-BannerCanvas
Add-LeftPanel $ctx.Graphics 360
$bubblePath = Add-RoundedRectPath 400 96 240 132 26
$bubbleBrush = New-Solid (New-Color 225 $cream)
$ctx.Graphics.FillPath($bubbleBrush, $bubblePath)
$bubbleBrush.Dispose(); $bubblePath.Dispose()
$tail = [System.Drawing.PointF[]] @(
    (New-Object System.Drawing.PointF(450, 222)),
    (New-Object System.Drawing.PointF(492, 222)),
    (New-Object System.Drawing.PointF(452, 258))
)
$tailBrush = New-Solid (New-Color 225 $cream)
$ctx.Graphics.FillPolygon($tailBrush, $tail)
$tailBrush.Dispose()
for ($line = 0; $line -lt 3; $line++) {
    $barPen = New-Object System.Drawing.Pen($midGreen, 13)
    $barPen.StartCap = 'Round'; $barPen.EndCap = 'Round'
    $widthEnd = 590
    if ($line -eq 2) { $widthEnd = 545 }
    $ctx.Graphics.DrawLine($barPen, 436, (136 + $line * 34), $widthEnd, (136 + $line * 34))
    $barPen.Dispose()
}
$ctx.Graphics.Dispose(); ConvertTo-PngFile $ctx.Bitmap (Join-Path $OutDir 'banner-announcement.png')

# --- update: dua panah melingkar ---
$ctx = New-BannerCanvas
Add-LeftPanel $ctx.Graphics 360
$arcPen = New-Object System.Drawing.Pen((New-Color 235 $gold), 17)
foreach ($range in @(@(15, 165), @(195, 165))) {
    $ctx.Graphics.DrawArc($arcPen, 440, 90, 190, 190, $range[0], $range[1])
}
$arcPen.Dispose()
foreach ($tip in @(@(618, 118, 40), @(452, 252, 220))) {
    $points = [System.Drawing.PointF[]] @(
        (New-Object System.Drawing.PointF(($tip[0]), ($tip[1]))),
        (New-Object System.Drawing.PointF(($tip[0] + 46 * [math]::Cos(([double]$tip[2] + 152) * [math]::PI / 180)), ($tip[1] - 46 * [math]::Sin(([double]$tip[2] + 152) * [math]::PI / 180)))),
        (New-Object System.Drawing.PointF(($tip[0] + 46 * [math]::Cos(([double]$tip[2] + 208) * [math]::PI / 180)), ($tip[1] - 46 * [math]::Sin(([double]$tip[2] + 208) * [math]::PI / 180))))
    )
    $arrow = New-Solid (New-Color 235 $gold)
    $ctx.Graphics.FillPolygon($arrow, $points)
    $arrow.Dispose()
}
$ctx.Graphics.Dispose(); ConvertTo-PngFile $ctx.Bitmap (Join-Path $OutDir 'banner-update.png')

# --- maintenance: roda gigi ---
$ctx = New-BannerCanvas
Add-LeftPanel $ctx.Graphics 360
$gearState = $ctx.Graphics.Save()
$ctx.Graphics.TranslateTransform(535, 185)
$teeth = New-Solid (New-Color 225 $gold)
for ($tooth = 0; $tooth -lt 8; $tooth++) {
    $ctx.Graphics.RotateTransform(45)
    $toothRect = New-Object System.Drawing.Rectangle(-16, -102, 32, 40)
    $ctx.Graphics.FillRectangle($teeth, $toothRect)
}
$teeth.Dispose()
$ctx.Graphics.Restore($gearState)
$gearBody = New-Solid (New-Color 225 $gold)
$ctx.Graphics.FillEllipse($gearBody, 450, 100, 170, 170)
$gearBody.Dispose()
$hole = New-Solid $deepGreen
$ctx.Graphics.FillEllipse($hole, 497, 147, 76, 76)
$hole.Dispose()
$ctx.Graphics.Dispose(); ConvertTo-PngFile $ctx.Bitmap (Join-Path $OutDir 'banner-maintenance.png')

# --- alert: segitiga peringatan ---
$ctx = New-BannerCanvas
Add-LeftPanel $ctx.Graphics 360
$triangle = [System.Drawing.PointF[]] @(
    (New-Object System.Drawing.PointF(535, 66)),
    (New-Object System.Drawing.PointF(652, 264)),
    (New-Object System.Drawing.PointF(418, 264))
)
$amber = [System.Drawing.Color]::FromArgb(255, 0xE9, 0xA1, 0x3B)
$triBrush = New-Solid $amber
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
foreach ($point in $triangle) { $path.AddLine($point, $point) }
$triPen = New-Object System.Drawing.Pen($amber, 26)
$triPen.LineJoin = 'Round'
$ctx.Graphics.DrawPolygon($triPen, $triangle)
$triPen.Dispose(); $triBrush.Dispose(); $path.Dispose()
$mark = New-Solid $deepGreen
$bangRect = New-Object System.Drawing.Rectangle(527, 138, 16, 62)
$ctx.Graphics.FillRectangle($mark, $bangRect)
$ctx.Graphics.FillEllipse($mark, 527, 214, 16, 16)
$mark.Dispose()
$ctx.Graphics.Dispose(); ConvertTo-PngFile $ctx.Bitmap (Join-Path $OutDir 'banner-alert.png')

Write-Host 'Branding push notification selesai dibuat.'
