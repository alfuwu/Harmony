import React, { useState, useCallback, useMemo, JSX, useEffect } from 'react';
import type {
  DocumentAST, BlockNode, InlineNode,
  TextNode, ListItemNode, NumberedListItemNode,
  TableNode,
} from './MarkdownAST';
import { parseDocument, isBigEmoji } from './MarkdownParser';
import { getDisplayName, getRoleColor } from './UserUtils';
import { getChannelIcon } from './ChannelUtils';
import type { AbstractChannel, Server, User } from './types';
import { EmojiStyle, type UserSettings } from './userSettings';
import type { UserState } from '../state/Users';
import type { ServerState } from '../state/Servers';
import type { ChannelState } from '../state/Channels';
import Twemoji from 'react-twemoji';
import ShikiHighlighter from 'react-shiki';
import { getIcon } from './ServerUtils';
import { ModelOperations } from '@vscode/vscode-languagedetection';
import katex from 'katex';

const modelOperations = new ModelOperations(
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
  onMentionClick?: (user: User, member: any, e: React.MouseEvent) => void;
  onRoleClick?: (role: any, server: Server, e: React.MouseEvent) => void;
  onChannelClick?: (ch: AbstractChannel, e: React.MouseEvent) => void;
  onServerClick?: (srv: Server, e: React.MouseEvent) => void;
  onEmojiClick?: (emoji: string, e: React.MouseEvent) => void;
}

function SpoilerSpan({ children, stateMap, id, showAlways }: {
  children: React.ReactNode;
  stateMap: React.MutableRefObject<Map<number, boolean>> | null;
  id: number;
  showAlways: boolean;
}) {
  const [shown, setShown] = useState(() => stateMap?.current.get(id) ?? false);
  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShown(prev => { const next = !prev; stateMap?.current.set(id, next); return next; });
  }, [id, stateMap]);
  return (
    <span className={`spoiler${shown || showAlways ? ' shown' : ''}`} onClick={toggle} onDoubleClick={e => e.stopPropagation()}>
      {children}
    </span>
  );
}

const CodeBlock = React.memo(function CodeBlock({ content, language }: { content: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string | undefined>(undefined);

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

  // 1.5692em is abt one line at font-size 0.875rem / line-height 1.6
  const lineCount = useMemo(() => content.split('\n').length, [content]);
  const scrollStyle = useMemo(() => ({ minHeight: `calc(${lineCount * 1.5692}em + 40px)` }), [lineCount]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-lang">{effectiveLanguage}</span>
        <button className="code-block-copy" onClick={copy} onDoubleClick={e => e.stopPropagation()} title="Copy code">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div className="multiline-code" style={scrollStyle}>
        <ShikiHighlighter className="shiki" language={effectiveLanguage} theme="github-dark">
          {content}
        </ShikiHighlighter>
      </div>
    </div>
  );
});

function ri(
  nodes: InlineNode[],
  ctx: RenderContext,
  sm: React.MutableRefObject<Map<number, boolean>> | null,
  sc: { n: number },
  kc: { n: number }
): JSX.Element[] {
  return nodes.map(n => rin(n, ctx, sm, sc, kc));
}

function rin(
  node: InlineNode,
  ctx: RenderContext,
  sm: React.MutableRefObject<Map<number, boolean>> | null,
  sc: { n: number },
  kc: { n: number }
): JSX.Element {
  const k = () => ++kc.n;
  const ch = (ns: InlineNode[]) => ri(ns, ctx, sm, sc, kc);

  switch (node.type) {
    case 'text': return <span key={k()}>{node.content}</span>;
    case 'bold': return <b key={k()}>{ch(node.children)}</b>;
    case 'italic': return <i key={k()}>{ch(node.children)}</i>;
    case 'boldItalic': return <b key={k()}><i>{ch(node.children)}</i></b>;
    case 'underline': return <u key={k()}>{ch(node.children)}</u>;
    case 'strikethrough': return <s key={k()}>{ch(node.children)}</s>;
    case 'superscript': return <sup key={k()}>{ch(node.children)}</sup>;
    case 'subscript': return <sub key={k()}>{ch(node.children)}</sub>;

    case 'inlineSubheader':
      return <span key={k()} className="subheader">{ch(node.children)}</span>;

    case 'inlineHeader':
      return <span key={k()} className={`h${node.level}`}>{ch(node.children)}</span>;

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
        return <span key={k()} className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return <code key={k()}>${node.content}$</code>;
      }
    }

    case 'highlight':
      return <span key={k()} className="highlight">{ch(node.children)}</span>;

    case 'lowlight':
      return <span key={k()} className="lowlight">{ch(node.children)}</span>;

    case 'hexColor':
      return <span key={k()} className="hex-color" style={{ '--color': node.content } as any}>{node.content}</span>;

    case 'code':
      return <code key={k()}>{node.content}</code>;

    case 'color':
      return (
        <span key={k()} className="colored" style={{ '--color': node.hex } as any}>
          {ch(node.children)}
        </span>
      );

    case 'link': {
      const inner = node.label ? ch(node.label) : [<span key={k()}>{node.url}</span>];
      return <a key={k()} href={node.url} target="_blank" rel="noreferrer" onDoubleClick={e => e.stopPropagation()}>{inner}</a>;
    }

    case 'timestamp':
      return <span key={k()} className="timestamp-render">{formatTimestamp(node.timestamp, node.style)}</span>;

    case 'mentionEveryone':
      return <span key={k()} className="mention int" onDoubleClick={e => e.stopPropagation()}>@{node.subtype}</span>;

    case 'mentionUser': {
      const us = ctx.userState;
      const ss = ctx.serverState;
      const u = us?.users.find((x: User) => x.id === node.id);
      const m = u && us ? us.getMember(u.id, ss?.currentServer?.id) : undefined;
      const name = u ? '@' + getDisplayName(u, m) : `<@${node.id}>`;
      const color = u && ss ? getRoleColor(ss, u, m, ss.currentServer === null) : undefined;
      return (
        <span
          key={k()}
          className="mention int"
          style={{
            fontFamily: `${m?.nameFont}, ${u?.nameFont}, Inter, Avenir, Helvetica, Arial, sans-serif`,
            '--special-mention-color': color,
          } as any}
          onClick={u && ctx.onMentionClick ? e => ctx.onMentionClick!(u, m, e) : undefined}
          onDoubleClick={e => e.stopPropagation()}
        >
          {name}
        </span>
      );
    }

    case 'mentionRole': {
      const ss = ctx.serverState;
      const s = ss?.currentServer;
      const r = s?.roles.find((x: any) => x.id === node.id);
      const name = r?.name ? `@${r.name}` : `<@&${node.id}>`;
      return (
        <span
          key={k()}
          className="mention int"
          style={{ '--special-mention-color': r?.color ? `#${r.color.toString(16).padStart(6, '0')}` : undefined } as any}
          onClick={r && s && ctx.onRoleClick ? e => ctx.onRoleClick!(r, s, e) : undefined}
          onDoubleClick={e => e.stopPropagation()}
        >
          {name}
        </span>
      );
    }

    case 'mentionChannel': {
      const cs = ctx.channelState;
      const ch2 = cs?.channels.find((x: AbstractChannel) => x.id === node.id) as AbstractChannel | undefined;
      const name = ch2?.name ?? `<#${node.id}>`;
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
          {renderEmoji(ctx.userSettings ?? null, node.native, 'emoji-text int', ctx.onEmojiClick ?? null)}
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
  bigEmoji: boolean
): JSX.Element[] {
  const out: JSX.Element[] = [];
  let i = 0;
  let prevWasInline = false;
  const k = () => ++kc.n;

  while (i < ast.length) {
    const block = ast[i];

    if (block.type === 'table') {
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
                      {ri(cell.children, ctx, sm, sc, kc)}
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
                      {ri(cell.children, ctx, sm, sc, kc)}
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

    if (block.type === 'listItem') {
      const items: ListItemNode[] = [];
      while (i < ast.length && ast[i].type === 'listItem') {
        items.push(ast[i] as ListItemNode);
        i++;
      }
      out.push(
        <ul key={k()}>
          {items.map(it => <li key={k()}>{ri(it.children, ctx, sm, sc, kc)}</li>)}
        </ul>,
      );
      prevWasInline = false;
      continue;
    }

    if (block.type === 'numberedListItem') {
      const items: NumberedListItemNode[] = [];
      while (i < ast.length && ast[i].type === 'numberedListItem') {
        items.push(ast[i] as NumberedListItemNode);
        i++;
      }
      out.push(
        <ol key={k()}>
          {items.map(it => (
            <li key={k()} value={it.number}>{ri(it.children, ctx, sm, sc, kc)}</li>
          ))}
        </ol>,
      );
      prevWasInline = false;
      continue;
    }

    if (block.type === 'codeBlock') {
      out.push(
        <CodeBlock key={k()} content={block.content} language={block.language} />
      );
      prevWasInline = false;
      i++;
      continue;
    }

    if (prevWasInline)
      out.push(<br key={k()} />);

    out.push(renderBlock(block, ctx, sm, sc, kc, bigEmoji));
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
  bigEmoji: boolean
): JSX.Element {
  const k = () => ++kc.n;
  const ch = (ns: InlineNode[]) => ri(ns, ctx, sm, sc, kc);

  switch (block.type) {
    case 'paragraph': {
      if (bigEmoji) {
        return (
          <span key={k()} style={{ whiteSpace: 'pre-wrap' }}>
            {block.children.map(n => {
              if (n.type === 'text') return <span key={k()}>{(n as TextNode).content}</span>;
              if (n.type === 'emoji') return <span key={k()}>{renderEmoji(ctx.userSettings ?? null, n.native, 'emoji-big int', ctx.onEmojiClick ?? null)}</span>;
              return rin(n, ctx, sm, sc, kc);
            })}
          </span>
        );
      }
      return <span key={k()}>{ch(block.children)}</span>;
    }

    case 'header':
      return <span key={k()} className={`h${block.level}`}>{ch(block.children)}</span>;

    case 'subheader':
      return <span key={k()} className="subheader">{ch(block.children)}</span>;

    case 'mathBlock': {
      try {
        const html = katex.renderToString(block.content, { throwOnError: false, displayMode: true });
        return <div key={k()} className="math-block" dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return <pre key={k()} className="math-block math-error">{'$$\n' + block.content + '\n$$'}</pre>;
      }
    }

    case 'quote':
      return (
        <span key={k()} className="quote">
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
}

export function RenderMarkdown({ content, spoilerStateRef, ...ctx }: MarkdownProps) {
  const sm = spoilerStateRef ?? null;
  const ast = parseDocument(content);
  const bigEmoji = !ctx.noBigEmoji && isBigEmoji(ast);
  const sc = { n: 0 };
  const kc = { n: 0 };
  return <>{renderBlocks(ast, ctx, sm, sc, kc, bigEmoji)}</>;
}