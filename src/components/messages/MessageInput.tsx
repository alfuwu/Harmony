import { useState, useMemo, useEffect, useRef } from "react";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { createEditor, Node, Editor, Transforms, Range, Text } from "slate";
import { withHistory } from "slate-history";
import ReactDOM from "react-dom";
import { useChannelState } from "../../lib/state/Channels";
import { useMessageState } from "../../lib/state/Messages";
import { useAuthState } from "../../lib/state/Auth";
import { useUserState } from "../../lib/state/Users";
import { LEAF_RULES, tokenizeMarkdown } from "../../lib/utils/Markdown";
// @ts-ignore
import { AbstractChannel, Role, Server, User } from "../../lib/utils/types";

const withMentions = (editor: Editor) => {
  const { isInline, isVoid } = editor;

  editor.isInline = (element) =>
    // @ts-expect-error
    element.type?.startsWith("mention") ? true : isInline(element);

  editor.isVoid = (element) =>
    // @ts-expect-error
    element.type?.startsWith("mention") ? true : isVoid(element);

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

export default function MessageInput() {
  const editor = useMemo(
    () => withHistory(withMentions(withReact(createEditor()))),
    []
  );

  const { currentChannel } = useChannelState();
  const { user } = useAuthState();
  const { messages, setMessages } = useMessageState();
  const { users } = useUserState();

  const editableRef = useRef<HTMLDivElement | null>(null);

  const [target, setTarget] = useState<Range | null>(null);
  const [search, setSearch] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === editableRef.current) return;
      if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== "Delete" && e.key !== "Enter") return;
      editableRef.current?.focus();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const initialValue = [{ type: "paragraph", children: [{ text: "" }] }];

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

      const tokens = tokenizeMarkdown(getFullText()[2]);

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
    if (!s) return [];
    return users.filter((u) =>
      (u.displayName ?? u.username).toLowerCase().startsWith(s)
    ).slice(0, 10);
  };

  const skipMention = (reverse: boolean) => {
    const selection = editor.selection;
    if (!selection || !Range.isCollapsed(selection))
      return;
    const [node] = Editor.fragment(editor, selection.anchor.path);
    // @ts-expect-error
    if (node.children[0]?.type?.startsWith("mention"))
      Transforms.move(editor, { reverse });
  };

  const renderElement = (props: any) => {
    const { element } = props;
    switch (element.type) {
      case "mention_user":
        return <span {...props.attributes} contentEditable={false} className="mention int">@{element.user?.displayName ?? element.user?.username}</span>;
      case "mention_role":
        return <span {...props.attributes} contentEditable={false} className="mention int">@{element.role?.name}</span>;
      case "mention_channel":
        return <span {...props.attributes} contentEditable={false} className="mention int">#{element.channel?.name}</span>;
      case "mention_server":
        return <span {...props.attributes} contentEditable={false} className="mention int">~{element.server?.name}</span>;
      default:
        return <div {...props.attributes}>{props.children}</div>;
    }
  };

  return (
    <div className="real-wrap">
      <div className="msg-wrap">
        <Slate
          // @ts-expect-error
          editor={editor}
          initialValue={initialValue}
          onChange={() => {
            const { selection } = editor;

            if (selection && Range.isCollapsed(selection)) {
              try {
                const [start] = Range.edges(selection);
                const wordBefore = Editor.before(editor, start, { unit: "word" });
                const before = wordBefore && Editor.before(editor, wordBefore);
                const beforeRange = before && Editor.range(editor, before, start);
                const beforeText = beforeRange && Editor.string(editor, beforeRange);
                const beforeMatch = beforeText && beforeText.match(/^@([\w\d_-]+)$/);

                const after = Editor.after(editor, start);
                const afterRange = Editor.range(editor, start, after);
                const afterText = Editor.string(editor, afterRange);
                const afterMatch = afterText.match(/^(\s|$)/);

                if (beforeMatch && afterMatch) {
                  setTarget(beforeRange!);
                  setSearch(beforeMatch[1]);
                  setIndex(0);
                } else {
                  setTarget(null);
                }
              } catch {}
            } else {
              setTarget(null);
            }
          }}
        >
          {target && mentionResults().length > 0 &&
            ReactDOM.createPortal(
              <div
                ref={(el) => {
                  if (!el)
                    return;
                  // @ts-expect-error
                  const domRange = ReactEditor.toDOMRange(editor, target);
                  const rect = domRange.getBoundingClientRect();
                  el.style.position = "absolute";
                  el.style.top = `${rect.top + window.pageYOffset + 24}px`;
                  el.style.left = `${rect.left + window.pageXOffset}px`;
                }}
                className="mention-popup"
              >
                {mentionResults().map((user, i) => (
                  <div
                    key={user.id}
                    className={`mention-item ${i === index ? "active" : ""}`}
                    onClick={() => {
                      Transforms.select(editor, target);
                      insertUserMention(editor, user);
                      setTarget(null);
                    }}
                  >
                    @{user.displayName ?? user.username}
                  </div>
                ))}
              </div>,
              document.body
            )}
          <Editable
            ref={editableRef}
            className="msg-input"
            placeholder={currentChannel ? `Send a message in #${currentChannel.name}` : "Send a message into the void"}
            decorate={decorate}
            renderLeaf={Leaf}
            renderElement={renderElement}
            onKeyDown={(e) => {
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
                    insertUserMention(editor, results[index]);
                    setTarget(null);
                    return;
                  case "Escape":
                    setTarget(null);
                    return;
                }
              }

              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const text = editor.children.map((n) => Node.string(n)).join("\n");
                // @ts-expect-error
                editor.children = [{ type: "paragraph", children: [{ text: "" }] }];
                editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } };
                editor.history = { undos: [], redos: [] };

                if (!currentChannel || !user) return;
                setMessages([
                  ...messages,
                  {
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
                  },
                ]);
              }

              queueMicrotask(() => skipMention(e.key === "ArrowLeft"));
            }}
            onKeyUp={(e) => skipMention(e.key === "ArrowLeft")}
          />
        </Slate>
      </div>
    </div>
  );
}
