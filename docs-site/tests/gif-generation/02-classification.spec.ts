import { test, expect } from '@playwright/test';
import GIFEncoder from 'gif-encoder-2';
import { createCanvas, Image } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, '../../public/gifs');
const GIF_WIDTH = 1280;
const GIF_HEIGHT = 720;
const FRAME_DELAY = 100; // ms between frames

test.describe('Classification Demo GIF Generation', () => {
  test.beforeAll(async () => {
    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test('generate classification demo GIF', async ({ page }) => {
    const encoder = new GIFEncoder(GIF_WIDTH, GIF_HEIGHT);
    const canvas = createCanvas(GIF_WIDTH, GIF_HEIGHT);
    const ctx = canvas.getContext('2d');

    const gifPath = path.join(OUTPUT_DIR, 'classification-demo.gif');
    const stream = fs.createWriteStream(gifPath);

    encoder.createReadStream().pipe(stream);
    encoder.start();
    encoder.setRepeat(0); // 0 = loop forever
    encoder.setDelay(FRAME_DELAY);
    encoder.setQuality(10); // Lower = better quality

    // Navigate to configuration prompts page
    await page.goto('http://localhost:3001/docs/configuration/prompts-guide');
    await page.waitForLoadState('networkidle');

    // Capture initial state
    await addFrame(page, encoder, ctx, canvas);

    // Scroll to ConfigSandbox component
    await page.evaluate(() => {
      const sandbox = document.querySelector('[data-testid="config-sandbox"]') ||
                      document.querySelector('.config-sandbox');
      sandbox?.scrollIntoView({ behavior: 'smooth' });
    });
    await page.waitForTimeout(500);
    await addFrame(page, encoder, ctx, canvas, 5); // Hold for 5 frames

    // Interact with sandbox - paste sample email
    const emailTextarea = page.locator('textarea[placeholder*="email"], textarea[name="emailContent"]').first();
    if (await emailTextarea.isVisible()) {
      await emailTextarea.click();
      await page.waitForTimeout(200);
      await addFrame(page, encoder, ctx, canvas, 2);

      // Type sample email content
      await emailTextarea.fill(`From: newsletter@techcompany.com
To: user@example.com
Subject: Weekly Tech Newsletter - New AI Features

Hi there,

Check out our latest AI-powered features in this week's newsletter...`);
      await page.waitForTimeout(300);
      await addFrame(page, encoder, ctx, canvas, 3);
    }

    // Click "Test Classification" button
    const testButton = page.locator('button:has-text("Test"), button:has-text("Classify")').first();
    if (await testButton.isVisible()) {
      await testButton.click();
      await page.waitForTimeout(500);
      await addFrame(page, encoder, ctx, canvas, 3);
    }

    // Wait for results
    await page.waitForTimeout(2000);
    await addFrame(page, encoder, ctx, canvas, 5);

    // Scroll to results
    await page.evaluate(() => {
      const results = document.querySelector('[data-testid="classification-results"]') ||
                     document.querySelector('.results');
      results?.scrollIntoView({ behavior: 'smooth' });
    });
    await page.waitForTimeout(500);
    await addFrame(page, encoder, ctx, canvas, 10); // Hold final result longer

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
