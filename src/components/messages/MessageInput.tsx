import { Editable, RenderLeafProps, Slate, SolidEditor, withSolid } from '@slate-solid/core'
import { Text, Node, Transforms, createEditor, Editor, Range } from 'slate'
import { withHistory } from 'slate-history'
import { Accessor, createMemo, createSignal, For, Setter } from 'solid-js'
import { channelState } from '../../lib/state/channels';
import { messageState } from '../../lib/state/messages';
import { authState } from '../../lib/state/auth';
import { rules } from '../../lib/utils/markdown';
import { User } from '../../lib/utils/types';
import { userState } from '../../lib/state/users';
import { Portal } from 'solid-js/web';

// TODO: add support for role mentions, channel mentions, and server mentions

const withMentions = (editor: Editor) => {
  const { isInline, isVoid, markableVoid } = editor

  editor.isInline = element =>
    // @ts-expect-error
    element.type === 'mention' ? true : isInline(element);

  editor.isVoid = element =>
    // @ts-expect-error
    element.type === 'mention' ? true : isVoid(element);

  editor.markableVoid = element =>
    // @ts-expect-error
    element.type === 'mention' || markableVoid(element);

  return editor
}

const insertMention = (editor: Editor, user: User) => {
  const mention = {
    type: 'mention',
    user,
    children: [{ text: `<@${user.id}>` }]
  };
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor);
};

export const COLORS = [
  "red", "orange", "yellow", "blue", "indigo", "violet", "purple", "pink", "gray", "grey", "white", "black",
  "brown", "lavender", "teal", "magenta", "lime", "navy", "silver", "maroon", "fuchsia", "olive", "aqua",
  "aliceblue", "antiquewhite", "aquamarine", "azure", "beige", "bisque", "blanchedalmond", "blueviolet",
  "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson",
  "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray", "darkgrey", "darkgreen", "darkkhaki",
  "darkmagenta", "darkolivegreen", "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
  "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise", "darkviolet", "deeppink", "deepskyblue",
  "dimgray", "dimgrey", "dodgerblue", "firebrick", "floralwhite", "forestgreen", "gainsboro", "ghostwhite",
  "gold", "goldenrod", "greenyellow", "honeydew", "hotpink", "indianred", "ivory", "khaki", "lavenderblush",
  "lawngreen", "lemonchiffon", "lightblue", "lightcoral", "lightcyan", "lightgoldrenrodyellow", "lightgray",
  "lightgrey", "lightgreen", "lightpink", "lightsalmon", "lightseaegreen", "lightskyblue", "lightslategray",
  "lightslategrey", "lightsteelblue", "lightyellow", "limegreen", "linen", "mediumaquamarine", "mediumblue",
  "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen", "mediumturquoise",
  "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin", "navajowhite", "oldlace",
  "olivedrab", "orangered", "orchid", "palegoldenrod", "palegreen", "paleturquoise", "palevioletred",
  "papayawhip", "peachpuff", "peru", "plum", "powederblue", "rebeccapurple", "rosybrown", "royalblue",
  "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell", "sienna", "skyblue", "slateblue",
  "slategray", "slategrey", "snow", "springgreen", "steelblue", "tan", "thistle", "tomato", "turquoise",
  "wheat", "whitesmoke", "yellowgreen"
]

// BUGS:
// - using the same kind of markdown twice in a row without two characters of some kind in between breaks (e.g. **hi** **hru**)
//   ^^^ almost certainly due to filler shenanigans
// TODO:
// - render user/channel/server mentions
// - render emoji
function tokenizeMarkdown(text: string) {
  const ranges: { anchor: number; focus: number; type: string, hex?: string }[] = [];

  for (const rule of rules) {
    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(text))) {
      const fillerAdd = match.groups?.filler?.length ?? 0;
      const fillerSub = match.groups?.endFiller?.length ?? 0;
      let start = match.index + fillerAdd;
      let end = start + match[0].length;

      if (rule.type === "color" && match.groups?.hex?.charAt(0) !== '#' && !COLORS.includes(match.groups?.hex ?? ""))
        continue;
      
      // symbol styling
      if (match.groups?.filler === "\\") {
        ranges.push({
          anchor: match.index,
          focus: start,
          type: "mds"
        });

        if (match.groups?.esc !== "\\")
          continue;
      }
      if (match.groups?.esc === "\\") {
        ranges.push({
          anchor: end - match.groups?.mds2?.length - fillerAdd - fillerSub - 1,
          focus: end - match.groups?.mds2?.length - fillerAdd - fillerSub,
          type: "mds"
        });
        continue;
      }
      if (match.groups?.mds) {
        ranges.push({
          anchor: start,
          focus: start + match.groups.mds.length,
          type: "mds"
        });
        if (rule.type !== "header" && rule.type !== "subheader" && rule.type !== "multicode")
          start += match.groups.mds.length;
      }
      if (match.groups?.mds2) {
        ranges.push({
          anchor: end - match.groups.mds2.length - fillerAdd - fillerSub,
          focus: end - fillerAdd - fillerSub,
          type: "mds"
        });
        if (rule.type !== "header" && rule.type !== "subheader" && rule.type !== "multicode")
          end -= match.groups.mds2.length;
      }
      if (match.groups?.mds3) {
        ranges.push({
          anchor: start + match.groups.content.length,
          focus: start + match.groups.content.length + match.groups.mds3.length,
          type: "mds"
        });
        if (rule.type !== "header" && rule.type !== "subheader" && rule.type !== "multicode")
          start += match.groups.content.length + match.groups.mds3.length;
      }

      if (rule.type === "color" && match.groups) {
        const hex = match.groups.hex;
        if (!hex)
          continue;

        ranges.push({
          anchor: start,
          focus: end,
          type: "color",
          hex
        });
        continue;
      }

      // other stuff
      ranges.push({
        anchor: start,
        focus: end - fillerSub,
        type: rule.type === "header" && match.groups?.mds ? `h${match.groups.mds.length}` : rule.type
      });
    }
  }

  return ranges;
}

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
    if (node.children[0].type === 'mention')
      Transforms.move(editor(), { reverse });
  }

  const initialValue = [{ type: 'paragraph', children: [{ text: '' }]}]
  const [globalRanges, setGlobalRanges]: [Accessor<any>, Setter<any>] = createSignal([]);
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

    // path: [blockIndex, textNodeIndex]
    const blockIndex = path[0];
    const textNodeIndex = path[1];

    let priorBlocksLen = 0;
    for (let i = 0; i < blockIndex; i++) {
      priorBlocksLen += blockStrings[i].length + 1;
    }

    const block = blocks[blockIndex];
    let priorTextsLen = 0;
    for (let i = 0; i < textNodeIndex; i++) {
      priorTextsLen += Node.string(block.children[i]).length;
    }

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
          [t.type]: true,
          anchor: { path, offset: overlapStart - nodeStartAbsolute },
          focus: { path, offset: overlapEnd - nodeStartAbsolute },
          hex: t.hex
        });
      }
    }

    gBlocks = gBlockStrings = null;
    
    return results;
  };

  const Leaf = (props: RenderLeafProps) => {
    const leaf = props.leaf;

    const classList = {
      // @ts-expect-error special attr
      "b": leaf.bold || leaf.italicbold,
      // @ts-expect-error special attr
      "i": leaf.italic || leaf.italicbold || leaf.italicunderline,
      // @ts-expect-error special attr
      "u": leaf.underline || leaf.italicunderline,
      // @ts-expect-error special attr
      "s": leaf.strikethrough,
      // @ts-expect-error special attr
      "spoiler-edit": leaf.spoiler,
      // @ts-expect-error special attr
      "code": leaf.code,
      // @ts-expect-error special attr
      "multiline-code": leaf.multicode,
      // @ts-expect-error special attr
      "h1": leaf.h1,
      // @ts-expect-error special attr
      "h2": leaf.h2,
      // @ts-expect-error special attr
      "h3": leaf.h3,
      // @ts-expect-error special attr
      "h4": leaf.h4,
      // @ts-expect-error special attr
      "h5": leaf.h5,
      // @ts-expect-error special attr
      "h6": leaf.h6,
      // @ts-expect-error special attr
      "subheader": leaf.subheader,
      // @ts-expect-error special attr
      "quote": leaf.quote,
      //"list": leaf.list,
      // @ts-expect-error special attr
      "mds": leaf.mds,
    };

    // @ts-expect-error special attr
    if (leaf.link)
      return (
        <a
          {...props.attributes}
          classList={classList}
        >
          {props.children}
        </a>
      )

    return (
      <span
        {...props.attributes}
        // @ts-expect-error special attr
        style={{ color: leaf.hex ?? "" }}
        classList={classList}
      >
        {props.children}
      </span>
    );
  };

  const MentionElement = (props: any) => {
    return (
      <span
        {...props.attributes}
        contentEditable="false"
        class="mention int"
      >
        @{props.element.user.displayName ?? props.element.user.username}
        {props.children}
      </span>
    );
  };

  const renderElement = (props: any) => {
    if (props.element.type === 'mention')
      return <MentionElement {...props} />;
    return <span {...props.attributes}>{props.children}</span>;
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

              const wordBefore = Editor.before(ed, start, { unit: 'word' });
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
                        insertMention(editor(), user);
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
                  case 'ArrowDown':
                    e.preventDefault();
                    setIndex((index() + 1) % results.length);
                    return;
                  case 'ArrowUp':
                    e.preventDefault();
                    setIndex((index() - 1 + results.length) % results.length);
                    return;
                  case 'Tab':
                  case 'Enter':
                    e.preventDefault();
                    Transforms.select(editor(), t);
                    insertMention(editor(), results[index()]);
                    setTarget(null);
                    return;
                  case 'Escape':
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