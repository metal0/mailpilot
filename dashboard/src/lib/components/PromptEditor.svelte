<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
  import { EditorState, type Extension } from "@codemirror/state";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { syntaxHighlighting, HighlightStyle, StreamLanguage } from "@codemirror/language";
  import { tags } from "@lezer/highlight";
  import type { ValidatePromptResult } from "../api";
  import { t } from "../i18n/index";

  interface Props {
    value: string;
    onchange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    validation?: ValidatePromptResult | null;
    minHeight?: string;
    maxHeight?: string;
  }

  let {
    value,
    onchange,
    placeholder = "",
    disabled = false,
    validation = null,
    minHeight = "200px",
    maxHeight = "400px",
  }: Props = $props();

  let editorContainer: HTMLDivElement;
  let editorView: EditorView | null = null;
  let isExpanded = $state(false);

  const charCount = $derived(value.length);
  const wordCount = $derived(value.split(/\s+/).filter(Boolean).length);
  const estimatedTokens = $derived(Math.ceil(charCount / 4));
  const isOverLimit = $derived(charCount > 4000);

  const actionKeywords = ["move", "spam", "flag", "read", "delete", "noop"];

  const promptHighlightStyle = HighlightStyle.define([
    { tag: tags.heading1, color: "var(--accent)", fontWeight: "bold" },
    { tag: tags.heading2, color: "var(--accent)", fontWeight: "bold" },
    { tag: tags.heading3, color: "var(--accent)", fontWeight: "bold" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strong, fontWeight: "bold" },
    { tag: tags.link, color: "var(--info)" },
    { tag: tags.monospace, background: "var(--bg-tertiary)", borderRadius: "2px" },
  ]);

  const darkTheme = EditorView.theme({
    "&": {
      backgroundColor: "var(--bg-tertiary)",
      color: "var(--text-primary)",
      fontSize: "0.875rem",
      fontFamily: "var(--font-mono, monospace)",
    },
    ".cm-content": {
      caretColor: "var(--text-primary)",
      padding: "0.75rem",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--text-primary)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--accent-muted, rgba(59, 130, 246, 0.3))",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-secondary)",
      color: "var(--text-muted)",
      borderRight: "1px solid var(--border-color)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--bg-tertiary)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-placeholder": {
      color: "var(--text-muted)",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
  }, { dark: true });

  function createEditor() {
    if (!editorContainer) return;

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown(),
      syntaxHighlighting(promptHighlightStyle),
      darkTheme,
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString();
          if (newValue !== value) {
            onchange(newValue);
          }
        }
      }),
    ];

    if (placeholder) {
      extensions.push(EditorView.contentAttributes.of({ "aria-placeholder": placeholder }));
    }

    if (disabled) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    editorView = new EditorView({
      state,
      parent: editorContainer,
    });
  }

  function destroyEditor() {
    if (editorView) {
      editorView.destroy();
      editorView = null;
    }
  }

  $effect(() => {
    if (editorView) {
      const currentDoc = editorView.state.doc.toString();
      if (value !== currentDoc) {
        editorView.dispatch({
          changes: {
            from: 0,
            to: currentDoc.length,
            insert: value,
          },
        });
      }
    }
  });

  onMount(() => {
    createEditor();
  });

  onDestroy(() => {
    destroyEditor();
  });

  function toggleExpand() {
    isExpanded = !isExpanded;
  }
</script>

<div class="prompt-editor" class:expanded={isExpanded}>
  <div class="editor-toolbar">
    <div class="stats">
      <span class:warning={isOverLimit}>
        {charCount} {$t("sandbox.chars")}
      </span>
      <span class="separator">|</span>
      <span>{wordCount} {$t("sandbox.words")}</span>
      <span class="separator">|</span>
      <span>~{estimatedTokens} {$t("sandbox.tokens")}</span>
    </div>
    <button
      type="button"
      class="expand-btn"
      onclick={toggleExpand}
      title={isExpanded ? $t("sandbox.collapse") : $t("sandbox.expand")}
      aria-label={isExpanded ? $t("sandbox.collapse") : $t("sandbox.expand")}
    >
      {#if isExpanded}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 14 10 14 10 20" />
          <polyline points="20 10 14 10 14 4" />
          <line x1="14" y1="10" x2="21" y2="3" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      {/if}
    </button>
  </div>

  <div
    class="editor-container"
    bind:this={editorContainer}
    style="min-height: {isExpanded ? '60vh' : minHeight}; max-height: {isExpanded ? '80vh' : maxHeight};"
  ></div>

  {#if validation}
    <div class="validation-feedback">
      {#if validation.errors.length > 0}
        <div class="validation-errors">
          {#each validation.errors as error}
            <div class="validation-item error">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" stroke="white" stroke-width="2" />
                <line x1="9" y1="9" x2="15" y2="15" stroke="white" stroke-width="2" />
              </svg>
              <span>{error.message}</span>
            </div>
          {/each}
        </div>
      {/if}
      {#if validation.warnings.length > 0}
        <div class="validation-warnings">
          {#each validation.warnings as warning}
            <div class="validation-item warning">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L1 21h22L12 2z" />
                <line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2" />
                <circle cx="12" cy="17" r="1" fill="white" />
              </svg>
              <span>{warning.message}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .prompt-editor {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md, 0.375rem);
    overflow: hidden;
    background: var(--bg-tertiary);
  }

  .prompt-editor.expanded {
    position: fixed;
    inset: 1rem;
    z-index: 100;
    border-radius: var(--radius-lg, 0.5rem);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .editor-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    font-size: 0.75rem;
  }

  .stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
  }

  .stats .warning {
    color: var(--warning);
    font-weight: 500;
  }

  .separator {
    color: var(--border-color);
  }

  .expand-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm, 0.25rem);
  }

  .expand-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .expand-btn svg {
    width: 1rem;
    height: 1rem;
  }

  .editor-container {
    flex: 1;
    overflow: hidden;
  }

  .editor-container :global(.cm-editor) {
    height: 100%;
  }

  .editor-container :global(.cm-scroller) {
    font-family: var(--font-mono, "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace);
  }

  .validation-feedback {
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
  }

  .validation-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.8125rem;
    padding: 0.25rem 0;
  }

  .validation-item svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .validation-item.error {
    color: var(--error);
  }

  .validation-item.warning {
    color: var(--warning);
  }

  .validation-errors + .validation-warnings {
    margin-top: 0.25rem;
  }
</style>
