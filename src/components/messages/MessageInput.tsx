import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { createEditor, Node, Editor, Transforms, Range, Text } from "slate";
import { withHistory } from "slate-history";
import ReactDOM from "react-dom";
import { useChannelState } from "../../lib/state/Channels";
import { useMessageState } from "../../lib/state/Messages";
import { useAuthState } from "../../lib/state/Auth";
import { useUserState } from "../../lib/state/Users";
import { LEAF_RULES, renderEmoji, tokenizeMarkdown } from "../../lib/utils/Markdown";
import { AbstractChannel, Channel, Role, Server, User } from "../../lib/utils/types";
import { getAvatar, getDisplayName, getRoleColor } from "../../lib/utils/UserUtils";
import { useServerState } from "../../lib/state/Servers";
import { getChannelIcon } from "../../lib/utils/ChannelUtils";
import { sendMessage } from "../../lib/api/messageApi";
import { rootRef } from "../../App";
import { useMemberState } from "../../lib/state/Members";
import data, { Emoji } from "@emoji-mart/data";
import { init, SearchIndex } from "emoji-mart";

init({ data });
// TODO: inserting an editable void right after another replaces the previous editable void
// TODO: make it so that the editor properly parses things like <@0> into editable void mentions
const withMentions = (editor: Editor) => {
  const { isInline, isVoid, markableVoid } = editor;

  editor.isInline = element =>
    // @ts-expect-error
    element.type?.startsWith("mention") || isInline(element);

  editor.isVoid = element =>
    // @ts-expect-error
    element.type?.startsWith("mention") || isVoid(element);
    
  editor.markableVoid = element =>
    // @ts-expect-error
    element.type?.startsWith("mention") || markableVoid(element);

  return editor;
};
const withEmoji = (editor: Editor) => {
  const { isInline, isVoid } = editor;

  editor.isInline = element =>
    // @ts-expect-error
    element.type === "emoji" || isInline(element);

  editor.isVoid = element =>
    // @ts-expect-error
    element.type === "emoji" || isVoid(element);

  return editor;
};

const insertUserMention = (editor: Editor, user: User) => {
  const mention = {
    type: "mention_user",
    id: user.id,
    user,
    children: [{ text: `<@${user.id}>` }],
  };
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor);
};
// @ts-expect-error
const insertRoleMention = (editor: Editor, role: Role) => {
  const mention = {
    type: "mention_role",
    id: role.id,
    role,
    children: [{ text: `<@&${role.id}>` }],
  };
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor);
};
const insertChannelMention = (editor: Editor, channel: AbstractChannel) => {
  const mention = {
    type: "mention_channel",
    id: channel.id,
    channel,
    children: [{ text: `<#${channel.id}>` }],
  };
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor);
};
const insertServerMention = (editor: Editor, server: Server) => {
  const mention = {
    type: "mention_server",
    id: server.id,
    server,
    children: [{ text: `<~${server.id}>` }],
  };
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor);
};
const insertEmoji = (editor: Editor, emoji: Emoji) => {
  // @ts-expect-error
  const e = emoji.native ?? emoji.skins?.[0]?.native ?? "";
  const node = {
    type: "emoji",
    emoji: e,
    children: [{ text: e }]
  };

  Transforms.insertNodes(editor, node);
  Transforms.move(editor);
}

const MessageInput = forwardRef(function MessageInput({
  isChannel = true,
  placeholderText = undefined,
  initialText = undefined,
  setText = undefined,
  giveNull = false,
}: {
  isChannel?: boolean,
  placeholderText?: string,
  initialText?: string | null | undefined,
  setText?: React.Dispatch<React.SetStateAction<string | null | undefined>>,
  giveNull?: boolean
}, ref) {
  const editor = useMemo(
    () => withHistory(withMentions(withEmoji(withReact(createEditor())))),
    []
  );

  const { token, userSettings } = useAuthState();
  const { channels, currentChannel } = useChannelState();
  const { user } = useAuthState();
  const { addMessage } = useMessageState();
  const { users } = useUserState();
  const serverState = useServerState();
  const { servers, currentServer } = serverState;
  const { get } = useMemberState();

  const editableRef = useRef<HTMLDivElement | null>(null);

  const [target, setTarget] = useState<Range | null>(null);
  const [search, setSearch] = useState("");
  const [index, setIndex] = useState(0);

  useImperativeHandle(ref, () => ({
    setText(text: string | null | undefined) {
      // @ts-expect-error
      editor.children = [{ type: "paragraph", children: [{ text: text ?? "" }] }];
      editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } };
      editor.history = { undos: [], redos: [] };
      editor.onChange();
    }
  }));

  /* could also work by just turning the mentionResults in general into a state but whatever */
  const [emojiResults, setEmojiResults] = useState([]);
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (search.startsWith(":")) {
        const q = search.slice(1);
        if (!q) {
          setEmojiResults([]);
          return;
        }

        const results = await SearchIndex.search(q);
        if (!cancelled)
          setEmojiResults(results.slice(0, 10).map((e: Emoji) => ({ ...e, type: "emoji" })));
      } else {
        setEmojiResults([]);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [search]);

  if (isChannel) {
    useEffect(() => {
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
  }

  const initialValue = [{ type: "paragraph", children: [{ text: initialText ?? "" }] }];

  const getFullText = (): [any[], string[], string] => {
    const blocks = editor.children as any[];
    const blockStrings = blocks.map((b) => Node.string(b));
    return [blocks, blockStrings, blockStrings.join("\n")];
  };

  const decorate = ([node, path]: any) => {
    if (!Text.isText(node) || path === undefined)
      return [];

    const [blocks, blockStrings] = getFullText();

    try {
      const blockIndex = path[0];
      const textNodeIndex = path[1];

      let priorBlocksLen = 0;
      for (let i = 0; i < blockIndex; i++)
        priorBlocksLen += blockStrings[i].length + 1;

      const block = blocks[blockIndex];
      let priorTextsLen = 0;
      for (let i = 0; i < textNodeIndex; i++)
        priorTextsLen += Node.string(block.children[i]).length;

      const nodeStartAbsolute = priorBlocksLen + priorTextsLen;
      const nodeText = Node.string(node);
      const nodeEndAbsolute = nodeStartAbsolute + nodeText.length;

      const tokens = tokenizeMarkdown(blockStrings.join("\n"));

      const results: any[] = [];
      for (const t of tokens) {
        const overlapStart = Math.max(t.anchor, nodeStartAbsolute);
        const overlapEnd = Math.min(t.focus, nodeEndAbsolute);
        if (overlapStart < overlapEnd) {
          results.push({
            ...t.attributes,
            [t.type]: true,
            anchor: { path, offset: overlapStart - nodeStartAbsolute },
            focus: { path, offset: overlapEnd - nodeStartAbsolute },
          });
        }
      }

      return results;
    } catch {
      return [];
    }
  };

  const Leaf = (props: any) => {
    const leaf = props.leaf;
    const activeRules = LEAF_RULES.filter((rule) => leaf[rule.name]);
    let rendered = props.children;

    for (const rule of activeRules) {
      if (rule.leafRender) {
        rendered = rule.leafRender({
          attributes: props.attributes,
          children: rendered,
          leaf,
        });
      }
    }

    if (activeRules.length === 0)
      return <span {...props.attributes}>{rendered}</span>;

    return rendered;
  };

  const mentionResults = () => {
    const s = search.toLowerCase();
    if (!s)
      return [];
    const q = s.slice(1);

    if (search.startsWith("#")) {
      const chans = channels.filter(c => c.serverId === currentChannel?.serverId);
      // channel mentions
      return chans
        .filter(c => c.name?.toLowerCase()?.startsWith(q))
        .slice(0, 10)
        .map(c => ({ ...c, type: "channel" }));
    } else if (search.startsWith("~")) {
      // server mentions
      return servers
        .filter(srv => srv.name.toLowerCase().startsWith(q))
        .slice(0, 10)
        .map(srv => ({ ...srv, type: "server" }));
    } else if (search.startsWith("@")) {
      // user & role mentions
      return users
        .filter(u => u?.displayName?.toLowerCase()?.startsWith(q) || u.username.toLowerCase().startsWith(q))
        .slice(0, 10)
        .map(u => ({ ...u, type: "user" }));
    } else if (search.startsWith(":")) {
      return emojiResults;
    } else {
      return [];
    }
  };

  const skipMention = (reverse: boolean) => {
    const selection = editor.selection;
    if (!selection || !Range.isCollapsed(selection))
      return;
    const [node] = Editor.fragment(editor, selection.anchor.path);
    // @ts-expect-error
    if (node.children[0]?.type?.startsWith("mention") || node.children[0]?.type === "emoji")
      Transforms.move(editor, { reverse });
  };

  const renderElement = (props: any) => {
    const { element } = props;
    switch (element.type) {
      case "mention_user":
        const m = get(element.user?.id, currentServer?.id);
        return (
          <span
            {...props.attributes}
            contentEditable={false}
            className="mention int"
            style={{
              fontFamily: `${m?.nameFont}, ${element.user?.nameFont}, Inter, Avenir, Helvetica, Arial, sans-serif`,
              "--special-mention-color": getRoleColor(serverState, element.user, m, currentServer === null)
            }}
          >
            @{getDisplayName(element.user)}
          </span>
        );
      case "mention_role":
        return (
          <span
            {...props.attributes}
            contentEditable={false}
            className="mention int"
            style={{
              "--special-mention-color": element.role && element.role.color ? `#${element.role.color.toString(16).padStart(6, "0")}` : undefined
            }}
          >
            @{element.role?.name}
          </span>
        );
      case "mention_channel":
        return <span {...props.attributes} contentEditable={false} className="mention int">{getChannelIcon(element.channel, { className: "icon" })}{element.channel?.name}</span>;
      case "mention_server":
        return <span {...props.attributes} contentEditable={false} className="mention int">~{element.server?.name}</span>;
      case "emoji":
        return <span {...props.attributes} contentEditable={false}>{renderEmoji(userSettings, element.emoji)}</span>;
      default:
        return <div {...props.attributes}>{props.children}</div>;
    }
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
            const start = selection.anchor;

            let from = start;
            while (true) {
              const prev = Editor.before(editor, from, { distance: 1 });
              if (!prev)
                break;
              const r = Editor.range(editor, prev, from);
              const ch = Editor.string(editor, r);
              if (/[\s]/.test(ch))
                break; // stop at whitespace (maybe refactor so that servers/users with whitespace can be more fully typed out?)
              from = prev;
            }

            const mentionRange = Editor.range(editor, from, start);
            const mentionText = Editor.string(editor, mentionRange);

            const m = mentionText.match(/^([@#~:])([\w-]*)$/);
            if (m) {
              setTarget(mentionRange);
              setSearch(mentionText);
              setIndex(0);
            } else {
              setTarget(null);
            }
          } catch {
            // lalala yeah i eat transient errors bite me
          }
        } else {
          setTarget(null);
        }

        if (setText) {
          const text = editor.children.map((n) => Node.string(n)).join("\n");
          setText(giveNull && text.length == 0 ? null : text);
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
                  const inputWrapper = document.querySelector(".msg-wrap");
                  if (!inputWrapper)
                    return;

                  rect = inputWrapper.getBoundingClientRect();
                } else {
                  // @ts-expect-error
                  const domRange = ReactEditor.toDOMRange(editor, target);
                  rect = domRange.getBoundingClientRect();
                }
                const popupHeight = el.offsetHeight;

                el.style.position = "absolute";
                el.style.top = `${rect.top + window.pageYOffset - popupHeight - 4}px`; // above input
                el.style.left = `${rect.left + window.pageXOffset}px`;
                if (isChannel)
                  el.style.width = `${rect.width - 8}px`;
              });
            }}
            className="ven-colors mention-popup uno"
          >
            <span className="mention-title">{
              search[0] === "@" ? "MEMBERS" :
              search[0] === "#" ? "CHANNELS" :
              search[0] === "~" ? "SERVERS" :
              search[0] === ":" ? "EMOJIS" :
              "UNKNOWN"
            }</span>
            {mentionResults().map((item, i) => {
              switch (item.type) {
                case "user":
                  const u = item as User;
                  const m = get(u.id, currentServer?.id);
                  return (
                    <div
                      key={u.id}
                      className={`mention-item int ${i === index ? "active" : ""}`}
                      onClick={() => {
                        Transforms.select(editor, target);
                        insertUserMention(editor, u);
                        setTarget(null);
                      }}
                      onMouseEnter={() => setIndex(i)}
                    >
                      <img className="avatar" src={getAvatar(u, m)} alt="avatar" />
                      <span style={{ fontFamily: `${m?.nameFont}, ${u.nameFont}, Inter, Avenir, Helvetica, Arial, sans-serif` }}>{getDisplayName(u, m)}</span>
                      <span className="username">@{u.username}</span>
                    </div>
                  );
                case "channel":
                  const c = item as Channel;
                  return (
                    <div
                      key={c.id}
                      className={`mention-item int ${i === index ? "active" : ""}`}
                      onClick={() => {
                        Transforms.select(editor, target);
                        insertChannelMention(editor, c);
                        setTarget(null);
                      }}
                      onMouseEnter={() => setIndex(i)}
                    >
                      {getChannelIcon(c, { className: "icon" })}
                      <span>{c.name}</span>
                    </div>
                  );
                case "server":
                  const s = item as Server;
                  return (
                    <div
                      key={s.id}
                      className={`mention-item int ${i === index ? "active" : ""}`}
                      onClick={() => {
                        Transforms.select(editor, target);
                        insertServerMention(editor, s);
                        setTarget(null);
                      }}
                      onMouseEnter={() => setIndex(i)}
                    >
                      <span>~{s.name}</span>
                    </div>
                  );
                case "emoji":
                  const e = item as unknown as Emoji;
                  return (
                    <div
                      key={item.id}
                      className={`mention-item int ${i === index ? "active" : ""}`}
                      onClick={() => {
                        Transforms.select(editor, target);
                        insertEmoji(editor, e);
                        setTarget(null);
                      }}
                      onMouseEnter={() => setIndex(i)}
                    >
                      <span>{renderEmoji(userSettings, e.skins[0].native)} :{item.id}:</span>
                    </div>
                  );
              }
            })}
          </div>,
          rootRef.current ?? document.body
        )}
      <Editable
        ref={editableRef}
        className="msg-input"
        placeholder={placeholderText ? placeholderText : isChannel ? currentChannel ? `Send a message in #${currentChannel.name}` : "Send a message into the void" : "Type..."}
        decorate={decorate}
        renderLeaf={Leaf}
        renderElement={renderElement}
        onKeyDown={e => {
          const t = target;
          const results = mentionResults();

          if (t && (results.length > 0 || emojiResults.length > 0)) {
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
                  case "role":
                    //insertRoleMention(editor, results[index] as Role);
                    break;
                  case "server":
                    insertServerMention(editor, results[index] as Server);
                    break;
                  case "emoji":
                    const e = results[index] as unknown as Emoji;
                    setEmojiResults([]);
                    insertEmoji(editor, e);
                    break;
                }
                setTarget(null);
                return;
              case "Escape":
                setTarget(null);
                return;
            }
          }

          if (e.key === "Enter" && isChannel) {
            e.preventDefault();
            const text = editor.children.map((n) => Node.string(n)).join("\n");
            if (text === "")
              return;
            // @ts-expect-error
            editor.children = [{ type: "paragraph", children: [{ text: "" }] }];
            editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } };
            editor.history = { undos: [], redos: [] };
            // update the editor manually
            editor.onChange();

            if (!currentChannel || !user)
              return;

            const msg = {
              id: -1,
              channelId: currentChannel.id,
              authorId: user.id,
              mentions: [],
              reactions: [],
              content: text,
              previousContent: null,
              timestamp: new Date().toString(),
              editedTimestamp: null,
              isDeleted: false,
              isPinned: false,
              sending: true,
              nonce: Number(`${Date.now()}${Math.floor(Math.random() * 1000000)}`)
            };

            addMessage(msg);
            sendMessage(currentChannel.id, text, msg.nonce, { headers: { Authorization: `Bearer ${token}` } }).then(sentMsg => addMessage(sentMsg));
          }

          queueMicrotask(() => skipMention(e.key === "ArrowLeft"));
        }}
        onKeyUp={(e) => skipMention(e.key === "ArrowLeft")}
      />
    </Slate>
  );
});

export default MessageInput;