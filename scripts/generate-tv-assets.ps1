Add-Type -AssemblyName System.Drawing

# Copy existing icons into apps/mobile/assets
Copy-Item "D:\DEV\nourplay\apps\web\public\icons\icon-512.png" "D:\DEV\nourplay\apps\mobile\assets\icon.png" -Force
Copy-Item "D:\DEV\nourplay\apps\web\public\icons\icon-maskable-512.png" "D:\DEV\nourplay\apps\mobile\assets\adaptive-icon.png" -Force
Copy-Item "D:\DEV\nourplay\apps\web\public\icons\icon-512.png" "D:\DEV\nourplay\apps\mobile\assets\splash.png" -Force

# Generate 320x180 Android TV Banner (16:9)
$bmp = New-Object System.Drawing.Bitmap(320, 180)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Background: Brand blue #1c90d8
$bgColor = [System.Drawing.ColorTranslator]::FromHtml('#1c90d8')
$brush = New-Object System.Drawing.SolidBrush($bgColor)
$g.FillRectangle($brush, 0, 0, 320, 180)

# Draw NourPlay logo icon if present
$iconPath = "D:\DEV\nourplay\apps\web\public\icons\icon-512.png"
if (Test-Path $iconPath) {
    $srcImg = [System.Drawing.Image]::FromFile($iconPath)
    $g.DrawImage($srcImg, 35, 45, 90, 90)
    $srcImg.Dispose()
}

# Draw text 'NourPlay' in white bold
$fontFamily = New-Object System.Drawing.FontFamily("Arial")
$font = New-Object System.Drawing.Font($fontFamily, [float]32, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString("NourPlay", $font, $textBrush, 138, 68)

$outPath = "D:\DEV\nourplay\apps\mobile\assets\tv-banner.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "Banner and icons generated successfully at $outPath"
