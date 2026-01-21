# Images Directory

This directory contains all static images used in the documentation site.

## Structure

```
images/
├── screenshots/        # Application screenshots
├── diagrams/          # Architecture and flow diagrams
├── provider-logos/    # Email and LLM provider logos
└── misc/             # Miscellaneous images
```

## Image Optimization

All images are automatically optimized during build:

1. **WebP Conversion**: All PNG/JPG images are converted to WebP format for better compression
2. **Fallback Support**: Original PNG/JPG images are preserved as fallbacks for older browsers
3. **Automatic Processing**: Run `pnpm optimize:images` or happens automatically during `pnpm build`

### Adding New Images

1. Place original images (PNG, JPG) in appropriate subdirectory
2. Run `pnpm optimize:images` to generate WebP versions
3. Reference in MDX using relative paths:
   ```mdx
   ![Alt text](/images/screenshots/dashboard.png)
   ```
   Next.js will automatically serve WebP to supporting browsers.

## Best Practices

- **Use descriptive filenames**: `gmail-setup-oauth-screen.png` not `image1.png`
- **Optimize before committing**: Images should be reasonably sized (< 500KB)
- **Use appropriate formats**:
  - Screenshots: PNG (will be converted to WebP)
  - Photos: JPG (will be converted to WebP)
  - Logos: SVG when possible (no conversion needed)
  - Animations: GIF (see `/gifs` directory)

## Manual Optimization

For very large images, consider using an image editor to reduce dimensions before committing:

- Screenshots: 1920x1080 max
- Diagrams: 1200x800 recommended
- Logos: 200x200 or SVG

## GIFs

Animated GIFs for workflows are stored in `/gifs` and generated via Playwright tests.
See `tests/gif-generation/` for generation scripts.
