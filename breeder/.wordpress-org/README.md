# WP.org marketplace assets

This directory holds the assets that appear on the plugin's WordPress.org listing page.
WP.org reads them from the SVN `assets/` subfolder (NOT bundled in the plugin ZIP).

## Required files

| File                     | Dimensions   | Purpose                                                                |
|--------------------------|--------------|------------------------------------------------------------------------|
| `icon-128x128.png`       | 128 × 128    | Small icon shown in plugin search results                              |
| `icon-256x256.png`       | 256 × 256    | Hi-DPI version of the icon                                             |
| `banner-772x250.png`     | 772 × 250    | Header banner on the plugin's listing page                             |
| `banner-1544x500.png`    | 1544 × 500   | Hi-DPI version of the banner                                           |
| `screenshot-1.png`       | 1280 × 720   | First screenshot, matches `1.` in `readme.txt` Screenshots section     |
| `screenshot-2.png`       | 1280 × 720   | Second screenshot                                                      |
| `screenshot-3.png`       | 1280 × 720   | …                                                                      |

## Design brief (Velora Breeder Widgets)

- **Brand colors**: Velora accent green (`#4a7c59`), parchment off-white background (`#f8f5f0`)
- **Mascot**: cat or dog silhouette (multi-species portal — keep neutral)
- **Banner copy**: "Velora Breeder Widgets — your cattery on WordPress" (PL: "Twoja hodowla na WordPress")
- **Screenshots to capture**:
  1. Animals widget rendering on a real WP page (Twenty Twenty-Four theme)
  2. Contact form widget with the consent checkbox visible
  3. Plugin settings page in WP admin

## Generation tips

- Use Figma or Affinity Designer; export as PNG with sRGB profile (WP.org rejects ICC-tagged PNGs sometimes).
- Banner must NOT have any text crucial to understanding the plugin — banners are sometimes hidden on mobile.
- Icon should remain readable at 64×64 (browser favicon size).

These files are intentionally absent until a designer produces them. The `make wp-package-breeder` script does NOT include this directory in the distribution ZIP — assets are uploaded to SVN's `/assets/` separately.
