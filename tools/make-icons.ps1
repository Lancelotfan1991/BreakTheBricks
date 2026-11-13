# Regenerate launcher icons + splash from android/icon-1024.png (rerun when the icon changes)
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $root 'android\icon-1024.png'
$res = Join-Path $root 'android\app\src\main\res'

$loaded = [System.Drawing.Image]::FromFile($Src)
# cover the generator watermark in the bottom-right corner (plain background there)
$src = New-Object System.Drawing.Bitmap $loaded.Width, $loaded.Height
$g0 = [System.Drawing.Graphics]::FromImage($src)
$g0.DrawImage($loaded, 0, 0)
$loaded.Dispose()
$bg = $src.GetPixel($src.Width - 1, [int]($src.Height * 0.90))
$brush = New-Object System.Drawing.SolidBrush $bg
$x0 = [int]($src.Width * 0.90); $y0 = [int]($src.Height * 0.93)
$g0.FillRectangle($brush, $x0, $y0, $src.Width - $x0, $src.Height - $y0)
$brush.Dispose()
$g0.Dispose()

function Resize($img, $w, $h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  return $bmp
}

$legacy = @{ 'mipmap-mdpi' = 48; 'mipmap-hdpi' = 72; 'mipmap-xhdpi' = 96; 'mipmap-xxhdpi' = 144; 'mipmap-xxxhdpi' = 192 }
foreach ($k in $legacy.Keys) {
  $s = $legacy[$k]
  $bmp = Resize $src $s $s
  $bmp.Save((Join-Path $res "$k\ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Save((Join-Path $res "$k\ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# adaptive foreground: 108dp canvas, art inside the center 66% safe zone
$fg = @{ 'mipmap-mdpi' = 108; 'mipmap-hdpi' = 162; 'mipmap-xhdpi' = 216; 'mipmap-xxhdpi' = 324; 'mipmap-xxxhdpi' = 432 }
foreach ($k in $fg.Keys) {
  $c = $fg[$k]; $a = [int]($c * 0.66); $off = [int](($c - $a) / 2)
  $bmp = New-Object System.Drawing.Bitmap $c, $c
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::FromArgb(20, 16, 28))
  $g.DrawImage($src, $off, $off, $a, $a)
  $g.Dispose()
  $bmp.Save((Join-Path $res "$k\ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# splash: dark canvas + centered icon, keep each file's existing dimensions
Get-ChildItem (Join-Path $res 'drawable*') -Filter 'splash.png' -Recurse | ForEach-Object {
  $old = [System.Drawing.Image]::FromFile($_.FullName)
  $w = $old.Width; $h = $old.Height; $old.Dispose()
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::FromArgb(20, 16, 28))
  $a = [int]([Math]::Min($w, $h) * 0.42)
  $g.DrawImage($src, [int](($w - $a) / 2), [int](($h - $a) / 2), $a, $a)
  $g.Dispose()
  $bmp.Save($_.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
# web/PWA icons
$web = Join-Path $root 'public\icons'
New-Item -ItemType Directory -Force -Path $web | Out-Null
foreach ($s in 180, 192, 512) {
  $bmp = Resize $src $s $s
  $bmp.Save((Join-Path $web "icon-$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
# maskable: art inside the center 80% safe zone on a solid background
$m = 512; $a = [int]($m * 0.8); $off = [int](($m - $a) / 2)
$bmp = New-Object System.Drawing.Bitmap $m, $m
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::FromArgb(20, 16, 28))
$g.DrawImage($src, $off, $off, $a, $a)
$g.Dispose()
$bmp.Save((Join-Path $web 'maskable-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

$src.Dispose()
Write-Host 'icons + splash + web icons regenerated'