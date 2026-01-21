import { test, expect } from '@playwright/test';
import GIFEncoder from 'gif-encoder-2';
import { createCanvas, Image } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, '../../public/gifs');
const GIF_WIDTH = 1280;
const GIF_HEIGHT = 720;
const FRAME_DELAY = 100; // ms between frames

test.describe('Setup Workflow GIF Generation', () => {
  test.beforeAll(async () => {
    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test('generate setup workflow GIF', async ({ page }) => {
    const encoder = new GIFEncoder(GIF_WIDTH, GIF_HEIGHT);
    const canvas = createCanvas(GIF_WIDTH, GIF_HEIGHT);
    const ctx = canvas.getContext('2d');

    const gifPath = path.join(OUTPUT_DIR, 'setup-workflow.gif');
    const stream = fs.createWriteStream(gifPath);

    encoder.createReadStream().pipe(stream);
    encoder.start();
    encoder.setRepeat(0); // 0 = loop forever, -1 = no loop
    encoder.setDelay(FRAME_DELAY);
    encoder.setQuality(10); // Lower = better quality

    // Navigate to documentation installation page
    await page.goto('http://localhost:3001/docs/getting-started/installation');
    await page.waitForLoadState('networkidle');

    // Capture initial state
    await addFrame(page, encoder, ctx, canvas);

    // Scroll to Interactive Setup Wizard
    await page.evaluate(() => {
      const wizard = document.querySelector('h2:has-text("Interactive Setup Wizard")');
      wizard?.scrollIntoView({ behavior: 'smooth' });
    });
    await page.waitForTimeout(500);
    await addFrame(page, encoder, ctx, canvas, 5); // Hold for 5 frames

    // Click through wizard steps
    // Step 1: Email Provider
    const gmailButton = page.locator('button:has-text("Gmail")');
    if (await gmailButton.isVisible()) {
      await gmailButton.click();
      await page.waitForTimeout(300);
      await addFrame(page, encoder, ctx, canvas, 3);
    }

    // Step 2: LLM Provider
    const openaiButton = page.locator('button:has-text("OpenAI")');
    if (await openaiButton.isVisible()) {
      await openaiButton.click();
      await page.waitForTimeout(300);
      await addFrame(page, encoder, ctx, canvas, 3);
    }

    // Step 3: Use Case
    const personalButton = page.locator('button:has-text("Personal Email Organization")');
    if (await personalButton.isVisible()) {
      await personalButton.click();
      await page.waitForTimeout(300);
      await addFrame(page, encoder, ctx, canvas, 3);
    }

    // Final result screen
    await page.waitForTimeout(500);
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
