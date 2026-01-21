#!/usr/bin/env tsx
/**
 * Changelog Generator
 *
 * Generates changelog from git tags and commits using conventional commits format.
 *
 * Usage:
 *   pnpm run generate:changelog
 *
 * Output:
 *   - docs-site/src/content/docs/changelog/generated.mdx
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const OUTPUT_DIR = path.join(__dirname, '../content/docs/changelog');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'generated.mdx');

interface GitTag {
  name: string;
  date: string;
  commit: string;
}

interface Commit {
  hash: string;
  type: string;
  scope?: string;
  subject: string;
  body?: string;
  breaking: boolean;
  date: string;
}

/**
 * Get all git tags sorted by date
 */
function getTags(): GitTag[] {
  try {
    const output = execSync(
      'git tag --sort=-creatordate --format=%(refname:short)|%(creatordate:iso)|%(objectname:short)',
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );

    return output
      .trim()
      .split('\n')
      .filter(line => line)
      .map(line => {
        const [name, date, commit] = line.split('|');
        return { name, date, commit };
      });
  } catch (error) {
    console.warn('No git tags found or git not available');
    return [];
  }
}

/**
 * Get commits between two refs (or from ref to HEAD)
 */
function getCommits(from: string, to: string = 'HEAD'): Commit[] {
  try {
    const range = `${from}..${to}`;
    const output = execSync(
      `git log ${range} --format=%H|%s|%b|%aI --no-merges`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );

    return output
      .trim()
      .split('\n')
      .filter(line => line)
      .map(line => {
        const [hash, subject, body, date] = line.split('|');
        return parseCommit(hash, subject, body, date);
      })
      .filter(commit => commit !== null) as Commit[];
  } catch (error) {
    console.warn(`Could not get commits for range ${from}..${to}`);
    return [];
  }
}

/**
 * Parse a commit message using conventional commits format
 */
function parseCommit(hash: string, subject: string, body: string, date: string): Commit | null {
  // Conventional commit format: type(scope): subject
  const match = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);

  if (!match) {
    // Not a conventional commit, skip it
    return null;
  }

  const [, type, scope, cleanSubject] = match;

  // Check for breaking changes
  const breaking = subject.includes('!:') ||
                   body?.toLowerCase().includes('breaking change') ||
                   body?.toLowerCase().includes('breaking:') || false;

  return {
    hash,
    type,
    scope,
    subject: cleanSubject,
    body,
    breaking,
    date,
  };
}

/**
 * Group commits by type
 */
function groupByType(commits: Commit[]): Map<string, Commit[]> {
  const groups = new Map<string, Commit[]>();

  for (const commit of commits) {
    if (!groups.has(commit.type)) {
      groups.set(commit.type, []);
    }
    groups.get(commit.type)!.push(commit);
  }

  return groups;
}

/**
 * Generate MDX for changelog
 */
function generateMDX(tags: GitTag[]): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('title: Changelog (Generated)');
  lines.push('description: Auto-generated changelog from git history');
  lines.push('---');
  lines.push('');
  lines.push('# Auto-Generated Changelog');
  lines.push('');
  lines.push('<Callout type="info">');
  lines.push('This changelog is automatically generated from git tags and commit messages.');
  lines.push('Last updated: ' + new Date().toISOString());
  lines.push('</Callout>');
  lines.push('');

  // Type labels
  const typeLabels: Record<string, string> = {
    feat: '✨ Features',
    fix: '🐛 Bug Fixes',
    docs: '📝 Documentation',
    style: '💎 Styling',
    refactor: '♻️ Refactoring',
    perf: '⚡ Performance',
    test: '✅ Tests',
    build: '🔨 Build',
    ci: '👷 CI/CD',
    chore: '🔧 Chores',
  };

  if (tags.length === 0) {
    lines.push('## Unreleased');
    lines.push('');
    lines.push('No tagged releases yet. See [commit history](https://github.com/metal0/mailpilot/commits/master) for recent changes.');
    lines.push('');
  } else {
    // Latest unreleased changes
    const unreleasedCommits = getCommits(tags[0].commit);
    if (unreleasedCommits.length > 0) {
      lines.push('## Unreleased');
      lines.push('');
      lines.push(`Changes since ${tags[0].name}:`);
      lines.push('');
      addCommitSection(lines, unreleasedCommits, typeLabels);
    }

    // Released versions
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const nextTag = tags[i + 1];

      lines.push(`## ${tag.name}`);
      lines.push('');
      lines.push(`**Released:** ${new Date(tag.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`);
      lines.push('');

      if (nextTag) {
        const commits = getCommits(nextTag.commit, tag.commit);
        addCommitSection(lines, commits, typeLabels);
      } else {
        lines.push('Initial release.');
        lines.push('');
      }
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## Contributing');
  lines.push('');
  lines.push('We follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.');
  lines.push('');

  return lines.join('\n');
}

function addCommitSection(lines: string[], commits: Commit[], typeLabels: Record<string, string>) {
  // Breaking changes first
  const breaking = commits.filter(c => c.breaking);
  if (breaking.length > 0) {
    lines.push('### 🚨 Breaking Changes');
    lines.push('');
    for (const commit of breaking) {
      const scope = commit.scope ? `**${commit.scope}:** ` : '';
      lines.push(`- ${scope}${commit.subject} ([${commit.hash.substring(0, 7)}](https://github.com/metal0/mailpilot/commit/${commit.hash}))`);
    }
    lines.push('');
  }

  // Group by type
  const groups = groupByType(commits.filter(c => !c.breaking));

  // Order types by importance
  const orderedTypes = ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'style'];

  for (const type of orderedTypes) {
    const typeCommits = groups.get(type);
    if (!typeCommits || typeCommits.length === 0) continue;

    lines.push(`### ${typeLabels[type] || type}`);
    lines.push('');

    for (const commit of typeCommits) {
      const scope = commit.scope ? `**${commit.scope}:** ` : '';
      lines.push(`- ${scope}${commit.subject} ([${commit.hash.substring(0, 7)}](https://github.com/metal0/mailpilot/commit/${commit.hash}))`);
    }
    lines.push('');
  }
}

/**
 * Main execution
 */
function main() {
  console.log('Generating changelog...');
  console.log('Project root:', PROJECT_ROOT);
  console.log('Output file:', OUTPUT_FILE);

  const tags = getTags();
  console.log(`Found ${tags.length} git tags`);

  const mdx = generateMDX(tags);

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write output
  fs.writeFileSync(OUTPUT_FILE, mdx, 'utf-8');

  console.log(`✓ Generated: ${OUTPUT_FILE}`);
}

main();
