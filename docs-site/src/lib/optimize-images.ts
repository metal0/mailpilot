#!/usr/bin/env tsx
/**
 * Image Optimization Script
 *
 * Converts images to WebP format with PNG fallbacks for better performance.
 * Processes all images in public/images directory.
 *
 * Usage:
 *   pnpm run optimize:images
 *
 * Output:
 *   - Original images preserved
 *   - WebP versions created alongside originals
 *   - Optimization report printed to console
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGES_DIR = path.join(__dirname, '../../public/images');
const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg'];

interface OptimizationStats {
  processed: number;
  skipped: number;
  errors: number;
  totalSavedBytes: number;
  details: Array<{
    file: string;
    originalSize: number;
    webpSize: number;
    savedBytes: number;
    savedPercent: number;
  }>;
}

/**
 * Find all image files recursively
 */
function findImages(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    return fileList;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findImages(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_FORMATS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  }

  return fileList;
}

/**
 * Convert image to WebP format
 */
async function convertToWebP(
  imagePath: string,
  stats: OptimizationStats
): Promise<void> {
  const ext = path.extname(imagePath);
  const webpPath = imagePath.replace(ext, '.webp');

  // Skip if WebP already exists and is newer
  if (fs.existsSync(webpPath)) {
    const originalStat = fs.statSync(imagePath);
    const webpStat = fs.statSync(webpPath);

    if (webpStat.mtime > originalStat.mtime) {
      stats.skipped++;
      return;
    }
  }

  try {
    const originalSize = fs.statSync(imagePath).size;

    // Convert to WebP with quality optimization
    await sharp(imagePath)
      .webp({ quality: 85, effort: 6 })
      .toFile(webpPath);

    const webpSize = fs.statSync(webpPath).size;
    const savedBytes = originalSize - webpSize;
    const savedPercent = ((savedBytes / originalSize) * 100);

    stats.processed++;
    stats.totalSavedBytes += savedBytes;
    stats.details.push({
      file: path.relative(IMAGES_DIR, imagePath),
      originalSize,
      webpSize,
      savedBytes,
      savedPercent
    });

    console.log(`  ✓ ${path.basename(imagePath)} → ${formatBytes(originalSize)} → ${formatBytes(webpSize)} (${savedPercent.toFixed(1)}% saved)`);
  } catch (error) {
    stats.errors++;
    console.error(`  ✗ Failed to convert ${path.basename(imagePath)}:`, error);
  }
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Print optimization report
 */
function printReport(stats: OptimizationStats): void {
  console.log('\n' + '='.repeat(60));
  console.log('Image Optimization Report');
  console.log('='.repeat(60));
  console.log(`Total images processed: ${stats.processed}`);
  console.log(`Skipped (already optimized): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Total space saved: ${formatBytes(stats.totalSavedBytes)}`);

  if (stats.details.length > 0) {
    const avgSaved = stats.totalSavedBytes / stats.details.length;
    const avgPercent = stats.details.reduce((sum, d) => sum + d.savedPercent, 0) / stats.details.length;
    console.log(`Average saved per image: ${formatBytes(avgSaved)} (${avgPercent.toFixed(1)}%)`);
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting image optimization...');
  console.log(`Images directory: ${IMAGES_DIR}\n`);

  // Ensure images directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log('Created images directory');
  }

  const stats: OptimizationStats = {
    processed: 0,
    skipped: 0,
    errors: 0,
    totalSavedBytes: 0,
    details: []
  };

  // Find all images
  const images = findImages(IMAGES_DIR);
  console.log(`Found ${images.length} images\n`);

  if (images.length === 0) {
    console.log('No images to process. Add images to docs-site/public/images/');
    return;
  }

  // Process each image
  for (const imagePath of images) {
    await convertToWebP(imagePath, stats);
  }

  // Print report
  printReport(stats);
}

main().catch(console.error);
