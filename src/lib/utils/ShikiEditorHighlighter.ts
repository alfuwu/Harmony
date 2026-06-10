/**
 * Incremental, grammar-state-aware Shiki syntax highlighter for Slate.
 *
 * v3 — O(n²) → O(n log n) + debounce
 * ─────────────────────────────────────
 * Root cause of v2 lag: even though tokenisation was already chunk-based,
 * MessageInput's `decorate` was called O(n) times per re-render (once per
 * text node), and EACH call did:
 *   • O(i) nodeStart loop through previous Slate children
 *   • O(i) getDecorations linear scan to the matching line
 * Sum: 0+1+…+(n-1) = n²/2 operations.  For n=1000 that's ~100 ms of pure JS
 * PER RENDER, which is called on every Shiki notify().
 *
 * v3 fixes:
 *   1. DEBOUNCE  – update() is now fire-and-forget synchronous; actual
 *      tokenisation is deferred by DEBOUNCE_MS.  Rapid keystrokes cancel each
 *      other and produce exactly one Shiki pass after the burst.
 *   2. lineOffsets – precomputed cumulative line-start byte offsets stored in
 *      the cache.  getDecorations() binary-searches this array → O(log n).
 *   3. WeakMap in MessageInput.decorate (see that file) – caches the per-child
 *      start-offset array keyed by the Slate block reference.  Slate's
 *      immutable updates guarantee a fresh reference whenever content changes,
 *      so the cache is always either fresh or immediately invalidated.
 *      nodeStart lookup becomes O(1) per call, O(n) once per changed block.
 *
 * External API is identical to v1/v2.
 */

import type { GrammarState, HighlighterCore, ThemedToken } from 'shiki';
import { LANG_ALIASES, SPECIAL_LANGS } from './MarkdownRenderer';

// ─────────────────────────────────────────── public types ────────────────────

export interface SlimToken {
  /** Character offset within the LINE (not the block). */
  offset:    number;
  length:    number;
  color:     string;
  /** vscode-textmate FontStyle bitmask: 1=italic 2=bold 4=underline */
  fontStyle: number;
}

export interface ShikiDecoration {
  /** Offset relative to the Slate text-node start. */
  offset:    number;
  length:    number;
  color:     string;
  fontStyle: number;
}

// ─────────────────────────────────────────── private types ───────────────────

interface CachedLine {
  text:   string;
  tokens: SlimToken[];
}

interface BlockCache {
  language:    string;
  theme:       string;
  fullText:    string;
  lines:       (CachedLine | undefined)[];
  /**
   * lineOffsets[i] = absolute byte offset of line i within fullText.
   * Used by getDecorations() for O(log n) binary search.
   */
  lineOffsets: number[];
  /**
   * Grammar state at the START of chunk c.
   * chunkStates[0]   = undefined  (language initial state).
   * chunkStates[c+1] = result.grammarState from tokenising chunk c.
   */
  chunkStates: (GrammarState | undefined)[];
}

// ─────────────────────────────────────────── constants / helpers ─────────────

/** Lines per codeToTokens() call. */
const CHUNK_SIZE = 100;

/**
 * Milliseconds to wait after the last update() call before actually running
 * tokenisation.  Coalesces rapid keystrokes into a single pass.
 * 16 ms ≈ one animation frame — imperceptible, but very effective.
 */
const DEBOUNCE_MS = 16;

function yieldToMain(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

/**
 * Binary search: returns the largest index i such that arr[i] <= target.
 * Assumes arr is sorted ascending.  Returns 0 for empty or all-greater arrays.
 */
function bsearchFloor(arr: number[], target: number): number {
  if (arr.length === 0) return 0;
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (arr[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Compute absolute byte offsets for each line within a chunk.
 * Shiki's token.offset is absolute within the joined chunk string, so we
 * subtract lineStarts[j] to recover a line-relative offset.
 */
function computeLineStarts(lines: string[]): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < lines.length - 1; i++) {
    starts.push(starts[i] + lines[i].length + 1); // +1 for '\n'
  }
  return starts;
}

/**
 * Grammar-state equality via scope-stack comparison.
 * If the scope stacks are identical, any subsequent input tokenises
 * identically — correct early-termination criterion in practice.
 */
function grammarStatesEqual(
  a: GrammarState | undefined,
  b: GrammarState | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    const sa = a.getInternalStack();
    const sb = b.getInternalStack();
    if ((sa?.depth ?? 0) !== (sb?.depth ?? 0)) return false;
    const scopesA = a.getScopes();
    const scopesB = b.getScopes();
    if (!scopesA && !scopesB) return true;
    if (!scopesA || !scopesB || scopesA.length !== scopesB.length) return false;
    for (let i = 0; i < scopesA.length; i++) {
      if (scopesA[i] !== scopesB[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export class ShikiEditorHighlighter {
  private readonly ensureLoaded: (lang: string) => Promise<boolean>;

  private caches        = new Map<number, BlockCache>();
  private pending       = new Map<number, AbortController>();
  private debounceTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private listeners     = new Set<() => void>();

  constructor(ensureLoaded: (lang: string) => Promise<boolean>) {
    this.ensureLoaded = ensureLoaded;
  }

  // ─────────────────────────────────────────────────────── public API ───────

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * O(log n + k) — binary-search the precomputed lineOffsets to find the
   * first relevant line, then iterate only the lines that overlap the node.
   * For single-line text nodes (the common case) k=1, so this is O(log n).
   * Across all n text nodes of a code block the total is O(n log n).
   *
   * @param blockIndex  Index of the code-block in editor.children.
   * @param nodeStart   Absolute char offset of this text-node within the block.
   * @param nodeLength  Character length of this text-node.
   */
  getDecorations(
    blockIndex: number,
    nodeStart:  number,
    nodeLength: number,
  ): ShikiDecoration[] {
    const cache = this.caches.get(blockIndex);
    if (!cache?.lineOffsets.length) return [];

    const startIdx = bsearchFloor(cache.lineOffsets, nodeStart);
    const out: ShikiDecoration[] = [];

    for (let i = startIdx; i < cache.lines.length; i++) {
      const line = cache.lines[i];
      if (!line) break;
      const lineStart = cache.lineOffsets[i];
      if (lineStart >= nodeStart + nodeLength) break;

      for (const tok of line.tokens) {
        const absStart  = lineStart + tok.offset;
        const absEnd    = absStart  + tok.length;
        const clipStart = Math.max(absStart, nodeStart);
        const clipEnd   = Math.min(absEnd,   nodeStart + nodeLength);
        if (clipStart < clipEnd) {
          out.push({
            offset:    clipStart - nodeStart,
            length:    clipEnd   - clipStart,
            color:     tok.color,
            fontStyle: tok.fontStyle,
          });
        }
      }
    }

    return out;
  }

  /**
   * Synchronous — schedules tokenisation behind a debounce.
   *
   * If called again within DEBOUNCE_MS the previous scheduled run is
   * cancelled and the timer resets.  The AbortController ensures that even
   * in-progress async work is discarded as soon as a newer call arrives.
   */
  update(
    blockIndex:  number,
    content:     string,
    rawLang:     string,
    theme:       string,
    highlighter: HighlighterCore,
  ): void {
    // Fast-path: skip if absolutely nothing changed.
    const cache = this.caches.get(blockIndex);
    if (
      cache?.fullText === content &&
      cache.language  === rawLang &&
      cache.theme     === theme
    ) return;

    // Cancel any running tokenisation job for this block.
    this.pending.get(blockIndex)?.abort();

    // Create the new controller upfront so clear() can abort even the pending
    // debounced job.
    const ctrl = new AbortController();
    this.pending.set(blockIndex, ctrl);

    // Debounce: reset the timer on each call.
    clearTimeout(this.debounceTimers.get(blockIndex));
    this.debounceTimers.set(
      blockIndex,
      setTimeout(() => {
        this.debounceTimers.delete(blockIndex);
        if (!ctrl.signal.aborted) {
          this._tokenize(blockIndex, content, rawLang, theme, ctrl, highlighter);
        }
      }, DEBOUNCE_MS),
    );
  }

  clear(blockIndex: number): void {
    clearTimeout(this.debounceTimers.get(blockIndex));
    this.debounceTimers.delete(blockIndex);
    this.pending.get(blockIndex)?.abort();
    this.pending.delete(blockIndex);
    this.caches.delete(blockIndex);
  }

  clearAll(): void {
    this.debounceTimers.forEach(t => clearTimeout(t));
    this.debounceTimers.clear();
    this.pending.forEach(c => c.abort());
    this.pending.clear();
    this.caches.clear();
  }

  // ─────────────────────────────────────────────────────── private ──────────

  private notify(): void {
    this.listeners.forEach(cb => cb());
  }

  private async _tokenize(
    blockIndex:  number,
    content:     string,
    rawLang:     string,
    theme:       string,
    ctrl:        AbortController,
    highlighter: HighlighterCore,
  ): Promise<void> {
    const cache = this.caches.get(blockIndex);

    const lang = await this.resolveLanguage(rawLang, highlighter);
    if (ctrl.signal.aborted) return;

    const newLines    = content.split('\n');
    const n           = newLines.length;
    const numChunks   = Math.ceil(n / CHUNK_SIZE) || 1;
    const oldLen      = cache?.lines.length ?? 0;
    const langChanged = !cache || cache.language !== rawLang || cache.theme !== theme;

    // Working copies — never mutate the live cache while a render might be
    // calling getDecorations() on it.
    const lines: (CachedLine | undefined)[] = langChanged
      ? new Array(n).fill(undefined)
      : cache!.lines.slice();
    while (lines.length < n) lines.push(undefined);

    const chunkStates: (GrammarState | undefined)[] = langChanged
      ? new Array(numChunks + 1).fill(undefined)
      : cache!.chunkStates.slice();
    while (chunkStates.length < numChunks + 1) chunkStates.push(undefined);

    // Locate first changed line → first chunk to (re-)tokenise.
    let startLine = 0;
    if (!langChanged && cache) {
      while (
        startLine < n &&
        startLine < oldLen &&
        newLines[startLine] === cache.lines[startLine]?.text
      ) startLine++;
    }
    const startChunk = Math.floor(startLine / CHUNK_SIZE);

    // ── main tokenisation loop ───────────────────────────────────────────────
    for (let c = startChunk; c < numChunks; c++) {
      if (ctrl.signal.aborted) return;

      if (c !== startChunk) {
        await yieldToMain();
        if (ctrl.signal.aborted) return;
      }

      const chunkStart = c * CHUNK_SIZE;
      const chunkEnd   = Math.min((c + 1) * CHUNK_SIZE, n);

      // ── chunk-level early termination ──────────────────────────────────────
      // After processing chunk c-1 we wrote a new state into chunkStates[c].
      // If that new state equals the OLD cached state (cache.chunkStates[c]),
      // every subsequent unchanged line will tokenise identically → stop.
      // Guard: only when all lines in this chunk existed in the old cache.
      if (c > startChunk && chunkEnd <= oldLen) {
        if (grammarStatesEqual(chunkStates[c], cache!.chunkStates[c])) {
          if (n > oldLen) {
            const firstNewChunk = Math.floor(oldLen / CHUNK_SIZE);
            if (firstNewChunk > c) {
              c = firstNewChunk - 1;
              continue;
            }
          }
          break;
        }
      }

      // ── tokenise chunk ──────────────────────────────────────────────────────
      const chunkLines = newLines.slice(chunkStart, chunkEnd);
      const chunkText  = chunkLines.join('\n');

      let result: { tokens: ThemedToken[][]; grammarState?: GrammarState };
      try {
        result = highlighter.codeToTokens(chunkText, {
          lang,
          theme,
          grammarState: chunkStates[c],
        });
      } catch {
        for (let j = 0; j < chunkLines.length; j++) {
          lines[chunkStart + j] = { text: chunkLines[j], tokens: [] };
        }
        chunkStates[c + 1] = undefined;
        continue;
      }

      // Shiki returns token.offset as absolute within the joined chunk string.
      // Subtract lineStarts[j] to recover the line-relative offset.
      const lineStarts     = computeLineStarts(chunkLines);
      const numResultLines = Math.min(result.tokens.length, chunkLines.length);

      for (let j = 0; j < numResultLines; j++) {
        const lineIdx   = chunkStart + j;
        const rawTokens = result.tokens[j] ?? [];
        lines[lineIdx] = {
          text: chunkLines[j],
          tokens: rawTokens
            .filter(t => t.content.length > 0)
            .map(t => ({
              offset:    t.offset - lineStarts[j],
              length:    t.content.length,
              color:     t.color     ?? '',
              fontStyle: t.fontStyle ?? 0,
            })),
        };
      }

      chunkStates[c + 1] = result.grammarState;
    }

    if (ctrl.signal.aborted) return;

    lines.length       = n;
    chunkStates.length = numChunks + 1;

    // Precompute cumulative line-start offsets for O(log n) getDecorations().
    const lineOffsets: number[] = [0];
    for (let i = 0; i < n - 1; i++) {
      lineOffsets.push(lineOffsets[i] + (lines[i]?.text.length ?? 0) + 1);
    }

    this.caches.set(blockIndex, {
      language:    rawLang,
      theme,
      fullText:    content,
      lines,
      lineOffsets,
      chunkStates,
    });

    this.notify();
  }

  private async resolveLanguage(
    raw: string,
    highlighter: HighlighterCore,
  ): Promise<string> {
    const lang = (LANG_ALIASES[raw.toLowerCase()] ?? raw.toLowerCase()).trim();
    if (SPECIAL_LANGS.has(lang)) return 'text';
    const ok = await this.ensureLoaded(lang);
    if (!ok) return 'text';
    try { highlighter.getLanguage(lang); return lang; }
    catch { return 'text'; }
  }
}
