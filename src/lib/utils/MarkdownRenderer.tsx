import React, { useState, useCallback, useEffect, ReactNode } from 'react';
import type {
  DocumentAST, BlockNode, InlineNode,
  ListItemNode, NumberedListItemNode,
  TableNode, CollapsibleNode,
  NestedQuoteNode, QuoteListItemNode,
  QuoteNumberedListItemNode, ListItemQuoteNode,
  NumberedListItemQuoteNode
} from './MarkdownAST';
import { parseDocument, isBigEmoji } from './MarkdownParser';
import { getDisplayRole } from './UserUtils';
import { getChannelIcon } from './ChannelUtils';
import type { AbstractChannel, Server, User } from './Types';
import { EmojiStyle, Theme, type UserSettings } from './UserSettings';
import type { UserState } from '../state/Users';
import type { ServerState } from '../state/Servers';
import type { ChannelState } from '../state/Channels';
import Twemoji from 'react-twemoji';
import { useShikiHighlighter } from 'react-shiki';
import { getIcon } from './ServerUtils';
import { ModelOperations } from '@vscode/vscode-languagedetection';
import katex from 'katex';
import { createHighlighterCore, createOnigurumaEngine } from 'react-shiki/core';
import { BundledLanguage, bundledLanguages, HighlighterCore } from 'shiki';
import { t, useLocale } from '../i18n/Index';
import { intToHex, lerp, toHash } from './Funcs';
import { Name } from '../../components/layout/Generic';
import Random from './Random';
import Graphemer from 'graphemer';

declare global {
  namespace Intl {
    class Segmenter {
      constructor(
        locales?: string | string[],
        options?: { granularity?: 'grapheme' | 'word' | 'sentence' }
      );
      segment(
        input: string
      ): Iterable<{ segment: string; index: number; input: string }>;
    }
  }
}

export const modelOperations = new ModelOperations(
  {
    modelJsonLoaderFunc: async () => {
      const response = await fetch('https://cdn.jsdelivr.net/npm/@vscode/vscode-languagedetection/model/model.json');
      return await response.json();
    },
    weightsLoaderFunc: async () => {
      const response = await fetch('https://cdn.jsdelivr.net/npm/@vscode/vscode-languagedetection/model/group1-shard1of1.bin');
      return await response.arrayBuffer();
    }
  }
);

export let superHighlighter: HighlighterCore | undefined;

export const highlighterReady: Promise<void> = (async () => {
  try {
    superHighlighter = await createHighlighterCore({
      themes: [
        import('@shikijs/themes/github-light'),
        import('@shikijs/themes/github-dark')
      ],
      langs: [],
      engine: createOnigurumaEngine(import('shiki/wasm'))
    });
  } catch (e) {
    console.error('[Shiki] highlighter initialisation failed:', e);
  }
})();

const _loadedLangs = new Set<string>();
const _loadingLangs = new Map<string, Promise<void>>();

export const LANG_ALIASES: Record<string, string> = {
  js: 'javascript', ts: 'typescript', py: 'python', rb: 'ruby',
  sh: 'bash', shell: 'bash', zsh: 'bash', 'c++': 'cpp',
  'c#': 'csharp', html: 'markup', xml: 'markup', svg: 'markup',
  yml: 'yaml', md: 'markdown', rs: 'rust', kt: 'kotlin',
  kts: 'kotlin'
};

export const SPECIAL_LANGS = new Set(['text', 'plaintext', 'plain', 'txt', 'ansi', '']);

export function normalizeShikiLang(raw: string): string {
  return LANG_ALIASES[raw.toLowerCase()] ?? raw.toLowerCase();
}

export async function ensureLanguageLoaded(rawLang: string): Promise<boolean> {
  const lang = normalizeShikiLang(rawLang);
  if (SPECIAL_LANGS.has(lang))
    return true;

  await highlighterReady;
  if (!superHighlighter)
    return false;

  if (_loadedLangs.has(lang))
    return true;
  if (!(lang in bundledLanguages))
    return false;

  if (!_loadingLangs.has(lang)) {
    const p = (async () => {
      try {
        await superHighlighter!.loadLanguage(bundledLanguages[lang as BundledLanguage]);
        _loadedLangs.add(lang);
      } catch (e) {
        console.warn(`[Shiki] failed to load language "${lang}":`, e);
      }
    })();
    _loadingLangs.set(lang, p);
  }

  await _loadingLangs.get(lang);
  return _loadedLangs.has(lang);
}

export function getShikiTheme(
  userSettings: UserSettings | null | undefined,
): 'github-dark' | 'github-light' {
  if (!userSettings) return 'github-dark';
  const light =
    userSettings.theme === Theme.Light ||
    (userSettings.theme === Theme.System &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: light)').matches);
  return light ? 'github-light' : 'github-dark';
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function fmtRelative(date: Date): string {
  const diff = date.getTime() - Date.now();
  const s = Math.round(diff / 1000);
  if (Math.abs(s) < 60)
    return rtf.format(s, 'second');
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60)
    return rtf.format(m, 'minute');
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24)
    return rtf.format(h, 'hour');
  const d = Math.round(h / 24);
  if (Math.abs(d) < 30)
    return rtf.format(d, 'day');
  const mo = Math.round(d / 30);
  if (Math.abs(mo) < 12)
    return rtf.format(mo, 'month');
  return rtf.format(Math.round(mo / 12), 'year');
}

export function renderEmoji(userSettings: UserSettings | null, emoji: string, className: string = "emoji-text", onClick: Function | null = null) {
  return (
    userSettings?.emojiStyle === EmojiStyle.System ? (
      <span
        className={className.replace(/emoji-([a-z]+)/g, match => match + "-system")}
        onClick={e => {
          if (onClick == null)
            return;
          onClick(emoji, e);
        }}
        onDoubleClick={e => e.stopPropagation()}
      >
        {emoji}
      </span>
    ) : (
      <Twemoji
        options={{
          className,
          folder: "svg",
          ext: ".svg"
        }}
        noWrapper={true}
      >
        <span
          onClick={e => {
            if (onClick == null)
              return;
            onClick(emoji, e);
          }}
          onDoubleClick={e => e.stopPropagation()}
        >
          {emoji}
        </span>
      </Twemoji>
    )
  );
}

export function formatTimestamp(ms: number, style = 'f'): string {
  const d = new Date(ms);
  switch (style) {
    case 't': return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    case 'T': return d.toLocaleTimeString();
    case 'd': return d.toLocaleDateString();
    case 'D': return d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
    case 'f': return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    case 'F': return d.toLocaleString([], { dateStyle: 'full', timeStyle: 'short' });
    case 'R': return fmtRelative(d);
    default: return d.toLocaleString();
  }
}

export interface RenderContext {
  userState?: UserState;
  serverState?: ServerState;
  channelState?: ChannelState;
  userSettings?: UserSettings | null;
  noBigEmoji?: boolean;
  showSpoilers?: 'always' | 'onHover';
  forceInline?: boolean;
  onMentionClick?: (user: User, member: any, e: React.MouseEvent) => void;
  onRoleClick?: (role: any, server: Server, e: React.MouseEvent) => void;
  onChannelClick?: (ch: AbstractChannel, e: React.MouseEvent) => void;
  onServerClick?: (srv: Server, e: React.MouseEvent) => void;
  onEmojiClick?: (emoji: string, e: React.MouseEvent) => void;
  onToggleDetails?: () => void;
}

function SpoilerSpan({ children, stateMap, id, showAlways }: {
  children: React.ReactNode;
  stateMap: React.MutableRefObject<Map<number, boolean>> | null;
  id: number;
  showAlways: boolean;
}) {
  const [shown, setShown] = useState(() => stateMap?.current.get(id) ?? false);
  const reveal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShown(prev => {
      const next = !prev;
      stateMap?.current.set(id, next);
      return next;
    });
  }, [id, stateMap]);

  return (
    <span
      className={`spoiler${shown || showAlways ? ' shown' : ''}`}
      data-md-pre="||" data-md-post="||"
      onClickCapture={shown || showAlways ? undefined : reveal}
      onClick={shown ? reveal : undefined}
      onDoubleClick={e => e.stopPropagation()}
    >
      {children}
    </span>
  );
}

const CodeBlock = React.memo(function CodeBlock({
  content,
  language,
  theme,
  showLineNumbers
}: {
  content: string;
  language?: string;
  theme?: Theme;
  showLineNumbers?: boolean;
}) {
  useLocale();
  const [copied, setCopied] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string | undefined>(undefined);

  const [hlInstance, setHlInstance] = useState<HighlighterCore | undefined>(superHighlighter);
  useEffect(() => {
    if (superHighlighter)
      return; // already ready at mount
    let alive = true;
    highlighterReady.then(() => {
      if (alive)
        setHlInstance(superHighlighter);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (language)
      return;

    const t = content.trim();
    if (!t || t.length < 10) {
      setDetectedLanguage(undefined);
      return;
    }

    let isMounted = true;

    async function triggerDetection() {
      try {
        const results = await modelOperations.runModel(t);
        if (isMounted && results && results.length > 0)
          setDetectedLanguage(results[0].languageId);
      } catch (error) {
        console.error("VSCode language detection failed:", error);
      }
    }

    triggerDetection();

    return () => { isMounted = false; };
  }, [content, language]);

  const effectiveLanguage = language || detectedLanguage || 'text';

  const [confirmedLang, setConfirmedLang] = useState<string>('text');

  useEffect(() => {
    let cancelled = false;
    setConfirmedLang('text');
    ensureLanguageLoaded(effectiveLanguage).then(loaded => {
      if (!cancelled)
        setConfirmedLang(loaded ? effectiveLanguage : 'text');
    });
    return () => { cancelled = true; };
  }, [effectiveLanguage, hlInstance]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  const light = theme === Theme.Light ||
    theme === Theme.System && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

  const shikiTheme = light ? "github-light" : "github-dark";

  const highlighter = useShikiHighlighter(
    content,
    confirmedLang,
    shikiTheme,
    {
      showLineNumbers: showLineNumbers,
      highlighter: hlInstance
    }
  );

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-lang">{effectiveLanguage}</span>
        <button className="code-block-copy" onClick={copy} onDoubleClick={e => e.stopPropagation()} title={t("code.copy_title")}>
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      <div className="multiline-code" data-md-pre={`\`\`\`${effectiveLanguage}\n`} data-md-post="\n```">
        <div data-testid="shiki-container" data-slot="container" className="rs-root not-prose rs-default-styles shiki">
          {highlighter ?? (
            // fallback to manually created output that mimicks useShikiHighlighter
            <pre className={`shiki ${shikiTheme}`} tabIndex={0} style={{ backgroundColor: light ? "#fff" : "#24292e", color: light ? "#24292e" : "#e1e4e8" }}>
              <code className={showLineNumbers ? "rs-has-line-numbers" : undefined}>
                {content.split('\n').map(line => <span className={"line" + (showLineNumbers ? " rs-line-number" : "")}><span>{line + '\n'}</span></span>)}
              </code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
});

const hasSegmenter = typeof Intl.Segmenter !== 'undefined';
const segmenter = hasSegmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemer = !hasSegmenter ? new Graphemer() : null;

export function splitGraphemes(text: string): string[] {
  if (!text)
    return [];

  if (segmenter) {
    const segments = segmenter.segment(text);
    const result: string[] = [];

    for (const { segment } of segments)
      result.push(segment);

    return result;
  }

  if (graphemer)
    return graphemer.splitGraphemes(text);

  return [];
}

export function mapTextNodes(
  node: ReactNode,
  fn: (graphemes: string[]) => ReactNode
): ReactNode {
  if (typeof node === "string")
    return fn(splitGraphemes(node));

  if (typeof node === "number")
    return fn(splitGraphemes(String(node)));

  if (Array.isArray(node))
    return node.map((child, i) => (
      <React.Fragment key={i}>
        {mapTextNodes(child, fn)}
      </React.Fragment>
    ));

  if (React.isValidElement(node))
    return React.cloneElement(
      node,
      undefined,
      mapTextNodes(node.props.children, fn)
    );

  return node;
}

export function WobblyText({ children }: { children: ReactNode }) {
  return (
    <span className="wobbly">
      {mapTextNodes(children, text => [...text].map((char, i) => (
        <span
          key={i}
          className="char"
          style={{ '--i': i } as React.CSSProperties}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      )))}
    </span>
  );
}

export function ShakyText({ children }: { children: ReactNode }) {
  return (
    <span className="shaky">
      {mapTextNodes(children, text => {
        const rand = Random.create(BigInt(toHash(text.join(""))));
        return text.map((char, i) => {
          const r = (-0.5 + rand.nextFloat()) * 2;
          const amp = lerp(r, r < 0 ? -1 : 1, 0.5) / 16;
          const speed = 0.5 + rand.nextFloat() * 0.5;

          return (
            <span
              key={i}
              className="char"
              style={
                {
                  "--amp": `${amp}em`,
                  "--speed": `${speed}s`
                } as React.CSSProperties
              }
            >
              {char === " " ? "\u00A0" : char}
            </span>
          );
        })
      })}
    </span>
  );
}

function LiveTimestampSpan({ ts, style }: { ts: number; style: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (style !== 'R')
      return;

    const diff = Math.abs(Date.now() - ts);
    const interval = diff < 3_600_000 ? 1_00 : 60_000;
    const id = setInterval(() => tick(n => n + 1), interval);
    return () => clearInterval(id);
  }, [ts, style]);

  return (
    <span className="timestamp-render" title={new Date(ts).toLocaleString()}>
      {formatTimestamp(ts, style)}
    </span>
  );
}

function ProgressBarInline({ value, label }: { value: number; label: string }) {
  return (
    <span className="progress-bar-inline" title={`${Math.round(value)}%`} data-md-verbatim={`[progress: ${label}]`}>
      <span className="progress-bar-track">
        <span className="progress-bar-fill" style={{ width: `${value}%` }} />
      </span>
      <span className="progress-bar-label">{label}</span>
    </span>
  );
}

interface CharCounter {
  remaining: number;
  done: boolean;
}

function consumeChars(cc: CharCounter | null, text: string): string {
  if (!cc)
    return text;
  if (cc.done)
    return '';
  if (text.length < cc.remaining) {
    cc.remaining -= text.length;
    return text;
  }
  const visible = text.slice(0, cc.remaining);
  cc.remaining = 0;
  cc.done = true;
  return visible + '...';
}

function ri(
  nodes: InlineNode[],
  ctx: RenderContext,
  sm: React.MutableRefObject<Map<number, boolean>> | null,
  sc: { n: number },
  kc: { n: number },
  cc: CharCounter | null
): ReactNode[] {
  return nodes.map(n => rin(n, ctx, sm, sc, kc, cc));
}

function rin(
  node: InlineNode,
  ctx: RenderContext,
  sm: React.MutableRefObject<Map<number, boolean>> | null,
  sc: { n: number },
  kc: { n: number },
  cc: CharCounter | null
): ReactNode {
  const k = () => ++kc.n;
  const ch = (ns: InlineNode[]) => ri(ns, ctx, sm, sc, kc, cc);

  if (cc?.done)
    return <span key={k()} />;

  switch (node.type) {
    case 'text': {
      const visible = consumeChars(cc, node.content);
      return <span key={k()}>{visible}</span>;
    }

    case 'bold': return <b key={k()} data-md-pre="**" data-md-post="**">{ch(node.children)}</b>;
    case 'italic': return <i key={k()} data-md-pre="*" data-md-post="*">{ch(node.children)}</i>;
    case 'underline': return <u key={k()} data-md-pre="__" data-md-post="__">{ch(node.children)}</u>;
    case 'strikethrough': return <s key={k()} data-md-pre="~~" data-md-post="~~">{ch(node.children)}</s>;
    case 'superscript': return <sup key={k()} data-md-pre="^" data-md-post="^">{ch(node.children)}</sup>;
    case 'subscript': return <sub key={k()} data-md-pre="~" data-md-post="~">{ch(node.children)}</sub>;

    case 'inlineSubheader':
      return <span key={k()} className="subheader" data-md-pre="-# ">{ch(node.children)}</span>;

    case 'inlineHeader':
      return <span key={k()} className={`h${node.level}`} data-md-pre={`${'#'.repeat(node.level)} `}>{ch(node.children)}</span>;

    case 'spoiler': {
      const id = sc.n++;
      return (
        <SpoilerSpan key={k()} stateMap={sm} id={id} showAlways={ctx.showSpoilers === 'always'}>
          {ch(node.children)}
        </SpoilerSpan>
      );
    }

    case 'inlineMath': {
      try {
        const html = katex.renderToString(node.content, { throwOnError: false, displayMode: false });
        return <span key={k()} className="math-inline" data-md-verbatim={`$${node.content}$`} dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return <code key={k()}>${node.content}$</code>;
      }
    }

    case 'highlight':
      return <span key={k()} className="highlight" data-md-pre="==" data-md-post="==">{ch(node.children)}</span>;

    case 'lowlight':
      return <span key={k()} className="lowlight" data-md-pre="===" data-md-post="===">{ch(node.children)}</span>;

    case 'hexColor':
      return <span key={k()} className="hex-color" style={{ '--color': node.content } as any}>{consumeChars(cc, node.content)}</span>;

    case 'code':
      return <code key={k()} data-md-pre="`" data-md-post="`">{consumeChars(cc, node.content)}</code>;

    case 'color':
      return (
        <span key={k()} className={"colored" + (node.colors ? " gradient" : "")} style={{ '--color': node.hex, ...(node.colors && { '--gradient': `linear-gradient(90deg, ${node.colors.join(", ")})` }) } as any}>
          {ch(node.children)}
        </span>
      );

    case 'link': {
      if (node.label) {
        return (
          <a key={k()} href={node.url} target="_blank" rel="noreferrer"
            data-md-pre="[" data-md-post={`](${node.url})`}
            onDoubleClick={e => e.stopPropagation()}>
            {ch(node.label)}
          </a>
        );
      }
      return (
        <a key={k()} href={node.url} target="_blank" rel="noreferrer" onDoubleClick={e => e.stopPropagation()}>
          <span>{consumeChars(cc, node.url)}</span>
        </a>
      );
    }

    case 'marquee':
      return (
        <span key={k()} className="marquee" data-md-pre="<<" data-md-post=">>">
          <span className="marquee-track">
            {ch(node.children)}
          </span>
        </span>
      );

    case 'wobbly':
      return <WobblyText key={k()}>{ch(node.children)}</WobblyText>;

    case 'shaky':
      return <ShakyText key={k()}>{ch(node.children)}</ShakyText>;

    case 'timestamp':
      return <LiveTimestampSpan key={k()} ts={node.timestamp} style={node.style} />;

    case 'progressBar':
      return <ProgressBarInline key={k()} value={node.value} label={node.label} />;

    case 'mentionEveryone':
      return <span key={k()} className="mention int" onDoubleClick={e => e.stopPropagation()}>{consumeChars(cc, `@${node.subtype}`)}</span>;

    case 'mentionUser': {
      const us = ctx.userState;
      const ss = ctx.serverState;
      const u = us?.get(node.id);
      const m = u && us ? us.getMember(u.id, ss?.currentServer?.id) : undefined;
      const r = m && ss && getDisplayRole(ss, m, true);
      const col = r?.colors?.[0] ?? r?.color;
      consumeChars(cc, "@" + (m?.nickname ?? u?.displayName ?? u?.username ?? ""));
      return (
        <span
          key={k()}
          className="mention int"
          style={{ "--special-mention-color": col && intToHex(col) } as any}
          onClick={e => u && ctx.onMentionClick?.(u, m, e)}
        >
          <Name
            user={u ?? null}
            member={m}
            serverState={ss}
            allowDmColors={!!!ss?.currentServer}
            md={ctx}
            spoilerState={sm ?? undefined}
            prefix="@"
          />
        </span>
      );
    }

    case 'mentionRole': {
      const ss = ctx.serverState;
      const s = ss?.currentServer;
      const r = s?.roles.find(x => x.id === node.id);
      const col = r?.colors?.[0] ?? r?.color;
      consumeChars(cc, "@" + (r?.name ?? ""));
      return (
        <span
          key={k()}
          className="mention int"
          style={{ "--special-mention-color": col && intToHex(col) } as any}
        >
          <Name
            user={null}
            serverState={ss}
            allowDmColors={!!!ss?.currentServer}
            md={ctx}
            spoilerState={sm ?? undefined}
            overRole={r}
            prefix={r ? "@" : `<@&`}
            text={r?.name ?? `${node.id}>`}
          />
        </span>
      );
    }

    case 'mentionChannel': {
      const cs = ctx.channelState;
      const ch2 = cs?.channels.find((x: AbstractChannel) => x.id === node.id) as AbstractChannel | undefined;
      const name = ch2?.name ?? `<#${node.id}>`;
      consumeChars(cc, name);
      return (
        <span
          key={k()}
          className="mention int"
          onClick={ch2 && ctx.onChannelClick ? e => ctx.onChannelClick!(ch2, e) : undefined}
          onDoubleClick={e => e.stopPropagation()}
        >
          {ch2 && getChannelIcon(ch2, { className: 'icon' })}{name}
        </span>
      );
    }

    case 'mentionServer': {
      const ss = ctx.serverState;
      const srv = ss?.servers.find((x: Server) => x.id === node.id);
      const name = srv?.name ? `${srv.name}` : `<#&${node.id}>`;
      consumeChars(cc, name);
      return (
        <span
          key={k()}
          className="mention int"
          onClick={srv && ctx.onServerClick ? e => ctx.onServerClick!(srv, e) : undefined}
          onDoubleClick={e => e.stopPropagation()}
        >
          {srv && <img src={getIcon(srv)} className="server-icon2" />}{name}
        </span>
      );
    }

    case 'emoji':
      return (
        <span key={k()}>
          {renderEmoji(ctx.userSettings ?? null, consumeChars(cc, node.native), 'emoji-text int', ctx.onEmojiClick ?? null)}
        </span>
      );

    default:
      return <span key={k()} />;
  }
}

function renderBlocks(
  ast: DocumentAST,
  ctx: RenderContext,
  sm: React.MutableRefObject<Map<number, boolean>> | null,
  sc: { n: number },
  kc: { n: number },
  bigEmoji: boolean,
  cc: CharCounter | null
): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let prevWasInline = false;
  const k = () => ++kc.n;

  while (i < ast.length) {
    if (cc?.done)
      break;

    const block = ast[i];

    if (block.type === 'table') {
      if (ctx.forceInline) {
        if (prevWasInline)
          out.push(<span key={k()}>{' '}</span>);
        const tbl = block as TableNode;
        const allCells = tbl.rows.flatMap(r => r.cells);
        out.push(
          <span key={k()}>
            {allCells.map((cell, ci) => (
              <span key={ci}>
                {ci > 0 && <span>{' | '}</span>}
                {ri(cell.children, ctx, sm, sc, kc, cc)}
              </span>
            ))}
          </span>
        );
        prevWasInline = true;
        i++;
        continue;
      }

      const tbl = block as TableNode;
      const [headerRow, ...bodyRows] = tbl.rows;
      out.push(
        <div key={k()} className="md-table-wrapper">
          <table className="md-table">
            {headerRow && (
              <thead>
                <tr>
                  {headerRow.cells.map((cell, ci) => (
                    <th key={ci} style={{ textAlign: cell.align ?? undefined }}>
                      {ri(cell.children, ctx, sm, sc, kc, cc)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.cells.map((cell, ci) => (
                    <td key={ci} style={{ textAlign: cell.align ?? undefined }}>
                      {ri(cell.children, ctx, sm, sc, kc, cc)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      prevWasInline = false;
      i++;
      continue;
    }

    if (block.type === 'listItem' || block.type === 'listItemQuote') {
      if (ctx.forceInline) {
        if (prevWasInline)
          out.push(<span key={k()}>{' '}</span>);
        const items: (ListItemNode | ListItemQuoteNode)[] = [];
        while (i < ast.length && (ast[i].type === 'listItem' || ast[i].type === 'listItemQuote')) {
          items.push(ast[i] as ListItemNode | ListItemQuoteNode);
          i++;
        }
        out.push(
          <span key={k()}>
            {items.map((it, idx) => (
              <span key={idx}>
                {idx > 0 && <span>{' '}</span>}
                <span>{'• '}</span>
                {ri(it.children, ctx, sm, sc, kc, cc)}
              </span>
            ))}
          </span>
        );
        prevWasInline = true;
        continue;
      }

      const items: (ListItemNode | ListItemQuoteNode)[] = [];
      while (i < ast.length && (ast[i].type === 'listItem' || ast[i].type === 'listItemQuote')) {
        items.push(ast[i] as ListItemNode | ListItemQuoteNode);
        i++;
      }
      out.push(
        <ul key={k()}>
          {items.map(it => (
            <li key={k()} data-md-pre={it.type === 'listItemQuote' ? '- > ' : '- '}>
              {it.type === 'listItemQuote'
                ? <span className="quote">{ri((it as ListItemQuoteNode).children, ctx, sm, sc, kc, cc)}</span>
                : ri((it as ListItemNode).children, ctx, sm, sc, kc, cc)
              }
            </li>
          ))}
        </ul>,
      );
      prevWasInline = false;
      continue;
    }

    if (block.type === 'numberedListItem' || block.type === 'numberedListItemQuote') {
      if (ctx.forceInline) {
        if (prevWasInline)
          out.push(<span key={k()}>{' '}</span>);
        const items: (NumberedListItemNode | NumberedListItemQuoteNode)[] = [];
        while (i < ast.length && (ast[i].type === 'numberedListItem' || ast[i].type === 'numberedListItemQuote')) {
          items.push(ast[i] as NumberedListItemNode | NumberedListItemQuoteNode);
          i++;
        }
        out.push(
          <span key={k()}>
            {items.map((it, idx) => (
              <span key={idx}>
                {idx > 0 && <span>{' '}</span>}
                <span>{`${it.number}. `}</span>
                {ri(it.children, ctx, sm, sc, kc, cc)}
              </span>
            ))}
          </span>
        );
        prevWasInline = true;
        continue;
      }

      const items: (NumberedListItemNode | NumberedListItemQuoteNode)[] = [];
      while (i < ast.length && (ast[i].type === 'numberedListItem' || ast[i].type === 'numberedListItemQuote')) {
        items.push(ast[i] as NumberedListItemNode | NumberedListItemQuoteNode);
        i++;
      }
      out.push(
        <ol key={k()}>
          {items.map(it => (
            <li key={k()} value={it.number}
              data-md-pre={it.type === 'numberedListItemQuote'
                ? `${it.number}. > `
                : `${it.number}. `}>
              {it.type === 'numberedListItemQuote'
                ? <span className="quote">{ri((it as NumberedListItemQuoteNode).children, ctx, sm, sc, kc, cc)}</span>
                : ri((it as NumberedListItemNode).children, ctx, sm, sc, kc, cc)
              }
            </li>
          ))}
        </ol>,
      );
      prevWasInline = false;
      continue;
    }

    if (block.type === 'collapsible') {
      if (ctx.forceInline) {
        if (prevWasInline)
          out.push(<span key={k()}>{' '}</span>);
        const cb = block as CollapsibleNode;
        out.push(<span key={k()}>{ri(cb.title, ctx, sm, sc, kc, cc)}</span>);
        prevWasInline = true;
        i++;
        continue;
      }

      const cb = block as CollapsibleNode;
      out.push(
        <details key={k()} className="collapsible-block" onToggle={ctx.onToggleDetails}>
          <summary className="collapsible-title uno" onDoubleClick={e => e.stopPropagation()}>{ri(cb.title, ctx, sm, sc, kc, cc)}</summary>
          <div className="collapsible-body">
            {renderBlocks(cb.children, ctx, sm, sc, kc, false, cc)}
          </div>
        </details>
      );
      prevWasInline = false;
      i++;
      continue;
    }

    if (block.type === 'nestedQuote') {
      if (ctx.forceInline) {
        if (prevWasInline)
          out.push(<span key={k()}>{' '}</span>);
        const items: NestedQuoteNode[] = [];
        while (i < ast.length && ast[i].type === 'nestedQuote') {
          items.push(ast[i] as NestedQuoteNode);
          i++;
        }
        out.push(
          <span key={k()}>
            {items.map((it, idx) => (
              <span key={idx}>
                {idx > 0 && <span>{' '}</span>}
                {ri(it.children, ctx, sm, sc, kc, cc)}
              </span>
            ))}
          </span>
        );
        prevWasInline = true;
        continue;
      }

      const items: NestedQuoteNode[] = [];
      while (i < ast.length && ast[i].type === 'nestedQuote') {
        items.push(ast[i] as NestedQuoteNode);
        i++;
      }
      out.push(
        <span key={k()} className="quote">
          <span className="quote nested-quote">
            {items.map((it, idx) => (
              <span key={idx} data-md-pre="> > ">
                {idx > 0 && <br />}
                {ri(it.children, ctx, sm, sc, kc, cc)}
              </span>
            ))}
          </span>
        </span>
      );
      prevWasInline = false;
      continue;
    }

    if (block.type === 'quoteListItem') {
      if (ctx.forceInline) {
        if (prevWasInline)
          out.push(<span key={k()}>{' '}</span>);
        const items: QuoteListItemNode[] = [];
        while (i < ast.length && ast[i].type === 'quoteListItem') {
          items.push(ast[i] as QuoteListItemNode);
          i++;
        }
        out.push(
          <span key={k()}>
            {items.map((it, idx) => (
              <span key={idx}>
                {idx > 0 && <span>{' '}</span>}
                <span>{'• '}</span>
                {ri(it.children, ctx, sm, sc, kc, cc)}
              </span>
            ))}
          </span>
        );
        prevWasInline = true;
        continue;
      }

      const items: QuoteListItemNode[] = [];
      while (i < ast.length && ast[i].type === 'quoteListItem') {
        items.push(ast[i] as QuoteListItemNode);
        i++;
      }
      out.push(
        <div key={k()} className="quote">
          <ul className="quote-list">
            {items.map(it => <li key={k()} data-md-pre="> - ">{ri(it.children, ctx, sm, sc, kc, cc)}</li>)}
          </ul>
        </div>
      );
      prevWasInline = false;
      continue;
    }

    if (block.type === 'quoteNumberedListItem') {
      if (ctx.forceInline) {
        if (prevWasInline)
          out.push(<span key={k()}>{' '}</span>);
        const items: QuoteNumberedListItemNode[] = [];
        while (i < ast.length && ast[i].type === 'quoteNumberedListItem') {
          items.push(ast[i] as QuoteNumberedListItemNode);
          i++;
        }
        out.push(
          <span key={k()}>
            {items.map((it, idx) => (
              <span key={idx}>
                {idx > 0 && <span>{' '}</span>}
                <span>{`${it.number}. `}</span>
                {ri(it.children, ctx, sm, sc, kc, cc)}
              </span>
            ))}
          </span>
        );
        prevWasInline = true;
        continue;
      }

      const items: QuoteNumberedListItemNode[] = [];
      while (i < ast.length && ast[i].type === 'quoteNumberedListItem') {
        items.push(ast[i] as QuoteNumberedListItemNode);
        i++;
      }
      out.push(
        <div key={k()} className="quote">
          <ol className="quote-list">
            {items.map(it => <li key={k()} value={it.number} data-md-pre={`> ${it.number}. `}>{ri(it.children, ctx, sm, sc, kc, cc)}</li>)}
          </ol>
        </div>
      );
      prevWasInline = false;
      continue;
    }

    if (block.type === 'codeBlock') {
      if (ctx.forceInline) {
        if (prevWasInline)
          out.push(<span key={k()}>{' '}</span>);
        const visible = consumeChars(cc, block.content);
        out.push(
          <code key={k()} data-md-pre={`\`\`\`${block.language ?? ''}\n`} data-md-post="\n```">
            {visible}
          </code>
        );
        prevWasInline = true;
        i++;
        continue;
      }

      out.push(
        <CodeBlock key={k()} content={block.content} language={block.language} theme={ctx.userSettings?.theme} showLineNumbers={ctx.userSettings?.showLineNumbers} />
      );
      prevWasInline = false;
      i++;
      continue;
    }

    if (prevWasInline) {
      if (ctx.forceInline)
        out.push(<span key={k()}>{' '}</span>);
      else
        out.push(<br key={k()} />);
    }

    out.push(renderBlock(block, ctx, sm, sc, kc, bigEmoji, cc));
    prevWasInline = true;
    i++;
  }

  return out;
}

function renderBlock(
  block: BlockNode,
  ctx: RenderContext,
  sm: React.MutableRefObject<Map<number, boolean>> | null,
  sc: { n: number },
  kc: { n: number },
  bigEmoji: boolean,
  cc: CharCounter | null,
): ReactNode {
  const k = () => ++kc.n;
  const ch = (ns: InlineNode[]) => ri(ns, ctx, sm, sc, kc, cc);

  switch (block.type) {
    case 'paragraph': {
      if (bigEmoji) {
        return (
          <span key={k()} style={{ whiteSpace: 'pre-wrap' }}>
            {block.children.map(n => {
              if (n.type === 'text') {
                const visible = consumeChars(cc, n.content);
                return <span key={k()}>{visible}</span>;
              }
              if (n.type === 'emoji') return <span key={k()}>{renderEmoji(ctx.userSettings ?? null, n.native, 'emoji-big int', ctx.onEmojiClick ?? null)}</span>;
              return rin(n, ctx, sm, sc, kc, cc);
            })}
          </span>
        );
      }
      return <span key={k()}>{ch(block.children)}</span>;
    }

    case 'header':
      return <span key={k()} className={`h${block.level}`} data-md-pre={`${'#'.repeat(block.level)} `}>{ch(block.children)}</span>;

    case 'subheader':
      return <span key={k()} className="subheader" data-md-pre="-# ">{ch(block.children)}</span>;

    case 'mathBlock': {
      try {
        const html = katex.renderToString(block.content, { throwOnError: false, displayMode: !ctx.forceInline });
        return ctx.forceInline
          ? <span key={k()} className="math-block" data-md-verbatim={`$$\n${block.content}\n$$`} dangerouslySetInnerHTML={{ __html: html }} />
          : <div key={k()} className="math-block" data-md-verbatim={`$$\n${block.content}\n$$`} dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return ctx.forceInline
          ? <span key={k()} className="math-block math-error">{'$$\n' + block.content + '\n$$'}</span>
          : <pre key={k()} className="math-block math-error">{'$$\n' + block.content + '\n$$'}</pre>;
      }
    }

    case 'quote':
      return (
        <span key={k()} className="quote" data-md-pre="> ">
          {ch(block.children)}
        </span>
      );

    default:
      return <span key={k()} />;
  }
}

interface MarkdownProps extends RenderContext {
  content: string;
  spoilerStateRef?: React.MutableRefObject<Map<number, boolean>>;
  allowBlocks?: boolean;
  allowBig?: boolean;
  maxLength?: number;
}

export function RenderMarkdown({ content, spoilerStateRef, allowBlocks = true, allowBig = true, maxLength, ...ctx }: MarkdownProps) {
  const sm = spoilerStateRef ?? null;
  const ast = parseDocument(content, allowBlocks, !allowBig);
  const bigEmoji = !ctx.noBigEmoji && !ctx.forceInline && isBigEmoji(ast);
  const cc: CharCounter | null = maxLength != null ? { remaining: maxLength, done: false } : null;
  const sc = { n: 0 };
  const kc = { n: 0 };
  return <>{renderBlocks(ast, ctx, sm, sc, kc, bigEmoji, cc)}</>;
}