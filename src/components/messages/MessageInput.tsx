import { Editable, RenderLeafProps, Slate, withSolid } from '@slate-solid/core'
import { Text, Node, Transforms, createEditor } from 'slate'
import { withHistory } from 'slate-history'
import { Accessor, createMemo, createSignal, Setter } from 'solid-js'
import { channelState } from '../../lib/state/channels';
import { messageState } from '../../lib/state/messages';
import { authState } from '../../lib/state/auth';

export default function MessageInput() {
  const editor = createMemo(() => withHistory(withSolid(createEditor())), []);

  const initialValue = [{ type: 'paragraph', children: [{ text: '' }]}]
  const [globalRanges, setGlobalRanges]: [Accessor<any>, Setter<any>] = createSignal([]);
  let [gBlocks, gBlockStrings]: [any[] | null, string[] | null] = [null, null];

  const colors = [
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
    const rules = [
      { type: "bold", regex: /(?<filler>^|[^*])(?<mds>\*\*)(?<content>[^*]*)(?<esc>[^*])(?<mds2>\*\*)(?<endFiller>$|[^*])/gm },
      { type: "italic", regex: /(?<filler>^|[^_\w])(?<mds>_)(?<content>[^_]*)(?<esc>[^_])(?<mds2>_)(?<endFiller>$|[^_\w])/gm },
      { type: "italic", regex: /(?<filler>^|[^*])(?<mds>\*)(?<content>[^*]*)(?<esc>[^*])(?<mds2>\*)(?<endFiller>$|[^*])/gm },
      { type: "italicbold", regex: /(?<filler>^|[^*])(?<mds>\*\*\*)(?<content>[^*]*)(?<esc>[^*])(?<mds2>\*\*\*)(?<endFiller>$|[^*])/gm },
      { type: "underline", regex: /(?<filler>^|[^_])(?<mds>__)(?<content>[^_]*)(?<esc>[^_])(?<mds2>__)(?<endFiller>$|[^_])/gm },
      { type: "italicunderline", regex: /(?<filler>^|[^_])(?<mds>___)(?<content>[^_]*)(?<esc>[^_])(?<mds2>___)(?<endFiller>$|[^_])/gm },
      { type: "strikethrough", regex: /(?<mds>~~)(?<content>.*)(?<esc>.)(?<mds2>~~)/gm },
      { type: "spoiler", regex: /(?<mds>\|\|)(?<content>[^|]*)(?<esc>.)(?<mds2>\|\|)/gm },
      { type: "code", regex: /(?<filler>^|[^`])(?<mds>`)(?<content>[^`\x0A]*)(?<esc>[^`])(?<mds2>`)(?<endFiller>$|[^`])/g }, // \x0A is \n
      { type: "multicode", regex: /(?<filler>^|[^`])(?<mds>```)(?<content>[\s\S]*)(?<esc>[^`])(?<mds2>```)?(?<endFiller>$|[^`])/gm },
      { type: "header", regex: /^(?<mds>#{1,6})(?<content>\s.+)/gm },
      { type: "subheader", regex: /^(?<mds>-#)(?<content>\s.+)/gm },
      { type: "quote", regex: /^(?<mds>>)(?<content>\s.?)/gm },
      { type: "list", regex: /^(\s*)(?<mds>[-*+])(?<content>\s.?)/gm },
      { type: "mention_user", regex: /<@(?<id>[0-9]+)>/gm },
      { type: "mention_role", regex: /<@&(?<id>[0-9]+)>/gm },
      { type: "mention_channel", regex: /<#(?<id>[0-9]+)>/gm },
      { type: "mention_server", regex: /<~(?<id>[0-9]+)>/gm },
      { type: "emoji", regex: /<:(?<name>[a-zA-Z0-9_]{1,32}):(?<id>[0-9]+)>/gm },
      { type: "color", regex: /(?<mds><(?:color|c):(?<hex>#[0-9A-Fa-f]{3,6}|[a-zA-Z]{0,9})>)(?<content>[\s\S]*?)(?<mds2><\/(?:color|c)>)/gm },
    ];

    const ranges: { anchor: number; focus: number; type: string, hex?: string }[] = [];

    for (const rule of rules) {
      let match: RegExpExecArray | null;
      while ((match = rule.regex.exec(text))) {
        const fillerAdd = match.groups?.filler?.length ?? 0;
        const fillerSub = match.groups?.endFiller?.length ?? 0;
        let start = match.index + fillerAdd;
        let end = start + match[0].length;

        if (rule.type === "color" && match.groups?.hex?.charAt(0) !== '#' && !colors.includes(match.groups?.hex ?? ""))
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

    return (
      <span
        {...props.attributes}
        // @ts-expect-error special attr
        style={{ color: leaf.hex ?? "" }}
        classList={{
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
          //"md-list": leaf.list,
          // @ts-expect-error special attr
          "mds": leaf.mds
        }}
      >
        {props.children}
      </span>
    );
  };

  return (
    <div class="real-wrap">
      <div class="msg-wrap">
        <Slate editor={editor()} initialValue={initialValue} onChange={() => {
          const [b, bs, fullText] = getFullText();
          if (fullText === '') // yeah idk what's going on here
            return;
          gBlocks = b;
          gBlockStrings = bs;
          const ranges = tokenizeMarkdown(fullText);
          setGlobalRanges(ranges);
        }}>
          <Editable
            class="msg-input"
            placeholder={channelState.currentChannel() ? "Send a message in #" + channelState.currentChannel()?.name : "Send a message"}
            decorate={decorate}
            
            renderLeaf={Leaf}
            onKeyDown={(e) => {
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
            }}
          />
        </Slate>
      </div>
    </div>
  );
}