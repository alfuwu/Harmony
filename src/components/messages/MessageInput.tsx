import { Editable, RenderLeafProps, Slate, SolidEditor, withSolid } from '@slate-solid/core'
import { Text, Node, Transforms, createEditor, Editor, Range } from 'slate'
import { withHistory } from 'slate-history'
import { createMemo, createSignal, For, onCleanup, onMount } from 'solid-js'
import { channelState } from '../../lib/state/channels';
import { messageState } from '../../lib/state/messages';
import { authState } from '../../lib/state/auth';
import { DecorationRange, LEAF_RULES, tokenizeMarkdown } from '../../lib/utils/Markdown';
import { AbstractChannel, Role, Server, User } from '../../lib/utils/types';
import { userState } from '../../lib/state/users';
import { Portal } from 'solid-js/web';

// TODO: add support for role mentions, channel mentions, and server mentions

const withMentions = (editor: Editor) => {
  const { isInline, isVoid, markableVoid } = editor

  editor.isInline = element =>
    // @ts-expect-error
    element.type?.startsWith("mention") ? true : isInline(element);

  editor.isVoid = element =>
    // @ts-expect-error
    element.type?.startsWith("mention") ? true : isVoid(element);

  editor.markableVoid = element =>
    // @ts-expect-error
    element.type?.startsWith("mention") || markableVoid(element);

  return editor
}

const insertUserMention = (editor: Editor, user: User) => {
  const mention = {
    type: "mention_user",
    user,
    children: [{ text: `<@${user.id}>` }]
  };
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor);
};
const insertRoleMention = (editor: Editor, role: Role) => {
  const mention = {
    type: "mention_role",
    role,
    children: [{ text: `<@&${role.id}>` }]
  };
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor);
};
const insertChannelMention = (editor: Editor, channel: AbstractChannel) => {
  const mention = {
    type: "mention_channel",
    channel,
    children: [{ text: `<#${channel.id}>` }]
  };
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor);
};
const insertServerMention = (editor: Editor, server: Server) => {
  const mention = {
    type: "mention_server",
    server,
    children: [{ text: `<~${server.id}>` }]
  };
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor);
};

let editableRef: HTMLDivElement | ((el: HTMLDivElement) => void) | undefined;

onMount(() => {
  const handler = (e: KeyboardEvent) => {
    // ignore if the editor already has focus
    if (document.activeElement === editableRef)
      return;

    // ignore keys that shouldn't activate typing (shift, ctrl, ...)
    if (e.key.length !== 1 && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Enter')
      return;
    
    // @ts-expect-error
    editableRef?.focus();
  };

  window.addEventListener("keydown", handler);
  onCleanup(() => window.removeEventListener("keydown", handler));
});

export default function MessageInput() {
  const editor = createMemo(() => withHistory(withSolid(withMentions(createEditor()))), []);

  const [target, setTarget] = createSignal(null);
  const [search, setSearch] = createSignal('');
  const [index, setIndex] = createSignal(0);

  const mentionResults = () => {
    const s = search().toLowerCase();
    if (!s) return [];
    return userState.users()
      .filter(u =>
        (u.displayName ?? u.username).toLowerCase().startsWith(s)
      )
      .slice(0, 10);
  };

  const skipMention = (reverse: boolean) => {
    const { selection } = editor();
    if (!selection || !Range.isCollapsed(selection))
      return;

    const { anchor } = selection;
    const [node] = editor().fragment(anchor.path);

    // @ts-expect-error
    if (node.children[0].type?.startsWith("mention"))
      Transforms.move(editor(), { reverse });
  }

  const initialValue = [{ type: 'paragraph', children: [{ text: '' }]}]
  const [globalRanges, setGlobalRanges] = createSignal<DecorationRange[]>([]);
  let [gBlocks, gBlockStrings]: [any[] | null, string[] | null] = [null, null];

  const getFullText = (): [any[], string[], string] => {
    const blocks = editor().children as any[];
    const blockStrings = blocks.map(b => Node.string(b));
    return [blocks, blockStrings, blockStrings.join('\n')];
  }

  const decorate = ([node, path]: any) => {
    if (!Text.isText(node) || path == undefined)
      return [];

    let [blocks, blockStrings] = gBlocks == null || gBlockStrings == null ?
      getFullText() :
      [gBlocks, gBlockStrings];

    try {
      // path: [blockIndex, textNodeIndex]
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

      const tokens = globalRanges();

      // evil magic
      const results: any[] = [];
      for (const t of tokens) {
        const overlapStart = Math.max(t.anchor, nodeStartAbsolute);
        const overlapEnd = Math.min(t.focus, nodeEndAbsolute);
        if (overlapStart < overlapEnd) {
          results.push({
            ...t.attributes,
            [t.type]: true,
            anchor: { path, offset: overlapStart - nodeStartAbsolute },
            focus: { path, offset: overlapEnd - nodeStartAbsolute }
          });
        }
      }

      gBlocks = gBlockStrings = null;
      
      return results;
    } catch {
      return [];
    }
  };

  const Leaf = (props: RenderLeafProps) => {
    const leaf = props.leaf;

    // @ts-expect-error
    const activeRules = LEAF_RULES.filter(rule => leaf[rule.name]);

    let rendered = props.children;

    for (const rule of activeRules) {
      if (rule.leafRender) {
        rendered = rule.leafRender({
          attributes: props.attributes,
          children: rendered,
          leaf
        });
      }
    }

    if (activeRules.length === 0) {
      return (
        <span {...props.attributes}>
          {rendered}
        </span>
      );
    }

    return rendered;
  };

  const MentionUserElement = (props: any) => {
    return (
      <span
        {...props.attributes}
        contentEditable="false"
        class="mention int"
      >
        @{props.element.user?.displayName ?? props.element.user?.username ?? props.element.id}
        {props.children}
      </span>
    );
  };
  const MentionRoleElement = (props: any) => {
    return (
      <span
        {...props.attributes}
        contentEditable="false"
        class="mention int"
      >
        @{props.element.role?.name ?? props.element.id}
        {props.children}
      </span>
    );
  };
  const MentionChannelElement = (props: any) => {
    return (
      <span
        {...props.attributes}
        contentEditable="false"
        class="mention int"
      >
        #{props.element.channel?.name ?? props.element.id}
        {props.children}
      </span>
    );
  };
  const MentionServerElement = (props: any) => {
    return (
      <span
        {...props.attributes}
        contentEditable="false"
        class="mention int"
      >
        ~{props.element.server?.name ?? props.element.id}
        {props.children}
      </span>
    );
  };

  const renderElement = (props: any) => {
    switch (props.element.type) {
      case "mention_user":
        return <MentionUserElement {...props} />;
      case "mention_role":
        return <MentionRoleElement {...props} />;
      case "mention_channel":
        return <MentionChannelElement {...props} />;
      case "mention_server":
        return <MentionServerElement {...props} />;
    }
    return <div {...props.attributes}>{props.children}</div>;
  };

  return (
    <div class="real-wrap">
      <div class="msg-wrap">
        <Slate editor={editor()} initialValue={initialValue} onChange={() => {
          const ed = editor();
          const { selection } = ed;

          if (selection && Range.isCollapsed(selection)) {
            try {
              const [start] = Range.edges(selection);

              const wordBefore = Editor.before(ed, start, { unit: "word" });
              const before = wordBefore && Editor.before(ed, wordBefore);
              const beforeRange = before && Editor.range(ed, before, start);
              const beforeText = beforeRange && Editor.string(ed, beforeRange);
              const beforeMatch = beforeText && beforeText.match(/^@([\w\d_-]+)$/);

              const after = Editor.after(ed, start);
              const afterRange = Editor.range(ed, start, after);
              const afterText = Editor.string(ed, afterRange);
              const afterMatch = afterText.match(/^(\s|$)/);

              if (beforeMatch && afterMatch) {
                // @ts-expect-error
                setTarget(beforeRange);
                setSearch(beforeMatch[1]);
                setIndex(0);
              } else {
                setTarget(null);
              }
            } catch {
              // eat transient error
            }
          } else {
            setTarget(null);
          }

          const [b, bs, fullText] = getFullText();
            
          gBlocks = b;
          gBlockStrings = bs;
          const ranges = tokenizeMarkdown(fullText);
          
          try {
            setGlobalRanges(ranges);
          } catch {
            // lalala yeah i eat transient errors bite me
          }
        }}>
          {target() && mentionResults().length > 0 && (
            <Portal>
              <div
                ref={(el) => {
                  if (!el)
                    return;
                  // @ts-expect-error
                  const domRange = SolidEditor.toDOMRange(editor(), target());
                  const rect = domRange.getBoundingClientRect();
                  el.style.position = 'absolute';
                  el.style.top = `${rect.top + window.pageYOffset + 24}px`;
                  el.style.left = `${rect.left + window.pageXOffset}px`;
                }}
                class="mention-popup"
              >
                <For each={mentionResults()}>
                  {(user, i) => (
                    <div
                      classList={{
                        'mention-item': true,
                        active: i() === index()
                      }}
                      onClick={() => {
                        // @ts-expect-error
                        Transforms.select(editor(), target());
                        insertUserMention(editor(), user);
                        setTarget(null);
                      }}
                    >
                      @{user.displayName ?? user.username}
                    </div>
                  )}
                </For>
              </div>
            </Portal>
          )}
          <Editable
            ref={editableRef}
            class="msg-input"
            placeholder={channelState.currentChannel() ? "Send a message in #" + channelState.currentChannel()?.name : "Send a message into the void"}
            decorate={decorate}
            
            renderLeaf={Leaf}
            renderElement={renderElement}
            onKeyDown={(e) => {
              const t = target();
              const results = mentionResults();

              if (t && results.length > 0) {
                switch (e.key) {
                  case "ArrowDown":
                    e.preventDefault();
                    setIndex((index() + 1) % results.length);
                    return;
                  case "ArrowUp":
                    e.preventDefault();
                    setIndex((index() - 1 + results.length) % results.length);
                    return;
                  case "Tab":
                  case "Enter":
                    e.preventDefault();
                    Transforms.select(editor(), t);
                    insertUserMention(editor(), results[index()]);
                    setTarget(null);
                    return;
                  case "Escape":
                    setTarget(null);
                    return;
                }
              }

              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();

                // get text
                const text = editor().children.map(n => Node.string(n)).join('\n');

                // clear editor
                editor().children.map(() => {
                  Transforms.delete(editor(), { at: [0] })
                });
                const point = { path: [0, 0], offset: 0 }
                editor().selection = { anchor: point, focus: point };
                editor().children = [{
                  // @ts-expect-error
                  type: 'paragraph',
                  children: [{ text: '' }]
                }];
                editor().history = { redos: [], undos: [] };

                const chan = channelState.currentChannel();
                if (chan == null)
                  return;
                const user = authState.user();
                if (user == null)
                  return;
                const msgs = messageState.messages();
                messageState.setMessages([...msgs, {
                  id: -1,
                  channelId: chan.id,
                  authorId: user.id,
                  mentions: [],
                  reactions: [],
                  content: text,
                  previousContent: null,
                  timestamp: Date().toString(),
                  editedTimestamp: null,
                  isDeleted: false,
                  isPinned: false
                }]);

                //if (false) // currently testing stuff so don't send message
                //  sendMessage(chan.id, text);
              }

              // need to queue a microtask because this runs slightly before slate updates its selection stuff
              queueMicrotask(() => skipMention(e.key === "ArrowLeft"));
            }}
            // if the user somehow manages to key up on a mention, skip over it (ripbozo)
            onKeyUp={(e) => skipMention(e.key === "ArrowLeft")}
          />
        </Slate>
      </div>
    </div>
  );
}