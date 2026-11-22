Add-Type -AssemblyName System.Drawing

$assetsDir = "D:\DEV\nourplay\apps\mobile\assets"

# ─────────────────────────────────────────────────────────────
# 1. Feature Graphic (1024 x 500)
# ─────────────────────────────────────────────────────────────
$fgWidth = 1024
$fgHeight = 500
$fgBmp = New-Object System.Drawing.Bitmap($fgWidth, $fgHeight)
$g = [System.Drawing.Graphics]::FromImage($fgBmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Gradient background
$rect = New-Object System.Drawing.Rectangle(0, 0, $fgWidth, $fgHeight)
$c1 = [System.Drawing.ColorTranslator]::FromHtml("#1c90d8")
$c2 = [System.Drawing.ColorTranslator]::FromHtml("#0b4d75")
$gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
$g.FillRectangle($gradient, $rect)

# Draw decorative shapes
$circleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 255, 255, 255))
$g.FillEllipse($circleBrush, 750, -50, 400, 400)
$g.FillEllipse($circleBrush, 850, 220, 300, 300)

# Draw NourPlay logo icon
$iconPath = Join-Path $assetsDir "icon.png"
if (Test-Path $iconPath) {
    $srcImg = [System.Drawing.Image]::FromFile($iconPath)
    $g.DrawImage($srcImg, 80, 150, 200, 200)
    $srcImg.Dispose()
}

# Typography
$fontFamily = New-Object System.Drawing.FontFamily("Arial")
$titleFont = New-Object System.Drawing.Font($fontFamily, [float]64, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$taglineFont = New-Object System.Drawing.Font($fontFamily, [float]26, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subFont = New-Object System.Drawing.Font($fontFamily, [float]20, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$yellowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#fbbf24"))
$lightBlueBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#bae6fd"))

$g.DrawString("NourPlay", $titleFont, $whiteBrush, 310, 170)
$g.DrawString("Vidéos & Playlists Sécurisées", $taglineFont, $yellowBrush, 315, 245)
$g.DrawString("Espace 100% protégé pour enfants et familles · Compatible Google TV", $subFont, $lightBlueBrush, 315, 290)

# Badge pills
$pillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
$g.FillRectangle($pillBrush, 315, 335, 140, 34)
$g.FillRectangle($pillBrush, 470, 335, 170, 34)
$g.FillRectangle($pillBrush, 655, 335, 150, 34)

$badgeFont = New-Object System.Drawing.Font($fontFamily, [float]14, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString("🔒 Sans pub toxique", $badgeFont, $whiteBrush, 325, 342)
$g.DrawString("⏱ Minuteur parental", $badgeFont, $whiteBrush, 480, 342)
$g.DrawString("📺 Google TV Ready", $badgeFont, $whiteBrush, 665, 342)

$fgBmp.Save((Join-Path $assetsDir "feature-graphic.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$fgBmp.Dispose()
Write-Output "Created feature-graphic.png (1024x500)"

# ─────────────────────────────────────────────────────────────
# 2. Android TV Screenshot (1920 x 1080)
# ─────────────────────────────────────────────────────────────
$tvWidth = 1920
$tvHeight = 1080
$tvBmp = New-Object System.Drawing.Bitmap($tvWidth, $tvHeight)
$gTv = [System.Drawing.Graphics]::FromImage($tvBmp)
$gTv.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# TV background: Dark modern slate
$tvBgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#0f172a"))
$gTv.FillRectangle($tvBgBrush, 0, 0, $tvWidth, $tvHeight)

# Top Bar
$topBarBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#1e293b"))
$gTv.FillRectangle($topBarBrush, 0, 0, $tvWidth, 100)

$tvLogoFont = New-Object System.Drawing.Font($fontFamily, [float]38, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$gTv.DrawString("NourPlay", $tvLogoFont, $whiteBrush, 80, 30)

$tvMenuFont = New-Object System.Drawing.Font($fontFamily, [float]22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#94a3b8"))
$activePillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#1c90d8"))

$gTv.FillRectangle($activePillBrush, 320, 25, 140, 50)
$gTv.DrawString("Accueil", $tvMenuFont, $whiteBrush, 350, 36)
$gTv.DrawString("Playlists", $tvMenuFont, $grayBrush, 500, 36)
$gTv.DrawString("Profils Enfants", $tvMenuFont, $grayBrush, 650, 36)

# Main Hero / Featured Video Banner
$heroBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#1e3a5f"))
$gTv.FillRectangle($heroBrush, 80, 140, 1760, 420)

$heroTitleFont = New-Object System.Drawing.Font($fontFamily, [float]44, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$heroDescFont = New-Object System.Drawing.Font($fontFamily, [float]22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$gTv.DrawString("Sélection du Jour : Les Histoires Éducatives", $heroTitleFont, $whiteBrush, 130, 200)
$gTv.DrawString("Contenu vérifié et validé sans risque pour les enfants. Durée adaptée et sans publicité.", $heroDescFont, $lightBlueBrush, 130, 270)

# Play Button
$btnBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#fbbf24"))
$btnTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#0f172a"))
$gTv.FillRectangle($btnBrush, 130, 340, 220, 60)
$btnFont = New-Object System.Drawing.Font($fontFamily, [float]24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$gTv.DrawString("▶ Lire la vidéo", $btnFont, $btnTextBrush, 160, 354)

# Section: Playlists Récentes
$sectionTitleFont = New-Object System.Drawing.Font($fontFamily, [float]32, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$gTv.DrawString("Playlists pour Enfants", $sectionTitleFont, $whiteBrush, 80, 600)

# 4 Video cards
$cardColors = @("#1c90d8", "#0284c7", "#0369a1", "#075985")
$cardTitles = @("Apprendre l'Alphabet", "Contes & Sagesse", "Découverte des Sciences", "Chansons Douces")
for ($i = 0; $i -lt 4; $i++) {
    $x = 80 + ($i * 450)
    $cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($cardColors[$i]))
    $gTv.FillRectangle($cardBrush, $x, 660, 410, 230)

    # Card play icon
    $gTv.DrawString("▶", $sectionTitleFont, $whiteBrush, ($x + 185), 740)
    
    # Title under card
    $cardTextFont = New-Object System.Drawing.Font($fontFamily, [float]20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $gTv.DrawString($cardTitles[$i], $cardTextFont, $whiteBrush, $x, 910)
}

$tvBmp.Save((Join-Path $assetsDir "screenshot-tv-1.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$gTv.Dispose()
$tvBmp.Dispose()
Write-Output "Created screenshot-tv-1.png (1920x1080)"

# ─────────────────────────────────────────────────────────────
# 3. Mobile Screenshots (1080 x 1920)
# ─────────────────────────────────────────────────────────────
# Mobile Screen 1: Child Playlists
$m1Bmp = New-Object System.Drawing.Bitmap(1080, 1920)
$gm1 = [System.Drawing.Graphics]::FromImage($m1Bmp)
$gm1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$mobileBgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#f0f8fd"))
$gm1.FillRectangle($mobileBgBrush, 0, 0, 1080, 1920)

# Top Bar Mobile
$topMobileBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$gm1.FillRectangle($topMobileBrush, 0, 0, 1080, 180)

$mTitleFont = New-Object System.Drawing.Font($fontFamily, [float]48, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$gm1.DrawString("NourPlay", $mTitleFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#1c90d8")), 60, 70)

# Child Profile badge
$profBadge = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#e0f2fe"))
$gm1.FillRectangle($profBadge, 750, 60, 270, 70)
$badgeMFont = New-Object System.Drawing.Font($fontFamily, [float]24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$gm1.DrawString("👶 Profil Enfant", $badgeMFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0284c7")), 770, 80)

# Section Title
$mSecFont = New-Object System.Drawing.Font($fontFamily, [float]36, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$gm1.DrawString("Mes Playlists Préférées", $mSecFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0f172a")), 60, 230)

# Cards on Mobile
$mCards = @("Animaux du Monde", "Histoires du Soir", "Aventures & Découvertes")
for ($i = 0; $i -lt 3; $i++) {
    $y = 310 + ($i * 470)
    # White card container
    $gm1.FillRectangle($topMobileBrush, 60, $y, 960, 430)
    # Card image area
    $mImgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($cardColors[$i]))
    $gm1.FillRectangle($mImgBrush, 60, $y, 960, 270)
    $gm1.DrawString("▶", $mTitleFont, $whiteBrush, 510, ($y + 110))
    # Card text
    $gm1.DrawString($mCards[$i], $mSecFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0f172a")), 90, ($y + 295))
    $subM = New-Object System.Drawing.Font($fontFamily, [float]22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $gm1.DrawString("12 vidéos éducatives · Durée totale : 45m", $subM, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#64748b")), 90, ($y + 355))
}

$m1Bmp.Save((Join-Path $assetsDir "screenshot-mobile-1.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$gm1.Dispose()
$m1Bmp.Dispose()
Write-Output "Created screenshot-mobile-1.png (1080x1920)"

# Mobile Screen 2: Parent Mode & Controls
$m2Bmp = New-Object System.Drawing.Bitmap(1080, 1920)
$gm2 = [System.Drawing.Graphics]::FromImage($m2Bmp)
$gm2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gm2.FillRectangle($mobileBgBrush, 0, 0, 1080, 1920)

# Top Bar
$gm2.FillRectangle($topMobileBrush, 0, 0, 1080, 180)
$gm2.DrawString("Espace Parent", $mTitleFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0f172a")), 60, 70)

# Controls Card 1: Screen time
$gm2.FillRectangle($topMobileBrush, 60, 230, 960, 320)
$gm2.DrawString("⏱ Minuteur de temps d'écran", $mSecFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0f172a")), 100, 270)
$gm2.DrawString("Arrêt automatique après 30 minutes de visionnage.", $subM, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#64748b")), 100, 330)
$activeTimerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#22c55e"))
$gm2.FillRectangle($activeTimerBrush, 100, 390, 200, 60)
$timerFont = New-Object System.Drawing.Font($fontFamily, [float]22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$gm2.DrawString("Actif : 30 min", $timerFont, $whiteBrush, 130, 405)

# Controls Card 2: Security & PIN
$gm2.FillRectangle($topMobileBrush, 60, 590, 960, 320)
$gm2.DrawString("🔒 Code PIN de protection", $mSecFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0f172a")), 100, 630)
$gm2.DrawString("Empêche l'enfant d'accéder aux paramètres parents.", $subM, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#64748b")), 100, 690)
$pinPill = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#0284c7"))
$gm2.FillRectangle($pinPill, 100, 750, 220, 60)
$gm2.DrawString("PIN Configuré ✓", $timerFont, $whiteBrush, 130, 765)

# Controls Card 3: Approved playlists
$gm2.FillRectangle($topMobileBrush, 60, 950, 960, 480)
$gm2.DrawString("📋 Gestion des Vidéos Autorisées", $mSecFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0f172a")), 100, 990)
$gm2.DrawString("Seules les vidéos validées par le parent sont accessibles.", $subM, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#64748b")), 100, 1045)
$gm2.DrawString("✓ 3 Playlists actives pour Adam", $timerFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#16a34a")), 100, 1120)
$gm2.DrawString("✓ Validation IA contre les contenus toxiques", $timerFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#16a34a")), 100, 1180)
$gm2.DrawString("✓ Historique de visionnage détaillé", $timerFont, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#16a34a")), 100, 1240)

$m2Bmp.Save((Join-Path $assetsDir "screenshot-mobile-2.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$gm2.Dispose()
$m2Bmp.Dispose()
Write-Output "Created screenshot-mobile-2.png (1080x1920)"

Write-Output "ALL PLAY STORE GRAPHICAL ASSETS READY!"
