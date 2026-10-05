# Generates placeholder WP.org listing assets for both plugins.
#
# WordPress reads .wordpress-org/{icon-128x128.png, icon-256x256.png,
# banner-772x250.png, banner-1544x500.png, screenshot-N.png} when listing
# the plugin in WP admin and (eventually) on WordPress.org. Until real
# branding lands we ship simple typographic placeholders so the admin
# Plugins list shows something other than the generic "W" fallback.
#
# Palette (project_color_palette.md, "Editorial Ink"):
#   - Breeder: navy  #1B2A4E + cream foreground #F8F4E9
#   - Club:    forest green #2C4A3E + cream foreground #F8F4E9
#
# Usage: powershell.exe -File docker/wp-dev/generate-wp-assets.ps1

Add-Type -AssemblyName System.Drawing

function New-PlaceholderPng {
    param(
        [string]$OutPath,
        [int]$Width,
        [int]$Height,
        [string]$BgHex,
        [string]$FgHex,
        [string]$BigText,
        [string]$Subtext = $null,
        [int]$BigSize  = 0
    )

    $bg = [System.Drawing.ColorTranslator]::FromHtml($BgHex)
    $fg = [System.Drawing.ColorTranslator]::FromHtml($FgHex)

    $bmp = New-Object System.Drawing.Bitmap $Width, $Height
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.Clear($bg)

    if ($BigSize -le 0) { $BigSize = [int]($Height * 0.55) }

    $bigFont   = New-Object System.Drawing.Font 'Segoe UI', $BigSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $brush     = New-Object System.Drawing.SolidBrush $fg
    $sf        = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    if ($Subtext) {
        # Two-line layout: big mark on the left, words on the right.
        $smallSize = [int]($Height * 0.18)
        $smallFont = New-Object System.Drawing.Font 'Segoe UI', $smallSize, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)

        $markRect = New-Object System.Drawing.RectangleF 0, 0, ([single]($Width * 0.30)), ([single]$Height)
        $g.DrawString($BigText, $bigFont, $brush, $markRect, $sf)

        $sfLeft = New-Object System.Drawing.StringFormat
        $sfLeft.Alignment     = [System.Drawing.StringAlignment]::Near
        $sfLeft.LineAlignment = [System.Drawing.StringAlignment]::Center
        $textRect  = New-Object System.Drawing.RectangleF ([single]($Width * 0.30)), 0, ([single]($Width * 0.65)), ([single]$Height)
        $bigSubFont = New-Object System.Drawing.Font 'Segoe UI', ([int]($Height * 0.22)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
        $g.DrawString($Subtext.Split('|')[0], $bigSubFont, $brush, $textRect, $sfLeft)
        if ($Subtext.Contains('|')) {
            $textRect2 = New-Object System.Drawing.RectangleF ([single]($Width * 0.30)), ([single]($Height * 0.55)), ([single]($Width * 0.65)), ([single]($Height * 0.40))
            $g.DrawString($Subtext.Split('|')[1], $smallFont, $brush, $textRect2, $sfLeft)
        }
    } else {
        # Centered single mark (icon).
        $rect = New-Object System.Drawing.RectangleF 0, 0, ([single]$Width), ([single]$Height)
        $g.DrawString($BigText, $bigFont, $brush, $rect, $sf)
    }

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "  ${OutPath} (${Width}x${Height})"
}

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path

foreach ($variant in @(
    @{ slug = 'breeder'; bg = '#1B2A4E'; fg = '#F8F4E9'; label = 'Breeder Widgets|Embed Velora content' },
    @{ slug = 'club';    bg = '#2C4A3E'; fg = '#F8F4E9'; label = 'Club Widgets|Embed your club site'    }
)) {
    $assetDir = Join-Path $repoRoot "$($variant.slug)\.wordpress-org"
    if (-not (Test-Path $assetDir)) { New-Item -ItemType Directory -Path $assetDir | Out-Null }

    Write-Host "Plugin: $($variant.slug)"
    New-PlaceholderPng -OutPath (Join-Path $assetDir 'icon-128x128.png') -Width 128 -Height 128 -BgHex $variant.bg -FgHex $variant.fg -BigText 'V'
    New-PlaceholderPng -OutPath (Join-Path $assetDir 'icon-256x256.png') -Width 256 -Height 256 -BgHex $variant.bg -FgHex $variant.fg -BigText 'V'
    New-PlaceholderPng -OutPath (Join-Path $assetDir 'banner-772x250.png')   -Width 772  -Height 250 -BgHex $variant.bg -FgHex $variant.fg -BigText 'V' -Subtext $variant.label
    New-PlaceholderPng -OutPath (Join-Path $assetDir 'banner-1544x500.png')  -Width 1544 -Height 500 -BgHex $variant.bg -FgHex $variant.fg -BigText 'V' -Subtext $variant.label
}

Write-Host "Done. Replace these with real branding before public release."
