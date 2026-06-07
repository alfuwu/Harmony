import { COLORS } from './MarkdownAST';
import type { InlineNode, BlockNode, DocumentAST, DecoToken, TextNode, TableRowNode, TableCellNode } from './MarkdownAST';

class InlineParser {
  private pos = 0;

  constructor(
    private readonly src: string,
    private readonly tokens: DecoToken[],
    private readonly base: number = 0,
    private readonly nested: boolean = false, // true when called from inner() — disables block-level constructs
  ) {}

  private get done() {
    return this.pos >= this.src.length;
  }
  private peek(n = 0) {
    return this.src[this.pos + n] ?? '';
  }
  private eat(n = 1): string {
    const s = this.src.slice(this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
  private at(s: string) {
    return this.src.startsWith(s, this.pos);
  }
  private rest() {
    return this.src.slice(this.pos);
  }

  private deco(style: string, a: number, b: number, attrs?: Record<string, unknown>) {
    if (a < b)
      this.tokens.push({ style, start: a + this.base, end: b + this.base, ...(attrs && { attributes: attrs }) });
  }

  private findClose(delim: string, from: number, noTrail = false): number {
    let i = from;
    const dc = delim[0];
    while (i <= this.src.length - delim.length) {
      const c = this.src[i];
      if (c === '\\') {
        let skip = 2;
        if (dc !== '\\' && this.src[i + 1] === this.src[i + 1])
          while (this.src[i + skip] === this.src[i + 1])
            skip++;
        i += skip;
        continue;
      }
      if (c === '`' && dc !== '`') {
        const ce = this.src.indexOf('`', i + 1);
        if (ce !== -1) {
          i = ce + 1;
          continue;
        }
      }
      if (this.src.startsWith(delim, i)) {
        if (noTrail && (this.src[i + delim.length] ?? '') === dc) {
          i++;
          continue;
        }
        return i;
      }
      i++;
    }
    return -1;
  }

  private inner(start: number, end: number): InlineNode[] {
    const child = new InlineParser(this.src.slice(start, end), this.tokens, this.base + start, true);
    return child.parse();
  }

  private trySpan(delim: string, style: string, noTrail = false): InlineNode | null {
    const p = this.pos, len = delim.length;
    const e = this.findClose(delim, p + len, noTrail);
    if (e === -1)
      return null;
    this.deco('mds', p, p + len);
    this.deco(style, p + len, e);
    this.deco('mds', e, e + len);
    this.eat(len);
    const children = this.inner(this.pos, e);
    this.pos = e + len;
    return { type: style, children } as InlineNode;
  }

  private parseOne(): InlineNode | null {
    if (this.done)
      return null;
    const c = this.peek();
    const p = this.pos;

    if (p === 0 && !this.nested) {
      const shM = /^-# (.+)/.exec(this.src);
      if (shM) {
        this.deco('mds', 0, 2);
        this.deco('subheader', 0, this.src.length);
        this.pos = 3;
        const children = this.inner(3, this.src.length);
        this.pos = this.src.length;
        return { type: 'inlineSubheader', children } as InlineNode;
      }
      const hM = /^(#{1,6}) (.+)/.exec(this.src);
      if (hM) {
        const lvl = hM[1].length;
        this.deco('mds', 0, lvl);
        this.deco('header', 0, this.src.length, { size: lvl });
        this.pos = hM[0].length;
        const children = this.inner(this.pos, this.src.length);
        this.pos = this.src.length;
        return { type: 'inlineHeader', level: lvl as 1|2|3|4|5|6, children } as InlineNode;
      }
    }

    if (c === '\\') {
      const nx = this.peek(1);
      if (nx && /[*_@|`~<\\^\-:#>&=#]/.test(nx)) {
        let count = 1;
        if (nx === '*' || nx === '_' || nx === '~')
          while (this.src[p + 1 + count] === nx)
            count++;
        const escaped = this.src.slice(p + 1, p + 1 + count);
        this.deco('mds', p, p + 1);
        this.eat(1 + count);
        return { type: 'text', content: escaped };
      }
      const em = /^\p{Extended_Pictographic}\uFE0F?/u.exec(this.src.slice(p + 1));
      if (em) {
        this.deco('mds', p, p + 1);
        this.eat(1 + em[0].length);
        return { type: 'text', content: em[0] };
      }
    }

    if (c === '`' && !this.at('``')) {
      const e = this.src.indexOf('`', p + 1);
      if (e !== -1) {
        this.deco('mds', p, p + 1);
        this.deco('code', p + 1, e);
        this.deco('mds', e, e + 1);
        this.eat(1);
        const content = this.src.slice(this.pos, e);
        this.pos = e + 1;
        return { type: 'code', content };
      }
    }

    if (this.at('***')) {
      const e = this.findClose('***', p + 3);
      if (e !== -1) {
        this.deco('mds', p, p + 3);
        this.deco('boldItalic', p + 3, e);
        this.deco('mds', e, e + 3);
        this.eat(3);
        const children = this.inner(this.pos, e);
        this.pos = e + 3;
        return { type: 'boldItalic', children };
      }
    }

    if (this.at('**') && this.peek(2) !== '*') {
      const n = this.trySpan('**', 'bold', true);
      if (n) return n;
    }

    if (c === '*' && this.peek(1) !== '*') {
      const n = this.trySpan('*', 'italic', true);
      if (n)
        return n;
    }

    if (this.at('__')) {
      const n = this.trySpan('__', 'underline', true);
      if (n)
        return n;
    }

    if (c === '_' && this.peek(1) !== '_') {
      const n = this.trySpan('_', 'italic', true);
      if (n)
        return n;
    }

    if (this.at('~~')) {
      const n = this.trySpan('~~', 'strikethrough');
      if (n)
        return n;
    }

    if (this.at('||')) {
      const n = this.trySpan('||', 'spoiler');
      if (n)
        return n;
    }

    if (c === '^') {
      const n = this.trySpan('^', 'superscript');
      if (n)
        return n;
    }

    if (c === '~' && !this.at('~~')) {
      const n = this.trySpan('~', 'subscript');
      if (n)
        return n;
    }

    if (c === '$') {
      if (this.at('$$')) {
        const e = this.src.indexOf('$$', p + 2);
        if (e !== -1) {
          const content = this.src.slice(p + 2, e);
          if (content.length > 0 && !content.includes('\n')) {
            this.deco('mds', p, p + 2);
            this.deco('math', p + 2, e);
            this.deco('mds', e, e + 2);
            this.pos = e + 2;
            return { type: 'inlineMath', content };
          }
        }
      } else {
        const e = this.src.indexOf('$', p + 1);
        if (e !== -1) {
          const content = this.src.slice(p + 1, e);
          if (content.length > 0 && !content.includes('\n') &&
              content[0] !== ' ' && content[content.length - 1] !== ' ') {
            this.deco('mds', p, p + 1);
            this.deco('math', p + 1, e);
            this.deco('mds', e, e + 1);
            this.pos = e + 1;
            return { type: 'inlineMath', content };
          }
        }
      }
    }

    if (this.at('==')) {
      const n = this.trySpan('==', 'highlight');
      if (n)
        return n;
    }

    if (c === '=' && !this.at('==')) {
      const n = this.trySpan('=', 'lowlight');
      if (n)
        return n;
    }

    if (c === '<') {
      const n = this.parseAngle();
      if (n)
        return n;
    }

    if (c === '@') {
      for (const sub of ['everyone', 'here'] as const) {
        const tag = `@${sub}`;
        if (this.at(tag) && !/\w/.test(this.peek(tag.length))) {
          this.deco('mentionEveryone', p, p + tag.length);
          this.eat(tag.length);
          return { type: 'mentionEveryone', subtype: sub };
        }
      }

      // Human-readable timestamp: @t[YYYY-mm-dd HH:MM:SS[ |: style]]
      const tsM = /^@t\[(?:(?:(\d{4}|)[-\/ ](\d{2})[-\/ ](\d{2})|(?:(\d{2})[-\/ ](\d{2})[-\/ ](\d{4}|\d{2})))(?:\s(\d{2})[: ](\d{2})(?:[: ](\d{2})(?:[\., ](\d{3}))?)?)?|(\d{2})[: ](\d{2})(?:[: ](\d{2})(?:[\., ](\d{3}))?)?)(?:\s?[|:]\s?([tTdDfFR]))?\]/.exec(this.rest());
      if (tsM) {
        const current = new Date();
        const year = Number(tsM[1] || tsM[6] || current.getFullYear());
        // todo: check if american english and if so swap tsM[5] and tsM[4] around
        const month = Number(tsM[2] || tsM[5] || current.getMonth() + 1);
        const day = Number(tsM[3] || tsM[4] || current.getDate());
        const hour = Number(tsM[7] || tsM[11] || 0);
        const minute = Number(tsM[8] || tsM[12] || 0);
        const second = Number(tsM[9] || tsM[13] || 0);
        const ms = Number(tsM[10] || tsM[14] || 0);
        const ts = Date.UTC(year, month - 1, day, hour, minute, second, ms);
        const style = tsM[15] ?? 'f';
        this.deco('timestamp', p, p + tsM[0].length, { timestamp: ts, style });
        this.eat(tsM[0].length);
        return { type: 'timestamp', timestamp: ts, style };
      }
    }

    if (c === '#') {
      const hex = /^#[A-Fa-f0-9]{6}/.exec(this.rest());
      if (hex) {
        this.deco('hexColor', p, p + 7, { content: hex[0] });
        this.eat(7);
        return { type: 'hexColor', content: hex[0] };
      }
    }

    if (c === '[') {
      const n = this.parseLink();
      if (n)
        return n;
    }

    const urlM = /^https?:\/\/[^\s\/$.?#][^\s]*/.exec(this.rest());
    if (urlM) {
      this.deco('link', p, p + urlM[0].length, { link: urlM[0] });
      this.eat(urlM[0].length);
      return { type: 'link', url: urlM[0] };
    }

    const emojiM = /^\p{Extended_Pictographic}\uFE0F?/u.exec(this.rest());
    if (emojiM) {
      this.eat(emojiM[0].length);
      return { type: 'emoji', native: emojiM[0] };
    }

    return null;
  }

  private parseAngle(): InlineNode | null {
    const p = this.pos;
    const rest = this.rest();

    const colorM = /^<(c|col|colou?r):(?<hex>#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})|[a-zA-Z]{1,21})>/i.exec(rest);
    if (colorM) {
      const { hex } = colorM.groups!;
      if (hex[0] === '#' || COLORS.includes(hex.toLowerCase())) {
        const tag = colorM[1].toLowerCase();
        const close = `</${tag}>`;
        const after = p + colorM[0].length;
        const ci = this.src.indexOf(close, after);
        if (ci !== -1) {
          this.deco('mds', p, after);
          this.deco('color', after, ci, { hex });
          this.deco('mds', ci, ci + close.length);
          this.pos = after;
          const children = this.inner(this.pos, ci);
          this.pos = ci + close.length;
          return { type: 'color', hex, children };
        }
      }
    }

    // Timestamp: <t:N[:style]>
    const tsM = /^<t:(\d+)(?::([tTdDfFR]))?>/.exec(rest);
    if (tsM) {
      const ts = Number(tsM[1]) * 1000;
      const style = tsM[2] ?? 'f';
      this.deco('timestamp', p, p + tsM[0].length, { timestamp: ts, style });
      this.eat(tsM[0].length);
      return { type: 'timestamp', timestamp: ts, style };
    }

    // Role: <@&N>
    const roleM = /^<@&(\d+)>/.exec(rest);
    if (roleM) {
      this.eat(roleM[0].length);
      return { type: 'mentionRole', id: Number(roleM[1]) };
    }

    // User: <@N>
    const userM = /^<@(-?\d+)>/.exec(rest);
    if (userM) {
      this.eat(userM[0].length);
      return { type: 'mentionUser', id: Number(userM[1]) };
    }

    // Server: <#&N>
    const srvM = /^<#&(-?\d+)>/.exec(rest);
    if (srvM) {
      this.eat(srvM[0].length);
      return { type: 'mentionServer', id: Number(srvM[1]) };
    }

    // Channel: <#N>
    const chanM = /^<#(-?\d+)>/.exec(rest);
    if (chanM) {
      this.eat(chanM[0].length);
      return { type: 'mentionChannel', id: Number(chanM[1]) };
    }

    // Bracketed URL: <url>
    const bktM = /^<(https?:\/\/[^\s>]+)>/.exec(rest);
    if (bktM) {
      const len = bktM[0].length;
      this.deco('mds', p, p + 1);
      this.deco('link', p + 1, p + len - 1, { link: bktM[1] });
      this.deco('mds', p + len - 1, p + len);
      this.eat(len);
      return { type: 'link', url: bktM[1] };
    }

    return null;
  }

  // [label](url) or [label](<url>)
  private parseLink(): InlineNode | null {
    const rest = this.rest();
    const m = /^\[([^\]]*)\]\((?:<(https?:\/\/[^\s>]+)>|(https?:\/\/[^\s)]+))\)/.exec(rest);
    if (!m)
      return null;

    const p = this.pos;
    const url = m[2] ?? m[3];
    const labelLen = m[1].length;
    const hasAngle = !!m[2];

    this.deco('mds', p, p + 1);
    const afterLabel  = p + 1 + labelLen;
    const urlBodyStart = afterLabel + (hasAngle ? 3 : 2);
    this.deco('mds', afterLabel, urlBodyStart);
    this.deco('link', urlBodyStart, urlBodyStart + url.length, { link: url });
    this.deco('mds', urlBodyStart + url.length, p + m[0].length);

    const labelParser = new InlineParser(m[1], this.tokens, this.base + p + 1, true);
    const label = labelParser.parse();

    this.eat(m[0].length);
    return { type: 'link', url, label };
  }

  parse(): InlineNode[] {
    const nodes: InlineNode[] = [];
    while (!this.done) {
      const node = this.parseOne();
      if (node === null) {
        const ch = this.eat(1);
        const last = nodes[nodes.length - 1];
        if (last?.type === 'text')
          (last as TextNode).content += ch;
        else
          nodes.push({ type: 'text', content: ch });
      } else {
        const last = nodes[nodes.length - 1];
        if (node.type === 'text' && last?.type === 'text')
          (last as TextNode).content += (node as TextNode).content;
        else
          nodes.push(node);
      }
    }
    return nodes;
  }
}

export function parseInline(text: string): InlineNode[] {
  return new InlineParser(text, []).parse();
}

export function tokenizeInline(text: string): DecoToken[] {
  const tokens: DecoToken[] = [];
  new InlineParser(text, tokens).parse();
  return tokens;
}

export function parseDocument(text: string): DocumentAST {
  const lines  = text.split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence: ```[lang]
    const cbM = /^```(.*)$/.exec(line);
    if (cbM) {
      const lang = cbM[1].trim();
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '```')
        body.push(lines[j++]);
      if (j < lines.length) {
        blocks.push({ type: 'codeBlock', ...(lang && { language: lang }), content: body.join('\n') });
        i = j + 1;
        continue;
      }
      blocks.push({ type: 'codeBlock', ...(lang && { language: lang }), content: body.join('\n') });
      i = lines.length;
      continue;
    }

    // Display math block: $$ on its own line opens a fenced block
    if (line.trim() === '$$') {
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '$$')
        body.push(lines[j++]);
      blocks.push({ type: 'mathBlock', content: body.join('\n') });
      i = j < lines.length ? j + 1 : lines.length;
      continue;
    }

    // Single-line display math: $$expr$$
    const slMathM = /^\$\$(.+)\$\$$/.exec(line.trim());
    if (slMathM) {
      blocks.push({ type: 'mathBlock', content: slMathM[1] });
      i++;
      continue;
    }

    // Heading: #{1,6} text
    const hM = /^(#{1,6}) (.*)/.exec(line);
    if (hM) {
      blocks.push({ type: 'header', level: hM[1].length as 1|2|3|4|5|6, children: parseInline(hM[2]) });
      i++;
      continue;
    }

    // Subheader: -# text
    const shM = /^-# (.+)/.exec(line);
    if (shM) {
      blocks.push({ type: 'subheader', children: parseInline(shM[1]) });
      i++;
      continue;
    }

    // Block quote: > text
    const qM = /^> (.*)/.exec(line);
    if (qM) {
      blocks.push({ type: 'quote', children: parseInline(qM[1]) });
      i++;
      continue;
    }

    // Unordered list: "- " or "* "
    if ((line[0] === '-' || line[0] === '*') && line[1] === ' ') {
      blocks.push({ type: 'listItem', children: parseInline(line.slice(2)) });
      i++;
      continue;
    }

    // Ordered list: N. text
    const nlM = /^(\d+)\. (.+)/.exec(line);
    if (nlM) {
      blocks.push({ type: 'numberedListItem', number: parseInt(nlM[1]), children: parseInline(nlM[2]) });
      i++;
      continue;
    }

    // GFM-style pipe table
    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s\-:|]+\|/.test(lines[i + 1])) {
      const aligns = parseTableAlignments(lines[i + 1]);
      const rows: TableRowNode[] = [{ type: 'tableRow', cells: parseTableCells(lines[i], true, aligns) }];
      let j = i + 2;
      while (j < lines.length && lines[j].startsWith('|'))
        rows.push({ type: 'tableRow', cells: parseTableCells(lines[j++], false, aligns) });
      blocks.push({ type: 'table', rows });
      i = j;
      continue;
    }

    blocks.push({ type: 'paragraph', children: parseInline(line) });
    i++;
  }

  return blocks;
}

export function isBigEmoji(ast: DocumentAST): boolean {
  if (ast.length !== 1 || ast[0].type !== 'paragraph')
    return false;
  const ch = ast[0].children;
  return ch.length > 0 && ch.every(n =>
    n.type === 'emoji' ||
    (n.type === 'text' && /^\s+$/.test((n as TextNode).content)),
  );
}

function parseTableAlignments(line: string): ('left' | 'center' | 'right' | null)[] {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(cell => {
      const c = cell.trim();
      if (c.startsWith(':') && c.endsWith(':'))
        return 'center';
      if (c.endsWith(':'))
        return 'right';
      if (c.startsWith(':'))
        return 'left';
      return null;
    });
}

function parseTableCells(
  line: string,
  header: boolean,
  aligns: ('left' | 'center' | 'right' | null)[],
): TableCellNode[] {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell, idx) => ({
      type: 'tableCell' as const,
      header,
      align: aligns[idx] ?? null,
      children: parseInline(cell.trim()),
    }));
}