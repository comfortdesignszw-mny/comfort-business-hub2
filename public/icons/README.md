# Custom App & PWA Icons Directory

This directory (`/public/icons/`) is the **single, primary folder** for all app and PWA icon assets.

## How to add your custom icons:

Place your custom PNG icon files directly in this directory (`public/icons/`), replacing the placeholder files with the exact filenames listed below:

| File Name | Dimensions | Description / Purpose |
| :--- | :--- | :--- |
| `icon-192x192.png` | `192 x 192` px | Standard PWA App Icon (Android / Home Screen) |
| `icon-512x512.png` | `512 x 512` px | High-res PWA App Icon / Splash Screen |
| `icon-maskable-192x192.png` | `192 x 192` px | Maskable Adaptive Icon (Android) |
| `icon-maskable-512x512.png` | `512 x 512` px | High-res Maskable Adaptive Icon (Android) |
| `apple-touch-icon.png` | `180 x 180` px | Apple iOS Touch Icon |
| `favicon-32x32.png` | `32 x 32` px | Desktop Browser Tab Favicon |
| `favicon-16x16.png` | `16 x 16` px | Small Browser Tab Favicon |
| `favicon.ico` | `32 x 32` px | Standard ICO Favicon |

### App Brand Logo (`/public/icon.png`):
For the main app logo displayed on login, signup, and headers, replace the file at `/public/icon.png` (`512 x 512` px recommended).

## Verification:
Run `npm run verify-icons` anytime in the terminal to verify that all icon paths in `manifest.json` are valid and accessible.
