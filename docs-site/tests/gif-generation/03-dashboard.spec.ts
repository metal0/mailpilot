import { test, expect } from '@playwright/test';
import GIFEncoder from 'gif-encoder-2';
import { createCanvas, Image } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, '../../public/gifs');
const GIF_WIDTH = 1280;
const GIF_HEIGHT = 720;
const FRAME_DELAY = 150; // Slightly slower for dashboard navigation

test.describe('Dashboard Navigation GIF Generation', () => {
  test.beforeAll(async () => {
    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test('generate dashboard navigation GIF', async ({ page }) => {
    const encoder = new GIFEncoder(GIF_WIDTH, GIF_HEIGHT);
    const canvas = createCanvas(GIF_WIDTH, GIF_HEIGHT);
    const ctx = canvas.getContext('2d');

    const gifPath = path.join(OUTPUT_DIR, 'dashboard-navigation.gif');
    const stream = fs.createWriteStream(gifPath);

    encoder.createReadStream().pipe(stream);
    encoder.start();
    encoder.setRepeat(0); // 0 = loop forever
    encoder.setDelay(FRAME_DELAY);
    encoder.setQuality(10); // Lower = better quality

    // Navigate to features/dashboard page
    await page.goto('http://localhost:3001/docs/features/dashboard');
    await page.waitForLoadState('networkidle');

    // Capture initial state
    await addFrame(page, encoder, ctx, canvas, 3);

    // Scroll through different sections
    const sections = [
      'Statistics Overview',
      'Activity Log',
      'Account Management',
      'Configuration Editor'
    ];

    for (const section of sections) {
      // Find heading and scroll to it
      await page.evaluate((sectionName) => {
        const heading = Array.from(document.querySelectorAll('h2, h3'))
          .find(h => h.textContent?.includes(sectionName));
        heading?.scrollIntoView({ behavior: 'smooth' });
      }, section);

      await page.waitForTimeout(800);
      await addFrame(page, encoder, ctx, canvas, 4);
    }

    // Navigate to API reference
    const apiLink = page.locator('a[href*="/api/"]').first();
    if (await apiLink.isVisible()) {
      await apiLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await addFrame(page, encoder, ctx, canvas, 4);
    }

    // Scroll through API endpoints
    await page.evaluate(() => {
      const endpoints = document.querySelector('h2:has-text("GET"), h3:has-text("/api/")');
      endpoints?.scrollIntoView({ behavior: 'smooth' });
    });
    await page.waitForTimeout(500);
    await addFrame(page, encoder, ctx, canvas, 4);

    // Navigate to configuration reference
    const configLink = page.locator('a[href*="/configuration/"]').first();
    if (await configLink.isVisible()) {
      await configLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await addFrame(page, encoder, ctx, canvas, 4);
    }

    // Show search functionality
    const searchButton = page.locator('button[aria-label*="Search"], [data-search-trigger]').first();
    if (await searchButton.isVisible()) {
      await searchButton.click();
      await page.waitForTimeout(300);
      await addFrame(page, encoder, ctx, canvas, 3);

      // Type search query
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('gmail');
        await page.waitForTimeout(500);
        await addFrame(page, encoder, ctx, canvas, 4);

        // Close search
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await addFrame(page, encoder, ctx, canvas, 2);
      }
    }

    // Final state - return to home
    await page.goto('http://localhost:3001/docs');
    await page.waitForLoadState('networkidle');
    await addFrame(page, encoder, ctx, canvas, 10); // Hold final frame longer

    encoder.finish();

    await new Promise((resolve) => {
      stream.on('finish', resolve);
    });

    console.log(`✓ Generated: ${gifPath}`);
  });
});

async function addFrame(
  page: any,
  encoder: GIFEncoder,
  ctx: any,
  canvas: any,
  count: number = 1
) {
  const screenshot = await page.screenshot({
    clip: {
      x: 0,
      y: 0,
      width: GIF_WIDTH,
      height: GIF_HEIGHT,
    },
  });

  const img = new Image();
  img.src = screenshot;

  ctx.drawImage(img, 0, 0, GIF_WIDTH, GIF_HEIGHT);

  for (let i = 0; i < count; i++) {
    encoder.addFrame(ctx);
  }
}
