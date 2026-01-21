#!/usr/bin/env tsx
/**
 * OpenAPI JSON Generator
 *
 * Parses JSDoc @openapi comments from Hono routes and generates a complete
 * OpenAPI 3.0 JSON specification.
 *
 * Usage:
 *   pnpm run generate:openapi
 *
 * Output:
 *   - docs-site/public/openapi.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const ROUTES_DIR = path.join(PROJECT_ROOT, 'src/server');
const OUTPUT_FILE = path.join(__dirname, '../../public/openapi.json');

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    securitySchemes: Record<string, any>;
    schemas: Record<string, any>;
  };
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
 * Parse a JSDoc comment block to extract OpenAPI YAML
 */
function parseOpenApiComment(comment: string): any {
  // Extract the YAML-like content after @openapi
  const openApiMatch = comment.match(/@openapi\s*([\s\S]*?)\*\//);
  if (!openApiMatch) return null;

  let yamlContent = openApiMatch[1];

  // Clean up the YAML content
  yamlContent = yamlContent
    .split('\n')
    .map(line => {
      // Remove leading asterisks and extra spaces
      return line.replace(/^\s*\*\s?/, '');
    })
    .join('\n');

  try {
    const parsed = YAML.parse(yamlContent);
    return parsed;
  } catch (err) {
    console.error(`Failed to parse OpenAPI YAML: ${(err as Error).message}`);
    console.error('Content:', yamlContent);
    return null;
  }
}

/**
 * Merge path objects from multiple routes
 */
function mergePaths(paths: Record<string, any>[]): Record<string, any> {
  const merged: Record<string, any> = {};

  for (const pathObj of paths) {
    if (!pathObj) continue;

    for (const [path, methods] of Object.entries(pathObj)) {
      if (!merged[path]) {
        merged[path] = {};
      }

      // Merge methods for this path
      Object.assign(merged[path], methods);
    }
  }

  return merged;
}

/**
 * Extract components (schemas, security schemes) from parsed objects
 */
function extractComponents(parsedObjects: any[]): OpenAPISpec['components'] {
  const components: OpenAPISpec['components'] = {
    securitySchemes: {},
    schemas: {}
  };

  for (const obj of parsedObjects) {
    if (obj && obj.components) {
      if (obj.components.securitySchemes) {
        Object.assign(components.securitySchemes, obj.components.securitySchemes);
      }
      if (obj.components.schemas) {
        Object.assign(components.schemas, obj.components.schemas);
      }
    }
  }

  return components;
}

/**
 * Generate complete OpenAPI specification
 */
function generateOpenAPISpec(routes: any[]): OpenAPISpec {
  const paths = mergePaths(routes);
  const components = extractComponents(routes);

  const spec: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Mailpilot API',
      version: '1.0.0',
      description: 'REST API for the Mailpilot email processing daemon. Provides endpoints for managing email accounts, viewing statistics, configuring settings, and testing classification.',
      contact: {
        name: 'Mailpilot',
        url: 'https://github.com/metal0/mailpilot'
      }
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Development server'
      },
      {
        url: 'https://your-server.example.com',
        description: 'Production server'
      }
    ],
    paths,
    components
  };

  return spec;
}

/**
 * Main execution
 */
function main() {
  console.log('Generating OpenAPI JSON specification...');
  console.log('Routes directory:', ROUTES_DIR);
  console.log('Output file:', OUTPUT_FILE);

  const routes: any[] = [];

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
      const parsed = parseOpenApiComment(comment);
      if (parsed) {
        routes.push(parsed);
      }
    }
  }

  console.log(`Parsed ${routes.length} OpenAPI definitions`);

  // Generate complete spec
  const spec = generateOpenAPISpec(routes);

  // Write output
  const json = JSON.stringify(spec, null, 2);
  fs.writeFileSync(OUTPUT_FILE, json, 'utf-8');

  console.log(`✓ Generated: ${OUTPUT_FILE}`);
  console.log(`  ${Object.keys(spec.paths).length} endpoints documented`);
  console.log(`  ${Object.keys(spec.components.schemas).length} schemas defined`);
  console.log(`  ${Object.keys(spec.components.securitySchemes).length} security schemes`);
}

main();
