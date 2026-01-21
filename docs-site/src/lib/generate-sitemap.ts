#!/usr/bin/env tsx
/**
 * Sitemap Generator
 *
 * Generates sitemap.xml for SEO optimization.
 * Crawls the built static site and creates a complete sitemap.
 *
 * Usage:
 *   pnpm run generate:sitemap
 *
 * Output:
 *   - docs-site/out/sitemap.xml
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(__dirname, '../../out');
const BASE_URL = 'https://metal0.github.io/mailpilot';
const SITEMAP_PATH = path.join(OUT_DIR, 'sitemap.xml');

interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

/**
 * Find all HTML files in the build output
 */
function findHtmlFiles(dir: string, baseDir: string = dir, fileList: Array<{ path: string, mtime: Date }> = []): Array<{ path: string, mtime: Date }> {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    return fileList;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip certain directories
      if (!['_next', 'api', 'images', 'gifs'].includes(file)) {
        findHtmlFiles(filePath, baseDir, fileList);
      }
    } else if (file.endsWith('.html')) {
      const relativePath = path.relative(baseDir, filePath);
      fileList.push({
        path: relativePath,
        mtime: stat.mtime
      });
    }
  }

  return fileList;
}

/**
 * Convert file path to URL
 */
function filePathToUrl(filePath: string): string {
  // Convert Windows backslashes to forward slashes
  let urlPath = filePath.replace(/\\/g, '/');

  // Remove index.html from URLs
  if (urlPath.endsWith('/index.html')) {
    urlPath = urlPath.replace('/index.html', '/');
  } else if (urlPath.endsWith('.html')) {
    urlPath = urlPath.replace('.html', '');
  }

  // Ensure starts with /
  if (!urlPath.startsWith('/')) {
    urlPath = '/' + urlPath;
  }

  return `${BASE_URL}${urlPath}`;
}

/**
 * Determine priority and change frequency based on URL
 */
function getUrlMetadata(url: string): { priority: number, changefreq: string } {
  // Homepage
  if (url === `${BASE_URL}/` || url === `${BASE_URL}/docs/`) {
    return { priority: 1.0, changefreq: 'weekly' };
  }

  // Getting started pages
  if (url.includes('/getting-started/')) {
    return { priority: 0.9, changefreq: 'weekly' };
  }

  // Main documentation sections
  if (url.includes('/configuration/') || url.includes('/email-providers/') || url.includes('/llm-providers/')) {
    return { priority: 0.8, changefreq: 'weekly' };
  }

  // API documentation (changes with code)
  if (url.includes('/api/')) {
    return { priority: 0.7, changefreq: 'daily' };
  }

  // Changelog (changes frequently)
  if (url.includes('/changelog/')) {
    return { priority: 0.6, changefreq: 'daily' };
  }

  // Other pages
  return { priority: 0.5, changefreq: 'monthly' };
}

/**
 * Generate sitemap XML
 */
function generateSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(entry => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/**
 * Main execution
 */
function main() {
  console.log('Generating sitemap...');
  console.log(`Output directory: ${OUT_DIR}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  if (!fs.existsSync(OUT_DIR)) {
    console.error('Error: Build output directory not found. Run "pnpm build" first.');
    process.exit(1);
  }

  // Find all HTML files
  const htmlFiles = findHtmlFiles(OUT_DIR);
  console.log(`Found ${htmlFiles.length} HTML pages\n`);

  if (htmlFiles.length === 0) {
    console.error('Error: No HTML files found in build output.');
    process.exit(1);
  }

  // Create sitemap entries
  const entries: SitemapEntry[] = htmlFiles.map(file => {
    const url = filePathToUrl(file.path);
    const metadata = getUrlMetadata(url);
    const lastmod = file.mtime.toISOString().split('T')[0]; // YYYY-MM-DD format

    return {
      url,
      lastmod,
      changefreq: metadata.changefreq,
      priority: metadata.priority
    };
  });

  // Sort by priority (high to low)
  entries.sort((a, b) => b.priority - a.priority);

  // Generate XML
  const xml = generateSitemapXml(entries);

  // Write sitemap
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');

  console.log(`✓ Generated: ${SITEMAP_PATH}`);
  console.log(`  ${entries.length} URLs included`);
  console.log(`  Priorities: ${entries.filter(e => e.priority >= 0.8).length} high, ${entries.filter(e => e.priority < 0.8 && e.priority >= 0.6).length} medium, ${entries.filter(e => e.priority < 0.6).length} low`);
}

main();
