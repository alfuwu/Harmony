import { Editor, Transforms, Range, Node, Text } from 'slate';
import data from '@emoji-mart/data';
import { AbstractChannel, Server, User } from './Types';

function currentBlock(editor: Editor): [any, number[]] | null {
  const m = Editor.above<any>(editor, {
    match: n => !Editor.isEditor(n) && Editor.isBlock(editor, n as any),
  });
  return m ?? null;
}

function isAtBlockStart(editor: Editor): boolean {
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection))
    return false;
  const b = currentBlock(editor);
  if (!b)
    return false;
  const [, path] = b;
  return Editor.string(editor, { anchor: Editor.start(editor, path), focus: selection.anchor }) === '';
}

function clearToStart(editor: Editor, path: number[]) {
  const start = Editor.start(editor, path);
  const end = editor.selection!.anchor;
  Transforms.select(editor, { anchor: start, focus: end });
  Transforms.delete(editor);
}

const REVERTIBLE_TYPES = [
  'quote', 'listItem', 'numberedListItem', 'codeBlock', 'mathBlock',
  'nestedQuote', 'quoteListItem', 'quoteNumberedListItem',
  'listItemQuote', 'numberedListItemQuote', 'collapsible'
] as const;

const REVERSIONS: Record<string, string> = {
  'nestedQuote': 'quote', 'quoteListItem': 'quote', 'quoteNumberedListItem': 'quote',
  'listItemQuote': 'listItem', 'numberedListItemQuote': 'numberedListItem'
} as const;

export function withMarkdownBlocks(editor: Editor): Editor {
  const { insertText, insertBreak, deleteBackward } = editor;

  editor.insertText = (text: string) => {
    const { selection } = editor;
    if (text === ' ' && selection && Range.isCollapsed(selection)) {
      const block = currentBlock(editor);
      if (block) {
        const [node, path] = block;
        const nodeType = (node as any).type;

        if (nodeType === 'paragraph') {
          const start = Editor.start(editor, path);
          const before = Editor.string(editor, { anchor: start, focus: selection.anchor });

          // >+ to collapsible
          /*if (before === '>+') {
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'collapsible' } as any, { at: path });
            return;
          }*/
          // > to quote
          if (before === '>') {
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'quote' } as any, { at: path });
            return;
          }
          // - or * to list item
          if (before === '-' || before === '*') {
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'listItem' } as any, { at: path });
            return;
          }
          // N. to numbered list item
          const nlM = /^(\d+)\.$/.exec(before);
          if (nlM) {
            const num = parseInt(nlM[1]);
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'numberedListItem', number: num } as any, { at: path });
            return;
          }
          // ``` to code block
          if (before === '```' || /^```\s*$/.test(before)) {
            const lang = before.slice(3).trim();
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'codeBlock', ...(lang && { language: lang }) } as any, { at: path });
            return;
          }
        }

        else if (nodeType === 'quote') {
          const start = Editor.start(editor, path);
          const before = Editor.string(editor, { anchor: start, focus: selection.anchor });

          if (before === '>') {
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'nestedQuote' } as any, { at: path });
            return;
          }
          if (before === '-' || before === '*') {
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'quoteListItem' } as any, { at: path });
            return;
          }
          const qnlM = /^(\d+)\.$/.exec(before);
          if (qnlM) {
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'quoteNumberedListItem', number: parseInt(qnlM[1]) } as any, { at: path });
            return;
          }
        }

        else if (nodeType === 'listItem') {
          const start = Editor.start(editor, path);
          const before = Editor.string(editor, { anchor: start, focus: selection.anchor });
          if (before === '>') {
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'listItemQuote' } as any, { at: path });
            return;
          }
        }

        else if (nodeType === 'numberedListItem') {
          const start = Editor.start(editor, path);
          const before = Editor.string(editor, { anchor: start, focus: selection.anchor });
          if (before === '>') {
            clearToStart(editor, path);
            Transforms.setNodes(editor, {
              type: 'numberedListItemQuote',
              number: (node as any).number ?? 1,
            } as any, { at: path });
            return;
          }
        }
      }
    }
    insertText(text);
  };

  editor.insertBreak = () => {
    const block = currentBlock(editor);
    if (block) {
      const [node, path] = block as [any, number[]];
      const blockText = Node.string(node);

      // ``` paragraph + Enter to code block conversion
      if (node.type === 'paragraph' && /^```(.*)$/.test(blockText)) {
        const lang = blockText.slice(3).trim();
        Editor.withoutNormalizing(editor, () => {
          const start = Editor.start(editor, path);
          const end = Editor.end(editor, path);
          Transforms.select(editor, { anchor: start, focus: end });
          Transforms.delete(editor);
          Transforms.setNodes(editor, { type: 'codeBlock', ...(lang && { language: lang }) } as any, { at: path });
        });
        return;
      }

      if ((node as any).type === 'paragraph' && blockText.trim() === '$$') {
        Editor.withoutNormalizing(editor, () => {
          Transforms.select(editor, { anchor: Editor.start(editor, path), focus: Editor.end(editor, path) });
          Transforms.delete(editor);
          Transforms.setNodes(editor, { type: 'mathBlock' } as any, { at: path });
        });
        return;
      }

      // Empty continuation block to revert to paragraph
      if (blockText === '' && REVERTIBLE_TYPES.includes(node.type)) {
        Transforms.setNodes(editor, { type: 'paragraph' } as any, { at: path });
        return;
      }

      switch (node.type) {
        case 'quote':
        case 'listItem':
          Transforms.insertNodes(editor, { type: node.type, children: [{ text: '' }] } as any);
          return;

        case 'numberedListItem': {
          const nextNum = (node.number ?? 1) + 1;
          Transforms.insertNodes(editor, { type: 'numberedListItem', number: nextNum, children: [{ text: '' }] } as any);
          return;
        }

        case 'nestedQuote':
          Transforms.insertNodes(editor, { type: 'nestedQuote', children: [{ text: '' }] } as any);
          return;

        case 'quoteListItem':
          Transforms.insertNodes(editor, { type: 'quoteListItem', children: [{ text: '' }] } as any);
          return;

        case 'quoteNumberedListItem': {
          const nextNum = (node.number ?? 1) + 1;
          Transforms.insertNodes(editor, { type: 'quoteNumberedListItem', number: nextNum, children: [{ text: '' }] } as any);
          return;
        }

        case 'listItemQuote':
          Transforms.insertNodes(editor, { type: 'listItemQuote', children: [{ text: '' }] } as any);
          return;

        case 'numberedListItemQuote': {
          const nextNum = (node.number ?? 1) + 1;
          Transforms.insertNodes(editor, { type: 'numberedListItemQuote', number: nextNum, children: [{ text: '' }] } as any);
          return;
        }

        case 'codeBlock':
        case 'mathBlock':
        case 'collapsible':
          editor.insertText('\n');
          return;
      }
    }
    insertBreak();
  };

  editor.deleteBackward = (...args) => {
    const block = currentBlock(editor);
    if (block) {
      const [node, path] = block as [any, number[]];
      if ((node as any).type !== 'paragraph' && isAtBlockStart(editor)) {
        const type = REVERSIONS[(node as any).type] ?? 'paragraph';
        Transforms.setNodes(editor, { type } as any, { at: path });
        return;
      }
    }
    deleteBackward(...args);
  };

  return editor;
}

export function serializeSlateToMarkdown(nodes: any[]): string {
  return nodes.map(serializeBlock).join('\n');
}

function serializeBlock(block: any): string {
  const text = Node.string(block);
  switch (block.type) {
    case 'quote': return `> ${text}`;
    case 'listItem': return `- ${text}`;
    case 'numberedListItem': return `${block.number ?? 1}. ${text}`;
    case 'codeBlock': return `\`\`\`${block.language ?? ''}\n${text}\n\`\`\``;
    case 'mathBlock': return `$$\n${text}\n$$`;
    case 'nestedQuote': return `> > ${text}`;
    case 'quoteListItem': return `> - ${text}`;
    case 'quoteNumberedListItem': return `> ${block.number ?? 1}. ${text}`;
    case 'listItemQuote': return `- > ${text}`;
    case 'numberedListItemQuote': return `${block.number ?? 1}. > ${text}`;
    case 'collapsible': {
      const nl = text.indexOf('\n');
      const title = nl >= 0 ? text.slice(0, nl) : text;
      const body = nl >= 0 ? text.slice(nl + 1) : '';
      return body ? `>+ ${title}\n${body}\n>-` : `>+ ${title}\n>-`;
    }
    default: return text;
  }
}

export function slateFromMarkdown(text: string | null | undefined): any[] {
  if (!text)
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  const lines = text.split('\n');
  const result: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '$$') {
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '$$')
        body.push(lines[j++]);
      result.push({ type: 'mathBlock', children: [{ text: body.join('\n') }] });
      i = j < lines.length ? j + 1 : lines.length;
      continue;
    }

    const slMathM = /^\$\$(.+)\$\$$/.exec(line.trim());
    if (slMathM) {
      result.push({ type: 'mathBlock', children: [{ text: slMathM[1] }] });
      i++;
      continue;
    }

    const cbM = /^```(.*)$/.exec(line);
    if (cbM) {
      const lang = cbM[1].trim();
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '```')
        body.push(lines[j++]);
      if (j < lines.length) {
        result.push({ type: 'codeBlock', ...(lang && { language: lang }), children: [{ text: body.join('\n') }] });
        i = j + 1;
        continue;
      }
      result.push({ type: 'codeBlock', ...(lang && { language: lang }), children: [{ text: body.join('\n') }] });
      i = lines.length;
      continue;
    }

    /*if (line.startsWith('>+ ')) {
      const titleLine = line.slice(3);
      const bodyLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '>-')
        bodyLines.push(lines[j++]);
      const combined = bodyLines.length > 0
        ? `${titleLine}\n${bodyLines.join('\n')}`
        : titleLine;
      result.push({ type: 'collapsible', children: [{ text: combined }] });
      i = j < lines.length ? j + 1 : lines.length;
      continue;
    }*/

    if (line.startsWith('> > ')) {
      result.push({ type: 'nestedQuote', children: [{ text: line.slice(4) }] });
      i++;
      continue;
    }

    if (line.startsWith('> - ') || line.startsWith('> * ')) {
      result.push({ type: 'quoteListItem', children: [{ text: line.slice(4) }] });
      i++;
      continue;
    }

    const qnlM = /^> (\d+)\. (.*)/.exec(line);
    if (qnlM) {
      result.push({ type: 'quoteNumberedListItem', number: parseInt(qnlM[1]), children: [{ text: qnlM[2] }] });
      i++;
      continue;
    }

    const qM = /^> (.*)/.exec(line);
    if (qM) {
      result.push({ type: 'quote', children: [{ text: qM[1] }] });
      i++;
      continue;
    }

    if ((line.startsWith('- > ') || line.startsWith('* > '))) {
      result.push({ type: 'listItemQuote', children: [{ text: line.slice(4) }] });
      i++;
      continue;
    }

    if ((line[0] === '-' || line[0] === '*') && line[1] === ' ') {
      result.push({ type: 'listItem', children: [{ text: line.slice(2) }] });
      i++;
      continue;
    }

    const nlqM = /^(\d+)\. > (.*)/.exec(line);
    if (nlqM) {
      result.push({ type: 'numberedListItemQuote', number: parseInt(nlqM[1]), children: [{ text: nlqM[2] }] });
      i++;
      continue;
    }

    const nlM = /^(\d+)\. (.*)/.exec(line);
    if (nlM) {
      result.push({ type: 'numberedListItem', number: parseInt(nlM[1]), children: [{ text: nlM[2] }] });
      i++;
      continue;
    }

    result.push({ type: 'paragraph', children: [{ text: line }] });
    i++;
  }

  return result.length > 0 ? result : [{ type: 'paragraph', children: [{ text: '' }] }];
}

function getEmojiNative(name: string): string | null {
  const d = data as any;

  const candidates = [
    name,
    name.replace(/_/g, '-'),
    name.replace(/-/g, '_')
  ];

  for (const c of candidates) {
    const n = d.emojis?.[c]?.skins?.[0]?.native;
    if (n)
      return n;
  }

  for (const c of candidates) {
    const aliasId = d.aliases?.[c];
    if (aliasId) {
      for (const ac of [aliasId, aliasId.replace(/_/g, '-'), aliasId.replace(/-/g, '_')]) {
        const n = d.emojis?.[ac]?.skins?.[0]?.native;
        if (n)
          return n;
      }
    }
  }

  return null;
}

export function withAutoFormatMentions(
  editor: Editor,
  getUser: (id: bigint) => User | undefined,
  getChannel: (id: bigint) => AbstractChannel | undefined,
  getServer: (id: bigint) => Server | undefined,
  getUserFromName: (username: string, discriminator: number) => User | undefined
): Editor {
  const { normalizeNode } = editor;

  const MENTION_PATTERNS = [
    {
      re: /<@&(\d+)>/,
      build: (id: bigint, raw: string) => ({ type: 'mentionRole', id, children: [{ text: raw }] })
    },
    {
      re: /<@(-?\d+)>/,
      build: (id: bigint, raw: string) => ({ type: 'mentionUser', id, user: getUser(id), children: [{ text: raw }] })
    },
    {
      re: /<#&(-?\d+)>/,
      build: (id: bigint, raw: string) => ({ type: 'mentionServer', id, server: getServer(id), children: [{ text: raw }] })
    },
    {
      re: /<#(-?\d+)>/,
      build: (id: bigint, raw: string) => ({ type: 'mentionChannel', id, channel: getChannel(id), children: [{ text: raw }] })
    }
  ];

  editor.normalizeNode = (entry) => {
    const [node, path] = entry;

    if (Text.isText(node) && path.length === 2) {
      const text = node.text;

      const trailingBackslash =
        text.length > 0 &&
        text[text.length - 1] === '\\' &&
        (text.length < 2 || text[text.length - 2] !== '\\');

      if (trailingBackslash) {
        try {
          const parentPath = path.slice(0, -1);
          const childIndex = path[path.length - 1];
          const parent = Node.get(editor, parentPath) as any;
          const nextSib = parent.children?.[childIndex + 1];

          if (nextSib && editor.isVoid(nextSib)) {
            const rawText = Node.string(nextSib);
            const sibPath = [...parentPath, childIndex + 1] as any;

            Editor.withoutNormalizing(editor, () => {
              Transforms.removeNodes(editor, { at: sibPath });
              Transforms.insertText(editor, rawText, { at: { path, offset: text.length } });
              const newOffset = text.length + rawText.length;
              Transforms.select(editor, {
                anchor: { path, offset: newOffset },
                focus: { path, offset: newOffset },
              });
            });
            return;
          }
        } catch { /* ignore transient path errors */ }
      }

      let best: { index: number; end: number; voidNode: any; focus?: number; } | null = null;

      for (const { re, build } of MENTION_PATTERNS) {
        const m = re.exec(text);
        if (!m)
          continue;
        if (!best || m.index < best.index)
          best = {
            index: m.index,
            end: m.index + m[0].length,
            voidNode: build(BigInt(m[1]), m[0])
          };
      }

      const everyoneM = /@(everyone|here)(?!\w)/.exec(text);
      if (everyoneM) {
        if (!best || everyoneM.index < best.index)
          best = {
            index: everyoneM.index,
            end: everyoneM.index + everyoneM[0].length,
            voidNode: {
              type: 'mentionEveryone',
              subtype: everyoneM[1] as 'everyone' | 'here',
              children: [{ text: `@${everyoneM[1]}` }]
            }
          };
      }

      const usernameM = /@([\p{L}\p{Nd}_\-\.~]{2,})(?:#(\d{4}))?\s/ui.exec(text);
      if (usernameM) {
        if (!best || usernameM.index < best.index) {
          const user = getUserFromName(usernameM[1], Number(usernameM[2]) || 0);
          if (user)
            best = {
              index: usernameM.index,
              end: usernameM.index + usernameM[0].length - 1,
              focus: usernameM.index + usernameM[0].length,
              voidNode: { type: 'mentionUser', id: user.id, user, children: [{ text: `<@${user.id}>` }] }
            };
        }
      }

      // :emoji_name: pattern (synchronous lookup)
      // TODO: implement server searching, too. resolve duplicate names by user's server order, with top keeping :emoji_name: and all below getting :emoji_name~1:, :emoji_name~2:, etc
      const emojiM = /:([a-z0-9_+\-]+):/i.exec(text);
      if (emojiM) {
        const native = getEmojiNative(emojiM[1]);
        if (native && (!best || emojiM.index < best.index))
          best = {
            index: emojiM.index,
            end: emojiM.index + emojiM[0].length,
            voidNode: { type: 'emoji', emoji: { name: native }, children: [{ text: native }] },
          };
      }

      const emojiM2 = /([\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}\uFE0F?)/u.exec(text);
      if (emojiM2) {
        if (!best || emojiM2.index < best.index)
          best = {
            index: emojiM2.index,
            end: emojiM2.index + emojiM2[1].length,
            voidNode: { type: 'emoji', emoji: { name: emojiM2[1] }, children: [{ text: emojiM2[1] }] },
          };
      }

      if (best && best.index > 0 && text[best.index - 1] === '\\' && text[best.index - 2] !== '\\')
        best = null;

      if (best) {
        const { index: start, end, voidNode, focus } = best;
        const before = text.slice(0, start);
        const after  = text.slice(end);

        let origOffset: number | null = null;
        {
          const sel = editor.selection;
          if (sel && Range.isCollapsed(sel)) {
            const { path: ap, offset: ao } = sel.anchor;
            if (ap.length === path.length && ap.every((v, i) => v === path[i]))
              origOffset = ao;
          }
        }

        Editor.withoutNormalizing(editor, () => {
          Transforms.removeNodes(editor, { at: path });

          const toInsert = [];
          if (before)
            toInsert.push({ text: before });
          toInsert.push(voidNode);
          toInsert.push({ text: after });
          Transforms.insertNodes(editor, toInsert, { at: path });

          const parentPath = path.slice(0, -1);
          const index = path[path.length - 1];
          const afterPath = [...parentPath, index + (before ? 2 : 1)];

          let targetOffset: number;

          if (focus !== undefined)
            targetOffset = focus - end;
          else if (origOffset !== null && origOffset > end)
            targetOffset = origOffset - end;
          else
            targetOffset = 0;

          targetOffset = Math.max(0, Math.min(targetOffset, after.length));

          Transforms.select(editor, {
            anchor: { path: afterPath, offset: targetOffset },
            focus: { path: afterPath, offset: targetOffset }
          });
        });

        return;
      }
    }

    normalizeNode(entry);
  };

  return editor;
}