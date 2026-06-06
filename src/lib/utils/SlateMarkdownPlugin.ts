import { Editor, Transforms, Range, Node, Text } from 'slate';
import data from '@emoji-mart/data';
import { AbstractChannel, Server, User } from './types';

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

export function withMarkdownBlocks(editor: Editor): Editor {
  const { insertText, insertBreak, deleteBackward } = editor;

  editor.insertText = (text: string) => {
    const { selection } = editor;
    if (text === ' ' && selection && Range.isCollapsed(selection)) {
      const block = currentBlock(editor);
      if (block) {
        const [node, path] = block;
        if ((node as any).type === 'paragraph') {
          const start  = Editor.start(editor, path);
          const before = Editor.string(editor, { anchor: start, focus: selection.anchor });

          // > to quote
          if (before === '>') {
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'quote' } as any, { at: path });
            return;
          }
          // - or * to list-item
          if (before === '-' || before === '*') {
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'list-item' } as any, { at: path });
            return;
          }
          // N. to numbered-list-item
          const nlM = /^(\d+)\.$/.exec(before);
          if (nlM) {
            const num = parseInt(nlM[1]);
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'numbered-list-item', number: num } as any, { at: path });
            return;
          }
          // ``` to code-block
          if (before === '```' || /^```\s*$/.test(before)) {
            const lang = before.slice(3).trim();
            clearToStart(editor, path);
            Transforms.setNodes(editor, { type: 'code-block', ...(lang && { language: lang }) } as any, { at: path });
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

      // ``` paragraph + Enter to code-block conversion
      if ((node as any).type === 'paragraph' && /^```(.*)$/.test(blockText)) {
        const lang = blockText.slice(3).trim();
        Editor.withoutNormalizing(editor, () => {
          const start = Editor.start(editor, path);
          const end = Editor.end(editor, path);
          Transforms.select(editor, { anchor: start, focus: end });
          Transforms.delete(editor);
          Transforms.setNodes(editor, { type: 'code-block', ...(lang && { language: lang }) } as any, { at: path });
        });
        return;
      }

      // Empty continuation block to revert to paragraph
      if (blockText === '' && ['quote', 'list-item', 'numbered-list-item', 'code-block'].includes(node.type)) {
        Transforms.setNodes(editor, { type: 'paragraph' } as any, { at: path });
        return;
      }

      switch (node.type) {
        case 'quote':
        case 'list-item':
          Transforms.insertNodes(editor, { type: node.type, children: [{ text: '' }] } as any);
          return;

        case 'numbered-list-item':
          const nextNum = (node.number ?? 1) + 1;
          Transforms.insertNodes(editor, { type: 'numbered-list-item', number: nextNum, children: [{ text: '' }] } as any);
          return;

        case 'code-block':
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
        Transforms.setNodes(editor, { type: 'paragraph' } as any, { at: path });
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
    case 'list-item': return `- ${text}`;
    case 'numbered-list-item': return `${block.number ?? 1}. ${text}`;
    case 'code-block': return `\`\`\`${block.language ?? ''}\n${text}\n\`\`\``;
    default: return text;
  }
}

export function slateFromMarkdown(text: string | null | undefined): any[] {
  if (!text)
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  const lines  = text.split('\n');
  const result: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const cbM = /^```(.*)$/.exec(line);
    if (cbM) {
      const lang = cbM[1].trim();
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '```')
        body.push(lines[j++]);
      if (j < lines.length) {
        result.push({ type: 'code-block', ...(lang && { language: lang }), children: [{ text: body.join('\n') }] });
        i = j + 1;
        continue;
      }
      result.push({ type: 'code-block', ...(lang && { language: lang }), children: [{ text: body.join('\n') }] });
      i = lines.length;
      continue;
    }

    const qM = /^> (.*)/.exec(line);
    if (qM) {
      result.push({ type: 'quote', children: [{ text: qM[1] }] });
      i++;
      continue;
    }

    if ((line[0] === '-' || line[0] === '*') && line[1] === ' ') {
      result.push({ type: 'list-item', children: [{ text: line.slice(2) }] });
      i++;
      continue;
    }

    const nlM = /^(\d+)\. (.*)/.exec(line);
    if (nlM) {
      result.push({ type: 'numbered-list-item', number: parseInt(nlM[1]), children: [{ text: nlM[2] }] });
      i++;
      continue;
    }

    result.push({ type: 'paragraph', children: [{ text: line }] });
    i++;
  }

  return result.length > 0 ? result : [{ type: 'paragraph', children: [{ text: '' }] }];
}

function getEmojiNative(name: string): string | null {
  return (data as any).emojis?.[name]?.skins?.[0]?.native ?? null;
}

export function withAutoFormatMentions(
  editor: Editor,
  getUser: (id: number) => User | undefined,
  getChannel: (id: number) => AbstractChannel | undefined,
  getServer: (id: number) => Server | undefined,
  getUserFromName: (username: string, discriminator: number) => User | undefined
): Editor {
  const { normalizeNode } = editor;

  const MENTION_PATTERNS = [
    {
      re: /<@&(\d+)>/,
      build: (id: number, raw: string) => ({ type: 'mention-role', id, children: [{ text: raw }] }),
    },
    {
      re: /<@(-?\d+)>/,
      build: (id: number, raw: string) => ({ type: 'mention-user', id, user: getUser(id), children: [{ text: raw }] }),
    },
    {
      re: /<#&(-?\d+)>/,
      build: (id: number, raw: string) => ({ type: 'mention-server', id, server: getServer(id), children: [{ text: raw }] }),
    },
    {
      re: /<#(-?\d+)>/,
      build: (id: number, raw: string) => ({ type: 'mention-channel', id, channel: getChannel(id), children: [{ text: raw }] }),
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
            voidNode: build(Number(m[1]), m[0])
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
              voidNode: { type: 'mention-user', id: user.id, user, children: [{ text: `<@${user.id}>` }] }
            };
        }
      }

      // :emoji_name: pattern (synchronous lookup)
      const emojiM = /:([a-z0-9_+\-]+):/i.exec(text);
      if (emojiM) {
        const native = getEmojiNative(emojiM[1]);
        if (native && (!best || emojiM.index < best.index))
          best = {
            index: emojiM.index,
            end: emojiM.index + emojiM[0].length,
            voidNode: { type: 'emoji', emoji: native, children: [{ text: native }] },
          };
      }

      const emojiM2 = /(\p{Extended_Pictographic})\uFE0F?/u.exec(text);
      if (emojiM2) {
        if (!best || emojiM2.index < best.index)
          best = {
            index: emojiM2.index,
            end: emojiM2.index + emojiM2[1].length,
            voidNode: { type: 'emoji', emoji: emojiM2[1], children: [{ text: emojiM2[1] }] },
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

          const toInsert: any[] = [];
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
            focus: { path: afterPath, offset: targetOffset },
          });
        });

        return;
      }
    }

    normalizeNode(entry);
  };

  return editor;
}