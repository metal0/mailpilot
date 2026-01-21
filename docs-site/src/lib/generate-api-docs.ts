#!/usr/bin/env tsx
/**
 * API Documentation Generator
 *
 * Parses JSDoc @openapi comments from Hono routes and generates MDX documentation.
 *
 * Usage:
 *   pnpm run generate:api
 *
 * Output:
 *   - docs-site/src/content/docs/api/generated/endpoints.mdx
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const ROUTES_DIR = path.join(PROJECT_ROOT, 'src/server');
const OUTPUT_DIR = path.join(__dirname, '../content/docs/api/generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'endpoints.mdx');

interface ParsedRoute {
  path: string;
  method: string;
  summary: string;
  description: string;
  tags: string[];
  responses: Record<string, any>;
  sourceFile: string;
}

/**
 * Extract @openapi JSDoc comments from TypeScript files
 */
function extractOpenApiComments(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const comments: string[] = [];

  // Match /** ... @openapi ... */ blocks
  const openApiRegex = /\/\*\*[\s\S]*?@openapi[\s\S]*?\*\//g;
  const matches = content.matchAll(openApiRegex);

  for (const match of matches) {
    comments.push(match[0]);
  }

  return comments;
}

/**
 * Parse a JSDoc comment block to extract route information
 *
 * This is a simplified parser - a production version would use a proper
 * YAML/OpenAPI parser for the @openapi section.
 */
function parseOpenApiComment(comment: string, sourceFile: string): ParsedRoute | null {
  // Extract the YAML-like content after @openapi
  const openApiMatch = comment.match(/@openapi\s*([\s\S]*?)\*\//);
  if (!openApiMatch) return null;

  const content = openApiMatch[1];

  // Simple extraction (production would use proper YAML parser)
  const pathMatch = content.match(/^\s*(\S+):/m);
  const methodMatch = content.match(/^\s*(get|post|put|delete|patch):/m);
  const summaryMatch = content.match(/summary:\s*(.+)/);
  const descMatch = content.match(/description:\s*(.+)/);
  const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/);

  if (!pathMatch || !methodMatch) return null;

  return {
    path: pathMatch[1],
    method: methodMatch[1].toUpperCase(),
    summary: summaryMatch?.[1] || '',
    description: descMatch?.[1] || '',
    tags: tagsMatch?.[1]?.split(',').map(t => t.trim()) || [],
    responses: {}, // Would parse full response schemas in production
    sourceFile,
  };
}

/**
 * Generate MDX documentation from parsed routes
 */
function generateMDX(routes: ParsedRoute[]): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('title: API Endpoints');
  lines.push('description: Auto-generated API documentation from source code');
  lines.push('---');
  lines.push('');
  lines.push('# API Endpoints');
  lines.push('');
  lines.push('<Callout type="info">');
  lines.push('This documentation is automatically generated from JSDoc comments in the source code.');
  lines.push('Last updated: ' + new Date().toISOString());
  lines.push('</Callout>');
  lines.push('');

  // Group by tag
  const byTag = new Map<string, ParsedRoute[]>();
  for (const route of routes) {
    const tag = route.tags[0] || 'Other';
    if (!byTag.has(tag)) {
      byTag.set(tag, []);
    }
    byTag.get(tag)!.push(route);
  }

  for (const [tag, tagRoutes] of byTag) {
    lines.push(`## ${tag}`);
    lines.push('');

    for (const route of tagRoutes) {
      lines.push(`### ${route.method} ${route.path}`);
      lines.push('');
      if (route.summary) {
        lines.push(route.summary);
        lines.push('');
      }
      if (route.description) {
        lines.push(route.description);
        lines.push('');
      }
      lines.push(`**Source:** \`${route.sourceFile}\``);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Main execution
 */
function main() {
  console.log('Generating API documentation...');
  console.log('Routes directory:', ROUTES_DIR);
  console.log('Output file:', OUTPUT_FILE);

  const routes: ParsedRoute[] = [];

  // Find all TypeScript files in routes directory
  let files = fs.readdirSync(ROUTES_DIR)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => path.join(ROUTES_DIR, f));

  // Always include the comprehensive openapi-routes.ts file
  const openApiRoutesFile = path.join(ROUTES_DIR, 'openapi-routes.ts');
  if (fs.existsSync(openApiRoutesFile) && !files.includes(openApiRoutesFile)) {
    files.push(openApiRoutesFile);
  }

  console.log(`Found ${files.length} route files`);

  for (const file of files) {
    const comments = extractOpenApiComments(file);
    console.log(`  ${path.basename(file)}: ${comments.length} @openapi comments`);

    for (const comment of comments) {
      const parsed = parseOpenApiComment(comment, path.relative(PROJECT_ROOT, file));
      if (parsed) {
        routes.push(parsed);
      }
    }
  }

  console.log(`Parsed ${routes.length} API endpoints`);

  // Generate MDX
  const mdx = generateMDX(routes);

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write output
  fs.writeFileSync(OUTPUT_FILE, mdx, 'utf-8');

  console.log(`✓ Generated: ${OUTPUT_FILE}`);
  console.log(`  ${routes.length} endpoints documented`);
}

main();
