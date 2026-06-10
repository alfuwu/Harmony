import type { GrammarState, HighlighterCore, ThemedToken } from 'shiki';
import { LANG_ALIASES, SPECIAL_LANGS } from './MarkdownRenderer';

export interface SlimToken {
  offset: number;
  length: number;
  color: string;
  fontStyle: number;
}

interface CachedLine {
  text: string;
  tokens: SlimToken[];
}

interface BlockCache {
  language: string;
  theme: string;
  fullText: string;
  lines: (CachedLine | undefined)[];
  lineOffsets: number[];
  chunkStates: (GrammarState | undefined)[];
}

type Listener = (blockIndex: number) => void;

const CHUNK_SIZE  = 100;
const DEBOUNCE_MS = 16;

function yieldToMain(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tokenCss(tok: SlimToken): string {
  const p: string[] = [];
  if (tok.color) p.push(`color:${tok.color}`);
  if (tok.fontStyle & 1) p.push('font-style:italic');
  if (tok.fontStyle & 2) p.push('font-weight:bold');
  if (tok.fontStyle & 4) p.push('text-decoration:underline');
  return p.join(';');
}

function computeLineStarts(lines: string[]): number[] {
  const s: number[] = [0];
  for (let i = 0; i < lines.length - 1; i++)
    s.push(s[i] + lines[i].length + 1);
  return s;
}

function computeLineOffsets(lines: (CachedLine | undefined)[], n: number): number[] {
  const o: number[] = [0];
  for (let i = 0; i < n - 1; i++)
    o.push(o[i] + (lines[i]?.text.length ?? 0) + 1);
  return o;
}

function grammarStatesEqual(a: GrammarState | undefined, b: GrammarState | undefined): boolean {
  if (a === b)
    return true;
  if (!a || !b)
    return false;
  
  try {
    const sa = a.getInternalStack();
    const sb = b.getInternalStack();
    
    if ((sa?.depth ?? 0) !== (sb?.depth ?? 0))
      return false;
    
    const scopesA = a.getScopes();
    const scopesB = b.getScopes();
    
    if (!scopesA && !scopesB)
      return true;
    if (!scopesA || !scopesB || scopesA.length !== scopesB.length)
      return false;
    for (let i = 0; i < scopesA.length; i++)
      if (scopesA[i] !== scopesB[i])
        return false;
    return true;
  } catch { return false; }
}

export class ShikiEditorHighlighter {
  private readonly ensureLoaded: (lang: string) => Promise<boolean>;

  private caches = new Map<number, BlockCache>();
  private pending = new Map<number, AbortController>();
  private debounceTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private listeners = new Set<Listener>();

  constructor(ensureLoaded: (lang: string) => Promise<boolean>) {
    this.ensureLoaded = ensureLoaded;
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getHighlightedHtml(blockIndex: number): string | null {
    const cache = this.caches.get(blockIndex);
    if (!cache)
      return null;

    const sb: string[] = [];
    const n = cache.lines.length;

    for (let li = 0; li < n; li++) {
      const line = cache.lines[li];

      if (!line || line.tokens.length === 0) {
        const ls = cache.lineOffsets[li];
        const le = li < n - 1 ? cache.lineOffsets[li + 1] - 1 : cache.fullText.length;
        sb.push(escHtml(cache.fullText.slice(ls, le)));
      } else {
        let pos = 0;
        const text = line.text;
        for (const tok of line.tokens) {
          if (tok.offset > pos)
            sb.push(escHtml(text.slice(pos, tok.offset)));
          const raw = escHtml(text.slice(tok.offset, tok.offset + tok.length));
          const css = tokenCss(tok);
          sb.push(css ? `<span style="${css}">${raw}</span>` : raw);
          pos = tok.offset + tok.length;
        }
        if (pos < text.length)
          sb.push(escHtml(text.slice(pos)));
      }

      if (li < n - 1)
        sb.push('\n');
    }

    return sb.join('');
  }

  update(
    blockIndex: number,
    content: string,
    rawLang: string,
    theme: string,
    highlighter: HighlighterCore
  ): void {
    const cache = this.caches.get(blockIndex);

    if (
      cache?.fullText === content &&
      cache.language === rawLang &&
      cache.theme === theme
    )
      return;

    this.pending.get(blockIndex)?.abort();
    const ctrl = new AbortController();
    this.pending.set(blockIndex, ctrl);

    if (!cache) {
      const plainLines = content.split('\n').map(text => ({ text, tokens: [] as SlimToken[] }));
      const lineOffsets = computeLineOffsets(plainLines, plainLines.length);
      this.caches.set(blockIndex, {
        language: rawLang, theme, fullText: content,
        lines: plainLines, lineOffsets,
        chunkStates: new Array(Math.ceil(plainLines.length / CHUNK_SIZE) + 1).fill(undefined)
      });
      this.notify(blockIndex);
    }

    clearTimeout(this.debounceTimers.get(blockIndex));
    this.debounceTimers.set(
      blockIndex,
      setTimeout(() => {
        this.debounceTimers.delete(blockIndex);
        if (!ctrl.signal.aborted)
          this._tokenize(blockIndex, content, rawLang, theme, ctrl, highlighter);
      }, DEBOUNCE_MS)
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

  private notify(blockIndex: number): void {
    this.listeners.forEach(cb => cb(blockIndex));
  }

  private async _tokenize(
    blockIndex: number,
    content: string,
    rawLang: string,
    theme: string,
    ctrl: AbortController,
    highlighter: HighlighterCore
  ): Promise<void> {
    const cache = this.caches.get(blockIndex);

    const lang = await this.resolveLanguage(rawLang, highlighter);
    if (ctrl.signal.aborted)
      return;

    const newLines = content.split('\n');
    const n = newLines.length;
    const numChunks = Math.ceil(n / CHUNK_SIZE) || 1;
    const oldLen = cache?.lines.length ?? 0;
    const langChanged = !cache || cache.language !== rawLang || cache.theme !== theme;

    const lines: (CachedLine | undefined)[] = langChanged
      ? new Array(n).fill(undefined)
      : cache!.lines.slice();
      
    while (lines.length < n)
      lines.push(undefined);

    const chunkStates: (GrammarState | undefined)[] = langChanged
      ? new Array(numChunks + 1).fill(undefined)
      : cache!.chunkStates.slice();

    while (chunkStates.length < numChunks + 1)
      chunkStates.push(undefined);

    let startLine = 0;
    if (!langChanged && cache)
      while (startLine < n && startLine < oldLen && newLines[startLine] === cache.lines[startLine]?.text)
        startLine++;
      
    const startChunk = Math.floor(startLine / CHUNK_SIZE);

    for (let c = startChunk; c < numChunks; c++) {
      if (ctrl.signal.aborted)
        return;

      if (c !== startChunk) {
        await yieldToMain();
        if (ctrl.signal.aborted)
          return;
      }

      const chunkStart = c * CHUNK_SIZE;
      const chunkEnd = Math.min((c + 1) * CHUNK_SIZE, n);

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

      const chunkLines = newLines.slice(chunkStart, chunkEnd);
      let result: { tokens: ThemedToken[][]; grammarState?: GrammarState };

      try {
        result = highlighter.codeToTokens(chunkLines.join('\n'), {
          lang, theme, grammarState: chunkStates[c]
        });
      } catch {
        for (let j = 0; j < chunkLines.length; j++)
          lines[chunkStart + j] = { text: chunkLines[j], tokens: [] };
        chunkStates[c + 1] = undefined;
        continue;
      }

      const lineStarts = computeLineStarts(chunkLines);
      const nrl = Math.min(result.tokens.length, chunkLines.length);
      for (let j = 0; j < nrl; j++) {
        const rawTokens = result.tokens[j] ?? [];
        lines[chunkStart + j] = {
          text: chunkLines[j],
          tokens: rawTokens
            .filter(t => t.content.length > 0)
            .map(t => ({
              offset: t.offset - lineStarts[j],
              length: t.content.length,
              color: t.color ?? '',
              fontStyle: t.fontStyle ?? 0
            })),
        };
      }
      chunkStates[c + 1] = result.grammarState;
    }

    if (ctrl.signal.aborted)
      return;

    lines.length = n;
    chunkStates.length = numChunks + 1;

    this.caches.set(blockIndex, {
      language: rawLang, theme, fullText: content,
      lines,
      lineOffsets: computeLineOffsets(lines, n),
      chunkStates
    });

    this.notify(blockIndex);
  }

  private async resolveLanguage(raw: string, highlighter: HighlighterCore): Promise<string> {
    const lang = (LANG_ALIASES[raw.toLowerCase()] ?? raw.toLowerCase()).trim();
    if (SPECIAL_LANGS.has(lang))
      return 'text';
    const ok = await this.ensureLoaded(lang);
    if (!ok)
      return 'text';
    try {
      highlighter.getLanguage(lang);
      return lang;
    } catch {
      return 'text';
    }
  }
}