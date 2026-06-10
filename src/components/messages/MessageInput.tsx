import {
  useState, useMemo, useEffect, useRef,
  forwardRef, useImperativeHandle, CSSProperties,
  ReactNode
} from "react";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { createEditor, Node, Editor, Transforms, Range, Text, BaseElement, BaseEditor } from "slate";
import { HistoryEditor, withHistory } from "slate-history";
import ReactDOM from "react-dom";

import { ChannelState, useChannelState } from "../../lib/state/Channels";
import { MessageState, useMessageState } from "../../lib/state/Messages";
import { AuthState, useAuthState } from "../../lib/state/Auth";
import { UserState, useUserState } from "../../lib/state/Users";
import { ServerState, useServerState } from "../../lib/state/Servers";

import { AbstractChannel, Channel, Role, Server, User, Emoji as CustomEmoji } from "../../lib/utils/types";
import { getAvatar, getDisplayName } from "../../lib/utils/UserUtils";
import { getChannelIcon } from "../../lib/utils/ChannelUtils";
import { sendMessage } from "../../lib/api/messageApi";
import { rootRef } from "../../App";

import { ShikiEditorHighlighter } from "../../lib/utils/ShikiEditorHighlighter";
import { tokenizeInline } from "../../lib/utils/MarkdownParser";
import {
  renderEmoji,
  formatTimestamp,
  superHighlighter,
  highlighterReady,
  ensureLanguageLoaded,
  getShikiTheme
} from "../../lib/utils/MarkdownRenderer";
import {
  withMarkdownBlocks,
  withAutoFormatMentions,
  serializeSlateToMarkdown,
  slateFromMarkdown,
} from "../../lib/utils/SlateMarkdownPlugin";

import data, { Emoji } from "@emoji-mart/data";
import { init, SearchIndex } from "emoji-mart";
import { connection } from "../../lib/api/signalrClient";
import { getEmojiUrl, getIcon } from "../../lib/utils/ServerUtils";

import katex from 'katex';

init({ data });

function CodeBlockElement({
  attributes,
  children,
  element,
  editor,
  shikiHighlighter
}: {
  attributes: any;
  children: React.ReactNode;
  element: any;
  editor: BaseEditor & HistoryEditor & ReactEditor;
  shikiHighlighter: ShikiEditorHighlighter;
}) {
  const blockIndex = useMemo(() => {
    try { return ReactEditor.findPath(editor, element)[0]; }
    catch { return -1; }
  }, [editor, element]);

  const [html, setHtml] = useState<string | null>(
    () => blockIndex >= 0 ? shikiHighlighter.getHighlightedHtml(blockIndex) : null,
  );

  useEffect(() => {
    if (blockIndex < 0)
      return;
    setHtml(shikiHighlighter.getHighlightedHtml(blockIndex));
    return shikiHighlighter.subscribe((updatedIndex) => {
      if (updatedIndex === blockIndex)
        setHtml(shikiHighlighter.getHighlightedHtml(blockIndex));
    });
  }, [blockIndex, shikiHighlighter]);

  return (
    <div {...attributes} className="editor-code-block">
      <div spellCheck={false} style={{
        position: 'relative',
        color: 'transparent',
        caretColor: 'var(--text-normal, #abb2bf)',
      }}>
        {html !== null && (
          <div
            contentEditable={false}
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              userSelect: 'none',
              font: 'inherit',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              overflow: 'hidden',
              margin: 0,
              padding: 0,
              color: '#abb2bf'
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
        {children}
      </div>
    </div>
  );
}

const REGIONAL_INDICATOR_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('').map((c, i) => ({
  id: `regional_indicator_letter_${c}`,
  type: 'emoji' as const,
  skins: [{ native: String.fromCodePoint(0x1F1E6 + i) }]
}));

function isFlag(native: string): boolean {
  if (!native)
    return false;
  const pts = [...native].map(c => c.codePointAt(0) ?? 0);
  return pts.length === 2 && pts.every(p => p >= 0x1F1E6 && p <= 0x1F1FF);
}

function normalizeEmojiId(id: string, native?: string): string {
  let n = (id ?? "").replace(/-/g, "_");
  if (native && isFlag(native) && !n.startsWith("flag_") && !n.startsWith("regional_"))
    n = `flag_${n}`;
  return n;
}

const withMentions = (editor: Editor) => {
  const { isInline, isVoid, markableVoid } = editor;
  const isSpecial = (el: any) => el.type?.startsWith("mention") || el.type === "emoji" || el.type === "customEmoji";
  editor.isInline = el => isSpecial(el) || isInline(el);
  editor.isVoid = el => isSpecial(el) || isVoid(el);
  editor.markableVoid = el => isSpecial(el) || markableVoid(el);
  return editor;
};

const ins = (editor: Editor, node: any) => {
  Transforms.insertNodes(editor, node);
  Transforms.move(editor);
};

const insertUserMention = (editor: Editor, user: User) =>
  ins(editor, { type: 'mentionUser', id: user.id, user, children: [{ text: `<@${user.id}>` }] });
const insertChannelMention = (editor: Editor, ch: AbstractChannel) =>
  ins(editor, { type: 'mentionChannel', id: ch.id, channel: ch, children: [{ text: `<#${ch.id}>` }] });
const insertServerMention  = (editor: Editor, srv: Server) =>
  ins(editor, { type: 'mentionServer', id: srv.id, server: srv, children: [{ text: `<#&${srv.id}>` }] });
const insertRoleMention = (editor: Editor, role: Role) =>
  ins(editor, { type: 'mentionRole', id: role.id, role, children: [{ text: `<@&${role.id}>` }] });
const insertEmoji = (editor: Editor, emoji: Emoji) => {
  // @ts-expect-error
  const native = emoji.native ?? emoji.skins?.[0]?.native ?? "";
  ins(editor, { type: "emoji", emoji: native, children: [{ text: native }] });
};
const insertCustomEmoji = (editor: Editor, name: string, id: number, url: string) =>
  ins(editor, {
    type: "customEmoji",
    emojiName: name,
    emojiId: id,
    emojiUrl: url,
    children: [{ text: `<:${name}:${id}>` }],
  });

function serializeInlineNode(node: any): string {
  if (node.text !== undefined)
    return node.text as string;
  switch (node.type) {
    case 'mentionUser': return `<@${node.id}>`;
    case 'mentionChannel': return `<#${node.id}>`;
    case 'mentionServer': return `<#&${node.id}>`;
    case 'mentionRole': return `<@&${node.id}>`;
    case "emoji": return (node.emoji as string) ?? "";
    case "customEmoji": return `<:${node.emojiName}:${node.emojiId}>`;
    default:
      if (node.children)
        return (node.children as any[]).map(serializeInlineNode).join("");
      return "";
  }
}

function serializeFragmentToText(
  nodes: any[],
  startsAtFirstBlock = true,
  endsAtLastBlock = true
): string {
  return nodes
    .map((block, i) => {
      const isFirst = i === 0;
      const isLast  = i === nodes.length - 1;
      const content = (block.children ?? []).map(serializeInlineNode).join('');
 
      const partialStart = isFirst && !startsAtFirstBlock;
      const partialEnd = isLast  && !endsAtLastBlock;
 
      switch (block.type) {
        case 'quote':
          return partialStart ? content : `> ${content}`;
        case 'list-item':
          return partialStart ? content : `- ${content}`;
        case 'numbered-list-item':
          return partialStart ? content : `${block.number ?? 1}. ${content}`;
        case 'math-block':
          return (partialStart || partialEnd) ? content : `$$\n${content}\n$$`;
        case 'code-block':
          return (partialStart || partialEnd)
            ? content
            : `\`\`\`${block.language ?? ''}\n${content}\n\`\`\``;
        case 'nested-quote':
          return partialStart ? content : `> > ${content}`;
        case 'quote-list-item':
          return partialStart ? content : `> - ${content}`;
        case 'quote-numbered-list-item':
          return partialStart ? content : `> ${block.number ?? 1}. ${content}`;
        case 'list-item-quote':
          return partialStart ? content : `- > ${content}`;
        case 'numbered-list-item-quote':
          return partialStart ? content : `${block.number ?? 1}. > ${content}`;
        case 'collapsible': {
          if (partialStart || partialEnd)
            return content;
          const nl = content.indexOf('\n');
          const title = nl >= 0 ? content.slice(0, nl) : content;
          const body  = nl >= 0 ? content.slice(nl + 1) : '';
          return body ? `>+ ${title}\n${body}\n>-` : `>+ ${title}\n>-`;
        }
        default:
          return content;
      }
    })
    .join('\n');
}

function selectionAtBlockBoundary(
  editor: Editor,
  point: ReturnType<typeof Range.edges>[0],
  boundary: 'start' | 'end'
): boolean {
  try {
    const blockPath = [point.path[0]];
    const ref = boundary === 'start'
      ? Editor.start(editor, blockPath)
      : Editor.end(editor, blockPath);
    return ref.path.every((v, i) => v === point.path[i]) && point.offset === ref.offset;
  } catch {
    return false;
  }
}

export type MessageInputHandle = {
  setText(text: string | null | undefined, select?: boolean): void;
  focus(moveToEnd?: boolean, preventScroll?: boolean): void;
};

const MessageInput = forwardRef(function MessageInput({
  isChannel = true,
  placeholderText,
  placeholder,
  initialText,
  setText,
  onEnter,
  onKey,
  giveNull = false,
  style,
  authState,
  channelState,
  messageState,
  userState,
  serverState
}: {
  isChannel?: boolean;
  placeholderText?: string;
  placeholder?: ReactNode;
  initialText?: string | null;
  setText?: React.Dispatch<React.SetStateAction<string | null | undefined>>;
  onEnter?: (s: string) => void;
  onKey?: (e: React.KeyboardEvent<HTMLDivElement>) => boolean;
  giveNull?: boolean;
  style?: CSSProperties;
  authState?: AuthState;
  channelState?: ChannelState;
  messageState?: MessageState;
  userState?: UserState;
  serverState?: ServerState;
}, ref) {
  const { token, user, userSettings } = authState ?? useAuthState();
  const { channels, currentChannel, getChannelDraft, setChannelDraft, getPendingReplies, clearPendingReplies } = channelState ?? useChannelState();
  const { addMessage } = messageState ?? useMessageState();
  const { users, getMember } = userState ?? useUserState();
  serverState ??= useServerState();
  const { servers, currentServer } = serverState;

  const usersRef = useRef(users);
  const channelsRef = useRef(channels);
  const serversRef = useRef(servers);
  useEffect(() => { usersRef.current    = users;    }, [users]);
  useEffect(() => { channelsRef.current = channels; }, [channels]);
  useEffect(() => { serversRef.current  = servers;  }, [servers]);

  const editor = useMemo(
    () => withHistory(
      withAutoFormatMentions(
        withMarkdownBlocks(
          withMentions(withReact(createEditor()))
        ),
        (id) => usersRef.current.find((u: User) => u.id === id),
        (id) => channelsRef.current.find((c: AbstractChannel) => c.id === id),
        (id) => serversRef.current.find((s: Server) => s.id === id),
        (username, discriminator) => usersRef.current.find(
          u => u.username.toLowerCase() === username.toLowerCase() && u.discriminator === discriminator
        )
      )
    ) as BaseEditor & HistoryEditor & ReactEditor,
    []
  );

  useEffect(() => {
    if (initialText) {
      editor.selection = null;
      try {
        Editor.normalize(editor, { force: true });
      } catch { /* ignore */ }
      editor.onChange();
    }
  }, []);

  const prevChannelIdRef = useRef<number | undefined>(currentChannel?.id);

  useEffect(() => {
    if (!isChannel)
      return;

    const prevId = prevChannelIdRef.current;
    const newId  = currentChannel?.id;
    if (prevId === newId)
      return;

    if (prevId !== undefined)
      setChannelDraft(prevId, serializeSlateToMarkdown(editor.children));

    const draft = newId !== undefined ? getChannelDraft(newId) : "";
    editor.children = slateFromMarkdown(draft);
    editor.selection = null;
    editor.history = { undos: [], redos: [] };
    try { Editor.normalize(editor, { force: true }); } catch { /* ignore */ }
    try { Transforms.select(editor, Editor.end(editor, [])); } catch { editor.selection = null; }
    editor.onChange();

    prevChannelIdRef.current = newId;
  }, [currentChannel?.id]);

  const editableRef = useRef<HTMLDivElement | null>(null);
  const [target, setTarget] = useState<Range | null>(null);
  const [search, setSearch] = useState("");
  const [index, setIndex] = useState(0);
  const [emojiResults, setEmojiResults] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!search.startsWith(":") || search.length < 2) {
        setEmojiResults([]);
        return;
      }
      const raw = search.slice(1);
      const q = raw.replace(/_/g, " ");
      const results = await SearchIndex.search(q);
      if (!cancelled)
        setEmojiResults((results ?? []).map((e: Emoji) => ({ ...e, type: "emoji" })));
    }
    run();
    return () => { cancelled = true; };
  }, [search]);

  const shikiHighlighter = useMemo(() => new ShikiEditorHighlighter(ensureLanguageLoaded), []);
  const [hlReady, setHlReady] = useState(() => !!superHighlighter);

  useEffect(() => {
    if (superHighlighter)
      return;
    let alive = true;
    highlighterReady.then(() => { if (alive) setHlReady(true); });
    return () => { alive = false; };
  }, []);

  const triggerShikiAll = () => {
    if (!superHighlighter)
      return;
    const theme = getShikiTheme(userSettings ?? null);
    editor.children.forEach((block: any, i: number) => {
      if (block?.type === 'code-block') {
        shikiHighlighter.update(
          i,
          Node.string(block),
          block.language ?? 'text',
          theme,
          superHighlighter!
        );
      } else {
        shikiHighlighter.clear(i);
      }
    });
  };
  const shikiTheme = useMemo(
    () => getShikiTheme(userSettings ?? null),
    [userSettings?.theme]
  );
  useEffect(() => {
    if (hlReady && superHighlighter)
      triggerShikiAll();
  }, [hlReady, shikiTheme]);

  useEffect(() => {
    return () => shikiHighlighter.clearAll();
  }, [shikiHighlighter]);

  useEffect(() => {
    if (!isChannel)
      return;
    const handler = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName.toLowerCase();
      // @ts-expect-error
      if (document.activeElement === editableRef.current || tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable)
        return;
      if (!['a', 'v', 'Backspace', 'Delete', 'Enter'].includes(e.key) && (e.ctrlKey || e.metaKey || e.altKey))
        return;
      else if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== "Delete" && e.key !== "Enter")
        return;
      Transforms.collapse(editor, { edge: "focus" });
      ReactEditor.focus(editor);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useImperativeHandle(ref, () => ({
    setText(text: string | null | undefined, select = false) {
      editor.children = slateFromMarkdown(text);
      editor.selection = null;
      editor.history = { undos: [], redos: [] };
      try {
        Editor.normalize(editor, { force: true });
      } catch { /* ignore */ }
      try {
        Transforms.select(editor, select ? Editor.start(editor, []) : Editor.end(editor, []));
      } catch {
        editor.selection = null;
      }
      editor.onChange();
    },
    focus(moveToEnd = false, preventScroll = false) {
      if (moveToEnd) {
        try {
          const endPoint = Editor.end(editor, []);
          Transforms.select(editor, endPoint);

          const [domNode, domOffset] = ReactEditor.toDOMPoint(editor, endPoint);
          const range = document.createRange();
          range.setStart(domNode, domOffset);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch { /* DOM not ready or editor empty */ }
      }
      editableRef.current?.focus({ preventScroll });
    }
  }));

  const getMarkdown = () => serializeSlateToMarkdown(editor.children);

  const clearEditor = () => {
    // @ts-expect-error
    editor.children = [{ type: "paragraph", children: [{ text: "" }] }];
    editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } };
    editor.history = { undos: [], redos: [] };
    editor.onChange();
  };

  const decorate = ([node, path]: any): any[] => {
    if (!Text.isText(node))
      return [];
    if (path.length !== 2)
      return [];

    let block: any;
    try {
      block = Node.get(editor, [path[0]]);
    } catch { return []; }

    if (block?.type === 'math-block' || block?.type === 'code-block')
      return [];

    const blockText = Node.string(block);
    const childIndex = path[1];

    let offset = 0;
    for (let i = 0; i < childIndex; i++) {
      try { offset += Node.string(block.children[i]).length; }
      catch { break; }
    }

    const nodeText = Node.string(node);
    const tokens = tokenizeInline(blockText);
    const results: any[] = [];

    for (const t of tokens) {
      const nodeStart = offset;
      const nodeEnd = offset + nodeText.length;
      const overlapStart = Math.max(t.start, nodeStart);
      const overlapEnd = Math.min(t.end,   nodeEnd);
      if (overlapStart < overlapEnd) {
        results.push({
          [t.style]: true,
          ...(t.attributes ?? {}),
          anchor: { path, offset: overlapStart - nodeStart },
          focus: { path, offset: overlapEnd - nodeStart }
        });
      }
    }
    return results;
  };

  const Leaf = ({ attributes, children, leaf }: any) => {
    let rendered = children;

    if (leaf.boldItalic) {
      rendered = <b><i>{rendered}</i></b>;
    } else {
      if (leaf.bold)
        rendered = <b>{rendered}</b>;
      if (leaf.italic)
        rendered = <i>{rendered}</i>;
    }
    if (leaf.underline)
      rendered = <u>{rendered}</u>;
    if (leaf.strikethrough)
      rendered = <s>{rendered}</s>;
    if (leaf.code)
      rendered = <code>{rendered}</code>;
    if (leaf.spoiler)
      rendered = <span className="spoiler-edit">{rendered}</span>;
    if (leaf.superscript)
      rendered = <sup>{rendered}</sup>;
    if (leaf.subscript)
      rendered = <sub>{rendered}</sub>;
    if (leaf.color)
      rendered = <span className="colored" style={{ '--color': leaf.hex } as any}>{rendered}</span>;
    if (leaf.link)
      rendered = <a>{rendered}</a>;
    if (leaf.timestamp)
      rendered = <span className="timestamp-edit" title={formatTimestamp(Number(leaf.timestamp), leaf.style)}>{rendered}</span>;
    if (leaf.mentionEveryone)
      rendered = <span className="mention int">{rendered}</span>;
    if (leaf.header)
      rendered = <span className={`h${leaf.size}`}>{rendered}</span>;
    if (leaf.subheader)
      rendered = <span className="subheader">{rendered}</span>;
    if (leaf.math)
      rendered = <span className="math-edit">{rendered}</span>;
    if (leaf.highlight)
      rendered = <span className="highlight">{rendered}</span>
    if (leaf.lowlight)
      rendered = <span className="lowlight">{rendered}</span>
    if (leaf.hexColor)
      rendered = <span className="hex-color" style={{ '--color': leaf.content } as any}>{rendered}</span>
    if (leaf.progressBar) {
      const pct = typeof leaf.value === 'number' ? leaf.value : 0;
      rendered = (
        <span
          className="progress-bar-edit"
          title={leaf.label ? `Progress: ${leaf.label}` : `Progress: ${Math.round(pct)}%`}
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(88, 101, 242, 0.28) ${pct}%, rgba(114, 118, 125, 0.15) ${pct}%)`,
            borderRadius: '4px',
            padding: '1px 5px',
            boxShadow: 'inset 0 0 0 1px rgba(88, 101, 242, 0.45)',
          }}
        >
          {rendered}
        </span>
      );
    }
    if (leaf.mds)
      rendered = <span className="mds">{rendered}</span>;

    return <span {...attributes}>{rendered}</span>;
  };

  const renderElement = (props: any) => {
    const { element, attributes, children } = props;
    switch (element.type) {
      case 'mentionUser': {
        const m = getMember(element.user?.id, currentServer?.id);
        return (
          <span
            {...attributes}
            contentEditable={false}
            className="mention int"
            style={{
              fontFamily: `${m?.nameFont}, ${element.user?.nameFont}, Inter, Avenir, Helvetica, Arial, sans-serif`,
              "--special-mention-color": undefined// getRoleColor(serverState, element.user, m, currentServer === null),
            } as any}
          >
            @{getDisplayName(element.user)}
          </span>
        );
      }

      case 'mentionRole':
        return (
          <span
            {...attributes}
            contentEditable={false}
            className="mention int"
            style={{ "--special-mention-color": element.role?.color ? `#${element.role.color.toString(16).padStart(6, "0")}` : undefined } as any}
          >
            @{element.role?.name}
          </span>
        );

      case 'mentionChannel':
        return (
          <span {...attributes} contentEditable={false} className="mention int">
            {getChannelIcon(element.channel, { className: "icon" })}{element.channel?.name}
          </span>
        );

      case 'mentionServer':
        return (
          <span {...attributes} contentEditable={false} className="mention int">
            <img src={getIcon(element.server)} className="server-icon2" />{element.server?.name}
          </span>
        );

      case "emoji":
        return (
          <span {...attributes} contentEditable={false}>
            {renderEmoji(userSettings, element.emoji)}
          </span>
        );
      
      case "customEmoji":
        return (
          <span {...attributes} contentEditable={false}>
            {element.emojiUrl
              ? <img
                  src={element.emojiUrl as string}
                  alt={(element.emojiName as string) ?? ""}
                  title={`:${element.emojiName}:`}
                  style={{
                    width: "1.375em", height: "1.375em",
                    verticalAlign: "-0.3em",
                    display: "inline-block",
                    objectFit: "contain",
                  }}
                />
              : <code>:{element.emojiName}:</code>
            }
          </span>
        );

      case "quote":
        return <div {...attributes} className="editor-block-quote">{children}</div>;

      case "nested-quote":
        return (
          <div {...attributes} className="editor-block-quote">
            <div className="editor-block-quote">{children}</div>
          </div>
        );

      case "list-item":
        return <div {...attributes} className="editor-list-item">{children}</div>;

      case "numbered-list-item":
        return (
          <div {...attributes} className="editor-numbered-item" data-number={String(element.number) + '.'}>
            {children}
          </div>
        );

      case "quote-list-item":
        return (
          <div {...attributes} className="editor-block-quote">
            <div className="editor-list-item">{children}</div>
          </div>
        );

      case "quote-numbered-list-item":
        return (
          <div {...attributes} className="editor-block-quote">
            <div {...attributes} className="editor-numbered-item" data-number={String(element.number) + '.'}>
              {children}
            </div>
          </div>
        );

      case "list-item-quote":
        return (
          <div {...attributes} className="editor-list-item editor-list-item-quote">
            <div className="editor-block-quote">
              {children}
            </div>
          </div>
        );

      case "numbered-list-item-quote":
        return (
          <div {...attributes} className="editor-numbered-item" data-number={String(element.number) + '.'}>
            <div className="editor-block-quote">
              {children}
            </div>
          </div>
        );

      case "code-block":
        return (
          <CodeBlockElement 
            attributes={attributes}
            element={element}
            editor={editor}
            shikiHighlighter={shikiHighlighter}
          >
            {children}
          </CodeBlockElement>
        );

      case "math-block": {
        const rawLatex = Node.string(element);
        let mathHtml = '';
        try {
          mathHtml = katex.renderToString(rawLatex, { throwOnError: false, displayMode: true });
        } catch { /* invalid LaTeX while typing */ }
        return (
          <div {...attributes} className="editor-math-block">
            {mathHtml && (
              <div
                contentEditable={false}
                className="math-block-preview"
                dangerouslySetInnerHTML={{ __html: mathHtml }}
              />
            )}
            <div spellCheck={false}>{children}</div>
          </div>
        );
      }

      default:
        return <div {...attributes}>{children}</div>;
    }
  };

  const mentionResults = () => {
    const s = search.toLowerCase();
    if (!s)
      return [];
    const q2 = s.slice(2); // for two-char prefixes @& and #&
    const q1 = s.slice(1); // for one-char prefixes @, #, :

    if (s.startsWith("@&")) {
      const roles: Role[] = (currentServer as any)?.roles ?? [];
      return roles
        .filter(r => r.name?.toLowerCase()?.startsWith(q2))
        .slice(0, 10)
        .map(r => ({ ...r, type: "role" }));
    }
    if (s.startsWith("#&"))
      return servers
        .filter(sv => sv.name.toLowerCase().startsWith(q2))
        .slice(0, 10)
        .map(sv => ({ ...sv, type: "server" }));
    if (s.startsWith("#"))
      return channels
        .filter(c => c.serverId === currentChannel?.serverId && c.name?.toLowerCase()?.startsWith(q1))
        .slice(0, 10)
        .map(c => ({ ...c, type: "channel" }));
    if (s.startsWith("@"))
      return users
        .filter(u => u?.displayName?.toLowerCase()?.startsWith(q1) || u.username.toLowerCase().startsWith(q1))
        .slice(0, 10)
        .map(u => ({ ...u, type: "user" }));
    if (s.startsWith(":")) {
      const raw = s.slice(1);

      const riMatches = REGIONAL_INDICATOR_LETTERS
        .filter(r => r.id.startsWith(raw));

      const serverEmojis = servers
        .flatMap(sv => sv.emojis ?? [])
        .filter(e => e.name.toLowerCase().startsWith(raw.toLowerCase()))
        .map(e => ({ ...e, type: "customEmoji" as const }));

      const flagDirect = [];
      const flagCodeMatch = raw.match(/^(?:flag_)?([a-z]{2})$/i);
      if (flagCodeMatch) {
        const code = flagCodeMatch[1].toLowerCase();
        const fe = (data as any).emojis[code];
        if (fe && isFlag(fe.skins?.[0]?.native ?? "")) {
          const alreadyIn = emojiResults.some(r => r.id === code);
          if (!alreadyIn)
            flagDirect.push({ ...fe, id: code, type: "emoji" });
        }
      }

      return [...serverEmojis, ...flagDirect, ...emojiResults, ...riMatches].slice(0, 20);
    }
    return [];
  };

  const initialValue = useMemo(() => slateFromMarkdown(initialText), []);

  const getCurrentBlockType = (): string | null => {
    const m = Editor.above(editor, { match: n => !Editor.isEditor(n) && Editor.isBlock(editor, n as any) });
    return m ? (m[0] as any).type ?? null : null;
  };

  return (
    <Slate
      editor={editor}
      initialValue={initialValue}
      onChange={() => {
        const { selection } = editor;
        if (selection && Range.isCollapsed(selection)) {
          try {
            let from = selection.anchor;
            const anchorBlockIndex = selection.anchor.path[0];

            while (true) {
              const prev = Editor.before(editor, from, { distance: 1 });
              if (!prev)
                break;
              if (prev.path[0] !== anchorBlockIndex)
                break;
              const r = Editor.range(editor, prev, from);
              if (/\s/.test(Editor.string(editor, r)))
                break;
              const [node] = Editor.nodes(editor, {
                at: prev,
                match: (n) => editor.isVoid(n as BaseElement)
              });
              if (node)
                break;
              from = prev;
            }
            const mentionRange = Editor.range(editor, from, selection.anchor);
            const mentionText = Editor.string(editor, mentionRange);
            const triggered = /^(@&|#&|[@#:])([\w_\-\.~]{1,})$/.test(mentionText);
            if (triggered) {
              setTarget(mentionRange);
              setSearch(mentionText);
              setIndex(0);
            } else {
              setTarget(null);
            }
          } catch { /* lalala yeah i eat transient errors bite me */ }
        } else {
          setTarget(null);
        }

        if (superHighlighter) {
          const theme = getShikiTheme(userSettings ?? null);
          editor.children.forEach((block: any, i: number) => {
            if (block?.type === 'code-block') {
              shikiHighlighter.update(
                i,
                Node.string(block),
                block.language ?? 'text',
                theme,
                superHighlighter!
              );
            } else {
              shikiHighlighter.clear(i);
            }
          });
        }

        if (setText) {
          const md = getMarkdown();
          setText(giveNull && md.length === 0 ? null : md);
        }
      }}
    >
      {target && editableRef.current === document.activeElement && mentionResults().length > 0 &&
        ReactDOM.createPortal(
          <div
            ref={el => {
              if (!el)
                return;
              requestAnimationFrame(() => {
                let rect: DOMRect;
                if (isChannel) {
                  const wrap = document.querySelector(".msg-wrap");
                  if (!wrap)
                    return;
                  rect = wrap.getBoundingClientRect();
                } else {
                  const domRange = ReactEditor.toDOMRange(editor, target!);
                  rect = domRange.getBoundingClientRect();
                }
                const popupH = el.offsetHeight;
                el.style.position = "absolute";
                el.style.top = `${rect.top + window.pageYOffset - popupH - 4}px`;
                el.style.left = `${rect.left + window.pageXOffset}px`;
                if (isChannel)
                  el.style.width = `${rect.width - 8}px`;
              });
            }}
            className="ven-colors mention-popup uno"
          >
            <span className="mention-title">
              {search.startsWith("@&") ? "ROLES"
               : search.startsWith("#&") ? "SERVERS"
               : search[0] === "@" ? "MEMBERS"
               : search[0] === "#" ? "CHANNELS"
               : "EMOJIS"}
            </span>
            {mentionResults().map((item, i) => {
              switch (item.type) {
                case "user": {
                  const u = item as User;
                  const m = getMember(u.id, currentServer?.id);
                  return (
                    <div key={u.id} className={`mention-item int ${i === index ? "active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); Transforms.select(editor, target!); insertUserMention(editor, u); setTarget(null); }}
                      onMouseEnter={() => setIndex(i)}>
                      <img className="avatar" src={getAvatar(u, m)} alt="avatar" />
                      <span style={{ fontFamily: `${m?.nameFont}, ${u.nameFont}, Inter, Avenir, Helvetica, Arial, sans-serif` }}>{getDisplayName(u, m)}</span>
                      <span className="username">@{u.username}</span>
                    </div>
                  );
                }
                case "channel": {
                  const c = item as Channel;
                  return (
                    <div key={c.id} className={`mention-item int ${i === index ? "active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); Transforms.select(editor, target!); insertChannelMention(editor, c); setTarget(null); }}
                      onMouseEnter={() => setIndex(i)}>
                      {getChannelIcon(c, { className: "icon" })}<span>{c.name}</span>
                    </div>
                  );
                }
                case "server": {
                  const sv = item as Server;
                  return (
                    <div key={sv.id} className={`mention-item int ${i === index ? "active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); Transforms.select(editor, target!); insertServerMention(editor, sv); setTarget(null); }}
                      onMouseEnter={() => setIndex(i)}>
                      <span>
                        <img src={getIcon(sv)} className="server-icon2" />
                        {sv.name}
                      </span>
                    </div>
                  );
                }
                case "role": {
                  const r = item as Role;
                  return (
                    <div key={r.id} className={`mention-item int ${i === index ? "active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); Transforms.select(editor, target!); insertRoleMention(editor, r); setTarget(null); }}
                      onMouseEnter={() => setIndex(i)}>
                      <span style={{ color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : undefined }}>
                        @{r.name}
                      </span>
                    </div>
                  );
                }
                case "emoji": {
                  const e = item as Emoji;
                  const native = e.skins?.[0]?.native ?? "";
                  const displayId = normalizeEmojiId(e.id, native);
                  return (
                    <div key={item.id} className={`mention-item int ${i === index ? "active" : ""}`}
                      onMouseDown={ev => { ev.preventDefault(); Transforms.select(editor, target!); insertEmoji(editor, e); setTarget(null); }}
                      onMouseEnter={() => setIndex(i)}>
                      <span>{renderEmoji(userSettings, native)} :{displayId}:</span>
                    </div>
                  );
                }
                case "customEmoji": {
                  const ce = item as CustomEmoji;
                  const url = getEmojiUrl(ce);
                  return (
                    <div key={ce.id} className={`mention-item int ${i === index ? "active" : ""}`}
                      onMouseDown={ev => {
                        ev.preventDefault();
                        Transforms.select(editor, target!);
                        insertCustomEmoji(editor, ce.name, ce.id!, url ?? "");
                        setTarget(null);
                      }}
                      onMouseEnter={() => setIndex(i)}>
                      <img
                        src={url}
                        alt={ce.name}
                        style={{ width: 20, height: 20, objectFit: "contain", borderRadius: 4, flexShrink: 0 }}
                      />
                      <span>:{ce.name}:</span>
                    </div>
                  );
                }
              }
            })}
          </div>,
          rootRef.current ?? document.body
        )}

      <Editable
        ref={editableRef}
        className="msg-input"
        placeholder=" "
        renderPlaceholder={({ attributes }) => (
          <span {...attributes}>
            {placeholder !== undefined
              ? placeholder
              : placeholderText !== undefined
                ? placeholderText
                : isChannel
                  ? currentChannel
                    ? <>Send a message in {getChannelIcon(currentChannel, { className: "inline-icon" })}{currentChannel.name}</>
                    : "Send a message into the void"
                  : "Type..."}
          </span>
        )}
        decorate={decorate}
        renderLeaf={Leaf}
        renderElement={renderElement}
        style={style}
        spellCheck
        // Suppress Slate's built-in scroll-cursor-into-view behaviour.
        // For the channel input this is a no-op (it's always visible at the
        // bottom). For inline message editing it prevents the message list
        // from jumping when focus() is called.
        scrollSelectionIntoView={() => {}}

        onCopy={e => {
          const { selection } = editor;
          if (!selection || Range.isCollapsed(selection))
            return;
          e.preventDefault();
          const fragment = Editor.fragment(editor, selection);
          const [start, end] = Range.edges(selection);
          
          const text = serializeFragmentToText(
            fragment,
            selectionAtBlockBoundary(editor, start, 'start'),
            selectionAtBlockBoundary(editor, end, 'end')
          );

          e.clipboardData.setData("text/plain", text);
          try {
            const encoded = window.btoa(encodeURIComponent(JSON.stringify(fragment)));
            e.clipboardData.setData("application/x-slate-fragment", encoded);
          } catch { /* btoa can fail on certain unicode */ }
        }}
        onCut={e => {
          const { selection } = editor;
          if (!selection || Range.isCollapsed(editor.selection!))
            return;
          e.preventDefault();
          const fragment = Editor.fragment(editor, selection);
          const [start, end] = Range.edges(selection);

          const text = serializeFragmentToText(
            fragment,
            selectionAtBlockBoundary(editor, start, 'start'),
            selectionAtBlockBoundary(editor, end, 'end')
          );

          e.clipboardData.setData("text/plain", text);
          try {
            const encoded = window.btoa(encodeURIComponent(JSON.stringify(fragment)));
            e.clipboardData.setData("application/x-slate-fragment", encoded);
          } catch {}
          Transforms.delete(editor);
        }}

        onKeyDown={e => {
          if (onKey && onKey(e))
            return;

          if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.metaKey) {
            const { selection } = editor;
            if (selection) {
              const isForward = e.key === 'ArrowRight';
              const isExpanding = e.shiftKey;
              const isWordJump = e.ctrlKey || e.altKey;

              const isVoidInline = (n: Node): boolean =>
                !Editor.isEditor(n) && editor.isInline(n as any) && editor.isVoid(n as any);

              const applyDest = (dest: ReturnType<typeof Editor.after>) => {
                if (!dest)
                  return;
                isExpanding
                  ? Transforms.select(editor, { anchor: selection.anchor, focus: dest })
                  : Transforms.select(editor, dest);
              };

              if (isWordJump) {
                e.preventDefault();
                const startPoint = isExpanding
                  ? selection.focus
                  : isForward
                    ? Range.end(selection)
                    : Range.start(selection);

                const blockIdx = startPoint.path[0];
                let cur = startPoint;

                try {
                  const trapped = Editor.above(editor, { at: cur, match: isVoidInline, voids: true });
                  if (trapped) {
                    const out = isForward
                      ? Editor.after(editor, trapped[1])
                      : Editor.before(editor, trapped[1]);
                    if (out && out.path[0] === blockIdx) cur = out;
                  }
                } catch {}

                const nextStep = (p: typeof startPoint) => {
                  try {
                    const adj = isForward
                      ? Editor.after(editor, p, { voids: true })
                      : Editor.before(editor, p, { voids: true });
                    if (!adj || adj.path[0] !== blockIdx)
                      return null;

                    const voidEntry = Editor.above(editor, { at: adj, match: isVoidInline, voids: true });
                    if (voidEntry) {
                      const pastVoid = isForward
                        ? Editor.after(editor, voidEntry[1])
                        : Editor.before(editor, voidEntry[1]);
                      if (!pastVoid || pastVoid.path[0] !== blockIdx)
                        return null;
                      return { dest: pastVoid, char: '\x01', isVoid: true };
                    }

                    const range = isForward
                      ? Editor.range(editor, p, adj)
                      : Editor.range(editor, adj, p);
                    return { dest: adj, char: Editor.string(editor, range), isVoid: false };
                  } catch { return null; }
                };

                let phase: 'skipSpaces' | 'skipWord' = isForward ? 'skipSpaces' : 'skipWord';
                let moved = false;

                for (let i = 0; i < 500; i++) {
                  const step = nextStep(cur);
                  if (!step)
                    break;
                  const isSpace = !step.isVoid && /\s/.test(step.char);

                  if (isForward) {
                    if (phase === 'skipSpaces') {
                      if (isSpace) {
                        cur = step.dest;
                      } else {
                        phase = 'skipWord';
                        cur = step.dest;
                        moved = true;
                        if (step.isVoid)
                          break;
                        }
                    } else {
                      if (isSpace)
                        break;
                      cur = step.dest; moved = true;
                      if (step.isVoid)
                        break;
                    }
                  } else {
                    if (phase === 'skipWord') {
                      if (isSpace) {
                        if (!moved) {
                          phase = 'skipSpaces';
                          cur = step.dest;
                        } else break;
                      } else if (step.isVoid) {
                        if (!moved) {
                          cur = step.dest;
                          moved = true;
                        }
                        break;
                      } else {
                        cur = step.dest;
                        moved = true;
                      }
                    } else {
                      if (isSpace) {
                        cur = step.dest;
                      } else if (step.isVoid) {
                        cur = step.dest;
                        break;
                      } else {
                        phase = 'skipWord';
                        cur = step.dest;
                        moved = true;
                      }
                    }
                  }
                }

                applyDest(cur);
                return;
              }

              const movingPoint = isExpanding
                ? selection.focus
                : isForward
                  ? Range.end(selection)
                  : Range.start(selection);

              try {
                const trapped = Editor.above(editor, { at: movingPoint, match: isVoidInline, voids: true });
                if (trapped) {
                  e.preventDefault();
                  applyDest(isForward ? Editor.after(editor, trapped[1]) : Editor.before(editor, trapped[1]));
                  return;
                }

                const peek = isForward
                  ? Editor.after(editor, movingPoint, { voids: true })
                  : Editor.before(editor, movingPoint, { voids: true });

                if (peek) {
                  const adjacent = Editor.above(editor, { at: peek, match: isVoidInline, voids: true });
                  if (adjacent) {
                    e.preventDefault();
                    applyDest(isForward ? Editor.after(editor, adjacent[1]) : Editor.before(editor, adjacent[1]));
                    return;
                  }
                }
              } catch {}
            }
          }

          const t = target;
          const results = mentionResults();

          if (t && results.length > 0) {
            switch (e.key) {
              case "ArrowDown":
                e.preventDefault();
                setIndex((index + 1) % results.length);
                return;
              case "ArrowUp":
                e.preventDefault();
                setIndex((index - 1 + results.length) % results.length);
                return;
              case "Tab":
              case "Enter":
                e.preventDefault();
                Transforms.select(editor, t);
                switch (results[index].type) {
                  case "channel":
                    insertChannelMention(editor, results[index] as Channel);
                    break;
                  case "user":
                    insertUserMention(editor, results[index] as User);
                    break;
                  case "server":
                    insertServerMention(editor, results[index] as Server);
                    break;
                  case "role":
                    insertRoleMention(editor, results[index] as Role);
                    break;
                  case "emoji":
                    setEmojiResults([]);
                    insertEmoji(editor, results[index] as Emoji);
                    break;
                  case "customEmoji": {
                    const ce = results[index] as CustomEmoji;
                    insertCustomEmoji(editor, ce.name, ce.id!, getEmojiUrl(ce) ?? "");
                    break;
                  }
                }
                setTarget(null);
                return;
              case "Escape":
                setTarget(null);
                return;
            }
          }

          if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            const blockType = getCurrentBlockType();
            if (['code-block', 'math-block'].includes(blockType ?? '')) {
              e.preventDefault();
              Transforms.select(editor, {
                anchor: Editor.start(editor, []),
                focus: Editor.end(editor, [])
              });
              return;
            }
          }

          // todo: make StartTyping only invoke when actually typing text
          // todo: make StopTyping invoke when text is cleared
          if (isChannel)
            connection?.invoke("StartTyping", currentChannel?.id ?? 0);

          if (e.key === "Enter") {
            const blockType = getCurrentBlockType();
            if (e.shiftKey) {
              if ([
                'quote', 'list-item', 'numbered-list-item', 'code-block', 'math-block',
                'nested-quote', 'quote-list-item', 'quote-numbered-list-item',
                'list-item-quote', 'numbered-list-item-quote'
              ].includes(blockType ?? '')) {
                e.preventDefault();
                editor.insertBreak();
                return;
              }

              if (blockType === 'paragraph') {
                const blockEntry = Editor.above(editor, { match: n => !Editor.isEditor(n) && Editor.isBlock(editor, n as any) });
                if (blockEntry && /^```(.*)$/.test(Node.string(blockEntry[0]))) {
                  e.preventDefault();
                  editor.insertBreak();
                  return;
                }
              }
            } else {
              if (!e.ctrlKey && blockType === 'code-block') {
                e.preventDefault();
                editor.insertBreak();
                return;
              }

              if (isChannel) {
                e.preventDefault();
                const md = getMarkdown();
                if (md === "")
                  return;
                clearEditor();
                if (!currentChannel || !user)
                  return;

                const references = getPendingReplies(currentChannel.id).map(msg => msg.id);
                clearPendingReplies(currentChannel.id);

                const msg = {
                  id: -1, channelId: currentChannel.id, authorId: user.id,
                  mentions: [], reactions: [], content: md, previousContent: null,
                  timestamp: new Date().toString(), editedTimestamp: null,
                  isDeleted: false, isPinned: false, sending: true,
                  nonce: Number(`${Date.now()}${Math.floor(Math.random() * 1000000)}`),
                  references
                };
                addMessage(msg);
                sendMessage(currentChannel.id, md, msg.nonce, references, { headers: { Authorization: `Bearer ${token}` } })
                  .then(sentMsg => addMessage(sentMsg));
              } else if (onEnter) {
                e.preventDefault();
                const md = getMarkdown();
                if (md === "")
                  return;
                onEnter(md);
              }
            }
          }

          // allow escaping block elements via arrow keys either at the start of the block or the end
          if (["ArrowDown", "ArrowUp"].includes(e.key) && ['code-block', 'math-block'].includes(getCurrentBlockType() ?? '')) {
            const sel = editor.selection;
            if (sel && Range.isCollapsed(sel)) {
              const path = Editor.path(editor, sel);
              const down = e.key === "ArrowDown";
              
              if (down && Editor.isEnd(editor, sel.anchor, path) || !down && Editor.isStart(editor, sel.anchor, path)) {
                const end = down ? Editor.end(editor, path) : Editor.start(editor, path);
                const next = down ? Editor.after(editor, end) : Editor.before(editor, end);
                if (!next) {
                  Editor.withoutNormalizing(editor, () => {
                    const nextPath = [path[0] + (down ? 1 : 0)] as [number];
                    Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] } as any, { at: nextPath });
                    Transforms.select(editor, Editor.start(editor, nextPath));
                  });
                  return;
                }
              }
            }
          }
        }}

        onPaste={e => {
          const text = e.clipboardData.getData("text/plain");
          console.log(text);
          if (!text)
            return;
          e.preventDefault();

          if (editor.selection && !Range.isCollapsed(editor.selection))
            Transforms.delete(editor);

          const blockType = getCurrentBlockType();

          if (blockType === "code-block") {
            Transforms.insertText(editor, text);
            return;
          }

          const fragment = slateFromMarkdown(text);
          const hasComplexBlocks = fragment.some(b => b.type !== "paragraph");

          if (hasComplexBlocks) {
            const blockEntry = Editor.above(editor, {
              match: n => !Editor.isEditor(n) && Editor.isBlock(editor, n as any)
            });
            if (blockEntry) {
              const [bNode, bPath] = blockEntry;
              if (Node.string(bNode) === "") {
                Editor.withoutNormalizing(editor, () => {
                  Transforms.removeNodes(editor, { at: bPath });
                  Transforms.insertNodes(editor, fragment, { at: bPath });
                });
                try {
                  const lastIdx = bPath[0] + fragment.length - 1;
                  Transforms.select(editor, Editor.end(editor, [lastIdx]));
                } catch {}
                return;
              }
            }
          }

          Transforms.insertFragment(editor, fragment);
        }}
      />
    </Slate>
  );
});

export default MessageInput;