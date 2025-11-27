import { Editable, RenderLeafProps, Slate, withSolid } from '@slate-solid/core'
import { Text, Node, Transforms, createEditor } from 'slate'
import { withHistory } from 'slate-history'
import { createMemo } from 'solid-js'
import { sendMessage } from '../../lib/api/messageApi';

export default function MessageInput() {
  const editor = createMemo(() => withHistory(withSolid(createEditor())), []);

  const initialValue = [{ type: 'paragraph', children: [{ text: '' }]}]

  // BUGS:
  // - spoilers and code blocks have their ending symbol (|| or `) within the main markdown content block if there's a preceeding markdown thing
  // - multiline functionality does not exist (presumably due to the function being processed at a line-level scope rather than an editor-level scope)
  // - using the same kind of markdown twice in a row breaks for some reason (e.g. **hi** **hru**)
  // TODO:
  // - experiment with filler magic to see if they're working properly
  // - fix bugs
  // - user/channel/server mentions
  // - emoji
  function tokenizeMarkdown(text: string) {
    const rules = [
      { type: "bold", regex: /(?<filler>^|[^*])(?<mds>\*\*)([^*]*)(?<esc>[^*])(?<mds2>\*\*)(?<endFiller>$|[^*])/gm },
      { type: "italic", regex: /(?<filler>^|[^_\w])(?<mds>_)([^_]*)(?<esc>[^_])(?<mds2>_)(?<endFiller>$|[^_\w])/gm },
      { type: "italic", regex: /(?<filler>^|[^*])(?<mds>\*)([^*]*)(?<esc>[^*])(?<mds2>\*)(?<endFiller>$|[^*])/gm },
      { type: "italicbold", regex: /(?<filler>^|[^*])(?<mds>\*\*\*)([^*]*)(?<esc>[^*])(?<mds2>\*\*\*)(?<endFiller>$|[^*])/gm },
      { type: "underline", regex: /(?<filler>^|[^_])(?<mds>__)([^_]*)(?<esc>[^_])(?<mds2>__)(?<endFiller>$|[^_])/gm },
      { type: "strikethrough", regex: /(?<mds>~~)(.*)(?<esc>.)(?<mds2>~~)/gm },
      { type: "spoiler", regex: /(?<filler>^|.+)(?<mds>\|\|)(.*)(?<esc>.)(?<mds2>\|\|)/gm },
      { type: "code", regex: /(?<filler>^|[^`])(?<mds>`)([^`]*)(?<esc>[^`])(?<mds2>`)(?<endFiller>$|[^`])/g },
      { type: "multicode", regex: /(?<filler>^|[^`])(?<mds>```)([\s\S]*)(?<esc>[^`])(?<mds2>```)(?<endFiller>$|[^`])/gm },
      { type: "header", regex: /^(?<mds>#{1,6})\s.+/gm },
      { type: "subheader", regex: /^(?<mds>-#)\s.+/gm },
      { type: "quote", regex: /^(?<mds>>)\s.?/gm },
      { type: "list", regex: /^(\s*)(?<mds>[-*+])\s.?/gm },
    ];

    const ranges: { anchor: number; focus: number; type: string }[] = [];

    for (const rule of rules) {
      let match: RegExpExecArray | null;
      while ((match = rule.regex.exec(text))) {
        const fillerAdd = match.groups?.filler?.length ?? 0;
        const fillerSub = match.groups?.endFiller?.length ?? 0;
        let start = match.index + fillerAdd;
        let end = start + match[0].length;
        
        // symbol styling
        if (match.groups?.filler === "\\") {
          ranges.push({
            anchor: match.index,
            focus: start,
            type: "mds"
          });
          continue;
        } else if (match.groups?.esc === "\\") {
          ranges.push({
            anchor: end - match.groups?.mds2?.length - fillerSub - 1,
            focus: end - match.groups?.mds2?.length - fillerSub,
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
          if (rule.type !== "header" && rule.type !== "subheader")
            start += match.groups.mds.length;
        }
        if (match.groups?.mds2) {
          ranges.push({
            anchor: end - match.groups.mds2.length - fillerAdd - fillerSub,
            focus: end - fillerAdd - fillerSub,
            type: "mds"
          });
          if (rule.type !== "header" && rule.type !== "subheader")
            end -= match.groups.mds2.length;
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

  const decorate = ([node, path]: any) => {
    if (!Text.isText(node))
      return [];

    const tokens = tokenizeMarkdown(node.text);

    return tokens.map(t => ({
      [t.type]: true,
      anchor: { path, offset: t.anchor },
      focus: { path, offset: t.focus }
    }));
  };

  const Leaf = (props: RenderLeafProps) => {
    const leaf = props.leaf;

    return (
      <span
        {...props.attributes}
        classList={{
          // @ts-expect-error special attr
          "b": leaf.bold || leaf.italicbold,
          // @ts-expect-error special attr
          "i": leaf.italic || leaf.italicbold,
          // @ts-expect-error special attr
          "u": leaf.underline,
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
        <Slate editor={editor()} initialValue={initialValue}>
          <Editable
            class="msg-input"
            placeholder={"Send a message"}
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
                  type: 'paragraph',
                  children: [{ text: '' }]
                }];
                editor().history = { redos: [], undos: [] };

                if (false) // currently testing stuff so don't send message
                  sendMessage(1, text);
              }
            }}
          />
        </Slate>
      </div>
    </div>
  );
}