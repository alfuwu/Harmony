import {
  useState, useMemo, useEffect, useRef,
  forwardRef, useImperativeHandle, CSSProperties,
} from "react";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { createEditor, Node, Editor, Transforms, Range, Text } from "slate";
import { withHistory } from "slate-history";
import ReactDOM from "react-dom";

import { ChannelState, useChannelState } from "../../lib/state/Channels";
import { MessageState, useMessageState } from "../../lib/state/Messages";
import { AuthState, useAuthState } from "../../lib/state/Auth";
import { UserState, useUserState } from "../../lib/state/Users";
import { ServerState, useServerState } from "../../lib/state/Servers";

import { renderEmoji } from "../../lib/utils/MarkdownRenderer";
import { AbstractChannel, Channel, Role, Server, User } from "../../lib/utils/types";
import { getAvatar, getDisplayName, getRoleColor } from "../../lib/utils/UserUtils";
import { getChannelIcon } from "../../lib/utils/ChannelUtils";
import { sendMessage } from "../../lib/api/messageApi";
import { rootRef } from "../../App";

import { tokenizeInline } from "../../lib/utils/MarkdownParser";
import { formatTimestamp } from "../../lib/utils/MarkdownRenderer";
import {
  withMarkdownBlocks,
  withAutoFormatMentions,
  serializeSlateToMarkdown,
  slateFromMarkdown,
} from "../../lib/utils/SlateMarkdownPlugin";

import data, { Emoji } from "@emoji-mart/data";
import { init, SearchIndex } from "emoji-mart";
import { connection } from "../../lib/api/signalrClient";

init({ data });

const withMentions = (editor: Editor) => {
  const { isInline, isVoid, markableVoid } = editor;
  const isSpecial = (el: any) => el.type?.startsWith("mention") || el.type === "emoji";
  editor.isInline = el => isSpecial(el) || isInline(el);
  editor.isVoid = el => isSpecial(el) || isVoid(el);
  editor.markableVoid = el => isSpecial(el) || markableVoid(el);
  return editor;
};

const ins = (editor: Editor, node: any) => { Transforms.insertNodes(editor, node); Transforms.move(editor); };

const insertUserMention = (editor: Editor, user: User) =>
  ins(editor, { type: "mention_user",    id: user.id,    user,    children: [{ text: `<@${user.id}>`    }] });
const insertChannelMention = (editor: Editor, ch: AbstractChannel) =>
  ins(editor, { type: "mention_channel", id: ch.id,      channel: ch,   children: [{ text: `<#${ch.id}>`    }] });
const insertServerMention  = (editor: Editor, srv: Server) =>
  ins(editor, { type: "mention_server",  id: srv.id,     server:  srv,  children: [{ text: `<~${srv.id}>`   }] });
// @ts-expect-error
const insertRoleMention = (editor: Editor, role: Role) =>
  ins(editor, { type: "mention_role",    id: role.id,    role,    children: [{ text: `<@&${role.id}>`  }] });
const insertEmoji = (editor: Editor, emoji: Emoji) => {
  // @ts-expect-error
  const native = emoji.native ?? emoji.skins?.[0]?.native ?? "";
  ins(editor, { type: "emoji", emoji: native, children: [{ text: native }] });
};

export type MessageInputHandle = {
  setText(text: string | null | undefined): void;
  focus(moveToEnd?: boolean): void;
};

const MessageInput = forwardRef(function MessageInput({
  isChannel = true,
  placeholderText,
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
  serverState,
}: {
  isChannel?: boolean;
  placeholderText?: string;
  initialText?:  | null | undefined;
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
  const { token, user, userSettings } = authState  ?? useAuthState();
  const { channels, currentChannel } = channelState ?? useChannelState();
  const { addMessage } = messageState ?? useMessageState();
  const { users, getMember } = userState   ?? useUserState();
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
        (username, discriminator) => usersRef.current.find((u: User) => u.username.toLowerCase() == username.toLowerCase() && u.discriminator == discriminator)
      )
    ),
    [],
  );

  const editableRef = useRef<HTMLDivElement | null>(null);
  const [target, setTarget] = useState<Range | null>(null);
  const [search, setSearch] = useState("");
  const [index,  setIndex]  = useState(0);
  const [emojiResults, setEmojiResults] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!search.startsWith(":") || search.length < 2) {
        setEmojiResults([]);
        return;
      }
      const results = await SearchIndex.search(search.slice(1));
      if (!cancelled)
        setEmojiResults((results ?? []).slice(0, 10).map((e: Emoji) => ({ ...e, type: "emoji" })));
    }
    run();
    return () => { cancelled = true; };
  }, [search]);

  useEffect(() => {
    if (!isChannel)
      return;
    const handler = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName.toLowerCase();
      // @ts-expect-error
      if (document.activeElement === editableRef.current || tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable)
        return;
      if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== "Delete" && e.key !== "Enter")
        return;
      editableRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useImperativeHandle(ref, () => ({
    setText(text: string | null | undefined) {
      editor.children  = slateFromMarkdown(text);
      editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } };
      editor.history   = { undos: [], redos: [] };
      editor.onChange();
    },
    focus(moveToEnd = false) {
      editableRef.current?.focus();
      if (moveToEnd)
        Transforms.select(editor, Editor.end(editor, []));
    },
  }));

  const getMarkdown = () => serializeSlateToMarkdown(editor.children as any[]);

  const clearEditor = () => {
    // @ts-expect-error
    editor.children  = [{ type: "paragraph", children: [{ text: "" }] }];
    editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } };
    editor.history   = { undos: [], redos: [] };
    editor.onChange();
  };

  // Each block's text is tokenized independently.
  // - Inline formatting (bold, italic, ,,,) is handled via tokens.
  // - Headers/subheaders typed as paragraph text are also detected at pos 0.
  const decorate = ([node, path]: any): any[] => {
    if (!Text.isText(node))
      return [];
    if (path.length !== 2)
      return []; // skip text inside void elements

    let block: any;
    try {
      block = Node.get(editor, [path[0]]);
    } catch { return []; }

    const blockText  = Node.string(block);
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
      rendered = <span className="timestamp">{formatTimestamp(Number(leaf.timestamp) * 1000, leaf.style)}</span>;
    if (leaf.mention_everyone)
      rendered = <span className="mention int">{rendered}</span>;
    // Block-level decorations for headers/subheaders typed as paragraph text
    if (leaf.header)
      rendered = <span className={`h${leaf.size}`}>{rendered}</span>;
    if (leaf.subheader)
      rendered = <span className="subheader">{rendered}</span>;
    // mds always last so it can override everything with gray colour
    if (leaf.mds)
      rendered = <span className="mds">{rendered}</span>;

    return <span {...attributes}>{rendered}</span>;
  };

  const renderElement = (props: any) => {
    const { element, attributes, children } = props;
    switch (element.type) {
      case "mention_user": {
        const m = getMember(element.user?.id, currentServer?.id);
        return (
          <span
            {...attributes}
            contentEditable={false}
            className="mention int"
            style={{
              fontFamily: `${m?.nameFont}, ${element.user?.nameFont}, Inter, Avenir, Helvetica, Arial, sans-serif`,
              "--special-mention-color": getRoleColor(serverState, element.user, m, currentServer === null),
            } as any}
          >
            @{getDisplayName(element.user)}
          </span>
        );
      }
      case "mention_role":
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
      case "mention_channel":
        return (
          <span {...attributes} contentEditable={false} className="mention int">
            {getChannelIcon(element.channel, { className: "icon" })}{element.channel?.name}
          </span>
        );
      case "mention_server":
        return (
          <span {...attributes} contentEditable={false} className="mention int">
            ~{element.server?.name}
          </span>
        );
      case "emoji":
        return (
          <span {...attributes} contentEditable={false}>
            {renderEmoji(userSettings, element.emoji)}
          </span>
        );

      case "quote":
        return <div {...attributes} className="editor-block-quote">{children}</div>;

      case "list-item":
        return (
          <div {...attributes} className="editor-list-item">
            <span contentEditable={false} className="editor-list-bullet" aria-hidden>•</span>
            <span>{children}</span>
          </div>
        );

      case "numbered-list-item":
        return (
          <div {...attributes} className="editor-numbered-item">
            <span contentEditable={false} className="editor-list-number" aria-hidden>{element.number}.</span>
            <span>{children}</span>
          </div>
        );

      case "code-block":
        return (
          <div {...attributes} className="editor-code-block" spellCheck={false}>
            {children}
          </div>
        );

      default:
        return <div {...attributes}>{children}</div>;
    }
  };

  const mentionResults = () => {
    const s = search.toLowerCase();
    if (!s)
      return [];
    const q = s.slice(1);
    if (search.startsWith("#"))
      return channels.filter((c: AbstractChannel) => c.serverId === currentChannel?.serverId && c.name?.toLowerCase()?.startsWith(q)).slice(0, 10).map((c: AbstractChannel) => ({ ...c, type: "channel" }));
    if (search.startsWith("~"))
      return servers.filter((sv: Server) => sv.name.toLowerCase().startsWith(q)).slice(0, 10).map((sv: Server) => ({ ...sv, type: "server" }));
    if (search.startsWith("@"))
      return users.filter((u: User) => u?.displayName?.toLowerCase()?.startsWith(q) || u.username.toLowerCase().startsWith(q)).slice(0, 10).map((u: User) => ({ ...u, type: "user" }));
    if (search.startsWith(":"))
      return emojiResults;
    return [];
  };

  const skipMention = (reverse: boolean) => {
    const sel = editor.selection;
    if (!sel || !Range.isCollapsed(sel))
      return;
    const [node] = Editor.fragment(editor, sel.anchor.path);
    // @ts-expect-error
    if (node.children?.[0]?.type?.startsWith("mention") || node.children?.[0]?.type === "emoji")
      Transforms.move(editor, { reverse });
  };

  const initialValue = useMemo(() => slateFromMarkdown(initialText), []);

  const getCurrentBlockType = (): string | null => {
    const m = Editor.above(editor, { match: n => !Editor.isEditor(n) && Editor.isBlock(editor, n as any) });
    return m ? (m[0] as any).type ?? null : null;
  };

  return (
    <Slate
      // @ts-expect-error
      editor={editor}
      initialValue={initialValue}
      onChange={() => {
        const { selection } = editor;
        if (selection && Range.isCollapsed(selection)) {
          try {
            let from = selection.anchor;
            while (true) {
              const prev = Editor.before(editor, from, { distance: 1 });
              if (!prev)
                break;
              const r  = Editor.range(editor, prev, from);
              if (/\s/.test(Editor.string(editor, r)))
                break;
              from = prev;
            }
            const mentionRange = Editor.range(editor, from, selection.anchor);
            const mentionText = Editor.string(editor, mentionRange);
            const m = mentionText.match(/^([@#~:])([\w-]*)$/);
            if (m) {
              setTarget(mentionRange);
              setSearch(mentionText);
              setIndex(0);
            } else setTarget(null);
          } catch { /* lalala yeah i eat transient errors bite me */ }
        } else {
          setTarget(null);
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
              if (!el) return;
              requestAnimationFrame(() => {
                let rect: DOMRect;
                if (isChannel) {
                  const wrap = document.querySelector(".msg-wrap");
                  if (!wrap) return;
                  rect = wrap.getBoundingClientRect();
                } else {
                  // @ts-expect-error
                  const domRange = ReactEditor.toDOMRange(editor, target);
                  rect = domRange.getBoundingClientRect();
                }
                const popupH = el.offsetHeight;
                el.style.position = "absolute";
                el.style.top  = `${rect.top + window.pageYOffset - popupH - 4}px`;
                el.style.left = `${rect.left + window.pageXOffset}px`;
                if (isChannel) el.style.width = `${rect.width - 8}px`;
              });
            }}
            className="ven-colors mention-popup uno"
          >
            <span className="mention-title">
              {search[0] === "@" ? "MEMBERS" : search[0] === "#" ? "CHANNELS" : search[0] === "~" ? "SERVERS" : "EMOJIS"}
            </span>
            {mentionResults().map((item, i) => {
              switch (item.type) {
                case "user": {
                  const u = item as User;
                  const m = getMember(u.id, currentServer?.id);
                  return (
                    <div key={u.id} className={`mention-item int ${i === index ? "active" : ""}`}
                      onClick={() => { Transforms.select(editor, target); insertUserMention(editor, u); setTarget(null); }}
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
                      onClick={() => { Transforms.select(editor, target); insertChannelMention(editor, c); setTarget(null); }}
                      onMouseEnter={() => setIndex(i)}>
                      {getChannelIcon(c, { className: "icon" })}<span>{c.name}</span>
                    </div>
                  );
                }
                case "server": {
                  const sv = item as Server;
                  return (
                    <div key={sv.id} className={`mention-item int ${i === index ? "active" : ""}`}
                      onClick={() => { Transforms.select(editor, target); insertServerMention(editor, sv); setTarget(null); }}
                      onMouseEnter={() => setIndex(i)}>
                      <span>~{sv.name}</span>
                    </div>
                  );
                }
                case "emoji": {
                  const e = item as unknown as Emoji;
                  return (
                    <div key={item.id} className={`mention-item int ${i === index ? "active" : ""}`}
                      onClick={() => { Transforms.select(editor, target); insertEmoji(editor, e); setTarget(null); }}
                      onMouseEnter={() => setIndex(i)}>
                      <span>{renderEmoji(userSettings, e.skins[0].native)} :{item.id}:</span>
                    </div>
                  );
                }
              }
            })}
          </div>,
          rootRef.current ?? document.body,
        )}

      <Editable
        ref={editableRef}
        className="msg-input"
        placeholder={
          placeholderText
            ? placeholderText
            : isChannel
              ? currentChannel ? `Send a message in #${currentChannel.name}` : "Send a message into the void"
              : "Type..."
        }
        decorate={decorate}
        renderLeaf={Leaf}
        renderElement={renderElement}
        style={style}
        onKeyDown={e => {
          if (onKey && onKey(e))
            return;
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
                  case "emoji":
                    setEmojiResults([]);
                    insertEmoji(editor, results[index] as unknown as Emoji);
                    break;
                }
                setTarget(null);
                return;
              case "Escape":
                setTarget(null);
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
              if (['quote', 'list-item', 'numbered-list-item', 'code-block'].includes(blockType ?? '')) {
                e.preventDefault();
                editor.insertBreak();
                return;
              }
            } else {
              if (['code-block'].includes(blockType ?? '')) {
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
                const msg = {
                  id: -1, channelId: currentChannel.id, authorId: user.id,
                  mentions: [], reactions: [], content: md, previousContent: null,
                  timestamp: new Date().toString(), editedTimestamp: null,
                  isDeleted: false, isPinned: false, sending: true,
                  nonce: Number(`${Date.now()}${Math.floor(Math.random() * 1000000)}`),
                };
                addMessage(msg);
                sendMessage(currentChannel.id, md, msg.nonce, { headers: { Authorization: `Bearer ${token}` } })
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

          if (e.key === "ArrowDown" && getCurrentBlockType() === 'code-block') {
            // todo: check if at last line of code block, and if so, escape code block to regular text again
          }

          queueMicrotask(() => skipMention(e.key === "ArrowLeft"));
        }}
        onKeyUp={e => skipMention(e.key === "ArrowLeft")}
      />
    </Slate>
  );
});

export default MessageInput;