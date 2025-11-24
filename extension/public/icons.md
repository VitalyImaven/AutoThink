# Extension Icons

You need to create three icon files for the Chrome extension:

- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

## Quick Solution

For development, you can use any PNG images of the correct sizes, or create simple colored squares using an image editor.

## Recommended Tool

Use an online icon generator or image editor to create icons with a robot/AI theme (🤖) or autofill theme.

Alternatively, use this command to create placeholder icons:

```bash
# On macOS/Linux with ImageMagick:
convert -size 16x16 xc:#4285f4 icon16.png
convert -size 48x48 xc:#4285f4 icon48.png
convert -size 128x128 xc:#4285f4 icon128.png
```

Place the generated icons in this directory (`extension/public/`).

The manifest.json references these icons, so the extension won't load properly without them.

