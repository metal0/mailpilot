'use client';

import { useState } from 'react';

interface VersionDiffProps {
  v1Code: string;
  v2Code: string;
  breakingChange: string;
  migration?: string;
}

type ViewMode = 'v1' | 'v2' | 'diff';

export function VersionDiff({ v1Code, v2Code, breakingChange, migration }: VersionDiffProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('diff');

  return (
    <div className="not-prose my-6 border rounded-lg overflow-hidden">
      {/* Warning callout */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 p-4">
        <div className="flex items-start gap-3">
          <div className="text-yellow-600 dark:text-yellow-500 text-xl">⚠️</div>
          <div className="flex-1">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
              Breaking Change in v2.x
            </h4>
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              {breakingChange}
            </p>
          </div>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="bg-muted border-b flex">
        <button
          onClick={() => setViewMode('v1')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'v1'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          v1.x (Old)
        </button>
        <button
          onClick={() => setViewMode('v2')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'v2'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          v2.x (New)
        </button>
        <button
          onClick={() => setViewMode('diff')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'diff'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Diff View
        </button>
      </div>

      {/* Code display */}
      <div className="bg-card">
        {viewMode === 'v1' && (
          <CodeBlock code={v1Code} label="v1.x Configuration" />
        )}

        {viewMode === 'v2' && (
          <CodeBlock code={v2Code} label="v2.x Configuration" />
        )}

        {viewMode === 'diff' && (
          <DiffView v1={v1Code} v2={v2Code} />
        )}
      </div>

      {/* Migration guide */}
      {migration && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 dark:text-blue-500 text-xl">ℹ️</div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Migration Guide
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {migration}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="p-4">
      <div className="text-xs text-muted-foreground mb-2 font-medium">{label}</div>
      <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function DiffView({ v1, v2 }: { v1: string; v2: string }) {
  const v1Lines = v1.split('\n');
  const v2Lines = v2.split('\n');

  // Simple diff algorithm
  const diff = computeDiff(v1Lines, v2Lines);

  return (
    <div className="p-4">
      <div className="text-xs text-muted-foreground mb-2 font-medium">
        Side-by-Side Comparison
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* v1 column */}
        <div>
          <div className="text-xs font-medium mb-2 text-red-600 dark:text-red-400">
            v1.x (Removed)
          </div>
          <div className="bg-muted rounded overflow-hidden">
            {diff.map((line, idx) => (
              <DiffLine
                key={`v1-${idx}`}
                line={line.v1 || ''}
                type={line.type === 'removed' || line.type === 'changed' ? 'removed' : 'unchanged'}
                lineNumber={line.v1LineNumber}
              />
            ))}
          </div>
        </div>

        {/* v2 column */}
        <div>
          <div className="text-xs font-medium mb-2 text-green-600 dark:text-green-400">
            v2.x (Added)
          </div>
          <div className="bg-muted rounded overflow-hidden">
            {diff.map((line, idx) => (
              <DiffLine
                key={`v2-${idx}`}
                line={line.v2 || ''}
                type={line.type === 'added' || line.type === 'changed' ? 'added' : 'unchanged'}
                lineNumber={line.v2LineNumber}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiffLine({
  line,
  type,
  lineNumber,
}: {
  line: string;
  type: 'added' | 'removed' | 'unchanged';
  lineNumber?: number;
}) {
  const bgClass =
    type === 'added'
      ? 'bg-green-100 dark:bg-green-900/30'
      : type === 'removed'
      ? 'bg-red-100 dark:bg-red-900/30'
      : '';

  const textClass =
    type === 'added'
      ? 'text-green-800 dark:text-green-200'
      : type === 'removed'
      ? 'text-red-800 dark:text-red-200'
      : 'text-foreground';

  const icon = type === 'added' ? '+' : type === 'removed' ? '-' : ' ';

  if (!line && type === 'unchanged') {
    return null; // Skip empty unchanged lines
  }

  return (
    <div className={`${bgClass} font-mono text-xs px-3 py-1 flex items-start gap-2`}>
      <span className="text-muted-foreground w-8 text-right flex-shrink-0">
        {lineNumber}
      </span>
      <span className={`w-4 flex-shrink-0 font-bold ${textClass}`}>
        {icon}
      </span>
      <span className={`flex-1 whitespace-pre ${textClass}`}>
        {line || '\u00A0'}
      </span>
    </div>
  );
}

interface DiffLine {
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  v1?: string;
  v2?: string;
  v1LineNumber?: number;
  v2LineNumber?: number;
}

function computeDiff(v1Lines: string[], v2Lines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  let v1Idx = 0;
  let v2Idx = 0;

  while (v1Idx < v1Lines.length || v2Idx < v2Lines.length) {
    const v1Line = v1Lines[v1Idx];
    const v2Line = v2Lines[v2Idx];

    if (v1Line === v2Line) {
      // Unchanged line
      result.push({
        type: 'unchanged',
        v1: v1Line,
        v2: v2Line,
        v1LineNumber: v1Idx + 1,
        v2LineNumber: v2Idx + 1,
      });
      v1Idx++;
      v2Idx++;
    } else if (v1Idx >= v1Lines.length) {
      // Added line (only in v2)
      result.push({
        type: 'added',
        v1: '',
        v2: v2Line,
        v2LineNumber: v2Idx + 1,
      });
      v2Idx++;
    } else if (v2Idx >= v2Lines.length) {
      // Removed line (only in v1)
      result.push({
        type: 'removed',
        v1: v1Line,
        v2: '',
        v1LineNumber: v1Idx + 1,
      });
      v1Idx++;
    } else {
      // Check if next lines match (simple lookahead)
      const v1NextMatch = v2Lines.indexOf(v1Line, v2Idx);
      const v2NextMatch = v1Lines.indexOf(v2Line, v1Idx);

      if (v1NextMatch !== -1 && (v2NextMatch === -1 || v1NextMatch < v2NextMatch)) {
        // v1 line appears later in v2, so v2 has added lines
        result.push({
          type: 'added',
          v1: '',
          v2: v2Line,
          v2LineNumber: v2Idx + 1,
        });
        v2Idx++;
      } else if (v2NextMatch !== -1) {
        // v2 line appears later in v1, so v1 has removed lines
        result.push({
          type: 'removed',
          v1: v1Line,
          v2: '',
          v1LineNumber: v1Idx + 1,
        });
        v1Idx++;
      } else {
        // Changed line
        result.push({
          type: 'changed',
          v1: v1Line,
          v2: v2Line,
          v1LineNumber: v1Idx + 1,
          v2LineNumber: v2Idx + 1,
        });
        v1Idx++;
        v2Idx++;
      }
    }
  }

  return result;
}
