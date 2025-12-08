import React from "react";
import { AbstractChannel, Server, User } from "./types";
import { getChannelIcon } from "./ChannelUtils";
import { getDisplayName, getRoleColor } from "./UserUtils";
import { EmojiStyle, UserSettings } from "./userSettings";
import Twemoji from "react-twemoji";

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
];

export interface DecorationRange {
  anchor: number;
  focus: number;
  type: string;
  attributes?: any;
}

export interface MarkdownRule {
  name: string;
  regex: RegExp;
  parseInner?: (match: RegExpExecArray) => boolean;

  // determines which parts of the editor's input to render sepecially
  decorate(match: RegExpExecArray, ctx: { matchIndex: number, text: string }): DecorationRange[];

  // permanent parsing (for sent messages)
  render(match: { match: RegExpExecArray; children: (JSX.Element | string)[]; attributes?: any }): JSX.Element | (JSX.Element | string)[] | string;

  // how to render a range with "type" set to this rule's name
  leafRender?: (props: {
    attributes: any;
    children: any;
    leaf: any;
  }) => JSX.Element;
}

export function tokenizeMarkdown(text: string) {
  const results: DecorationRange[] = [];

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = rule.regex.exec(text))) {
      const decorations = rule.decorate(match, {
        matchIndex: match.index,
        text
      });

      results.push(...decorations);
    }
  }

  return results;
}

let globalParseMarkdownId = 0;

function parseRender(rendered: JSX.Element | (JSX.Element | string)[] | string, nodes: JSX.Element[]) {
  if (React.isValidElement(rendered)) {
    rendered = React.cloneElement(rendered, { key: globalParseMarkdownId++ });
    nodes.push(rendered);
  } else if (typeof rendered === "string") {
    nodes.push(<span key={globalParseMarkdownId++}>{rendered}</span>);
  } else if (rendered instanceof Array) {
    for (var rendered2 of rendered)
      parseRender(rendered2, nodes);
  }
}

// IT'S CLOSE ENOUGH
// (this does not ensure perfect parity with the editor; ***text*** will show up properly as italic bold despite not showing up as italic bold in the editor)
export function parseMarkdown(content: string, attributes?: any): JSX.Element[] {
  if (!content)
    return [];

  let firstMatch: { rule: MarkdownRule, match: RegExpExecArray } | null = null;

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    const match = rule.regex.exec(content);
    if (match && (!firstMatch || match.index < firstMatch.match.index))
      firstMatch = { rule, match };
  }

  if (!firstMatch)
    // no matches, just return a text node with key
    return [<span key={globalParseMarkdownId++}>{content}</span>];

  const { rule, match } = firstMatch;
  const start = match.index;
  const end = start + match[0].length;

  const nodes: JSX.Element[] = [];

  // text before match
  if (start > 0)
    nodes.push(...parseMarkdown(content.slice(0, start), attributes));

  // render matched rule
  const innerContent = match.groups?.content ?? match.groups?.content2 ?? "";
  const childrenNodes = (!rule.parseInner || rule.parseInner(match)) 
    ? parseMarkdown(innerContent, attributes)
    : [<span key={globalParseMarkdownId++}>{innerContent}</span>];

  let rendered = rule.render({ match, children: childrenNodes, attributes });

  // make sure rendered has a key
  parseRender(rendered, nodes);

  // text after match
  if (end < content.length)
    nodes.push(...parseMarkdown(content.slice(end), attributes));

  return nodes;
}

export const RULES: MarkdownRule[] = [
  // render "\"
  {
    name: "mds",
    regex: /\\(\*|_|@|\||`|~|<|\\|\p{Extended_Pictographic})/ug,

    decorate(match) {
      return [
        {
          type: "mds",
          anchor: match.index,
          focus: match.index + 1
        }
      ]
    },

    render(match) {
      return match.match[1];
    }
  },
  // bold text
  {
    name: "bold",
    regex: /(?<!\*|\\)\*\*(?<content>(?:.|\n)+?(?<!\\))\*\*(?!\*)/gm,

    decorate(match) {
      const start = match.index;
      const before = match[0].indexOf("**");
      const after = match[0].lastIndexOf("**");

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + 2
        },
        {
          type: "bold",
          anchor: start + before + 2,
          focus: start + after
        },
        {
          type: "mds",
          anchor: start + after,
          focus: start + after + 2
        }
      ];
    },

    render(match) {
      return <b>{match.children}</b>;
    },
    
    leafRender: ({ attributes, children }) => {
      return (
        <b {...attributes}>
          {children}
        </b>
      );
    }
  },
  // italics
  // needs to be made incompatible with list rule
  {
    name: "italic",
    regex: /(?<!\*|\\)\*(?<content>[^*]+(?<!\\))\*(?!\*)|(?<!_)_(?<content2>[^_]+(?<!\\))_(?!_)/gm,

    decorate(match) {
      const start = match.index;
      const sym = match[0].startsWith("*") ? "*" : "_";
      const before = match[0].indexOf(sym);
      const after = match[0].lastIndexOf(sym);

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + 1
        },
        {
          type: "italic",
          anchor: start + before + 1,
          focus: start + after
        },
        {
          type: "mds",
          anchor: start + after,
          focus: start + after + 1
        }
      ];
    },

    render(match) {
      return <i>{match.children}</i>;
    },

    leafRender: ({ attributes, children }) => {
      return (
        <i {...attributes}>
          {children}
        </i>
      );
    }
  },
  // underline text
  {
    name: "underline",
    regex: /(?<!_|\\)__(?<content>(?:.|\n)+?(?<!\\))__(?!_)/gm,

    decorate(match) {
      const start = match.index;
      const before = match[0].indexOf("__");
      const after = match[0].lastIndexOf("__");

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + 2
        },
        {
          type: "underline",
          anchor: start + before + 2,
          focus: start + after
        },
        {
          type: "mds",
          anchor: start + after,
          focus: start + after + 2
        }
      ];
    },

    render(match) {
      return <u>{match.children}</u>;
    },
    
    leafRender: ({ attributes, children }) => {
      return (
        <u {...attributes}>
          {children}
        </u>
      );
    }
  },
  // strikethrough text
  {
    name: "strikethrough",
    regex: /(?<!~|\\)~~(?<content>(?:.|\n)+?(?<!\\))~~(?!~)/gm,

    decorate(match) {
      const start = match.index;
      const before = match[0].indexOf("~~");
      const after = match[0].lastIndexOf("~~");

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + 2
        },
        {
          type: "strikethrough",
          anchor: start + before + 2,
          focus: start + after
        },
        {
          type: "mds",
          anchor: start + after,
          focus: start + after + 2
        }
      ];
    },

    render(match) {
      return <s>{match.children}</s>;
    },
    
    leafRender: ({ attributes, children }) => {
      return (
        <s {...attributes}>
          {children}
        </s>
      );
    }
  },
  // spoilers
  {
    name: "spoiler",
    regex: /(?<!\||\\)\|\|(?<content>(?:.|\n)+?(?<!\\))\|\|(?!\|)/gm,

    decorate(match) {
      const start = match.index;
      const before = match[0].indexOf("||");
      const after = match[0].lastIndexOf("||");

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + 2
        },
        {
          type: "spoiler",
          anchor: start + before + 2,
          focus: start + after
        },
        {
          type: "mds",
          anchor: start + after,
          focus: start + after + 2
        }
      ];
    },

    render(match) {
      return <span className={"spoiler"} onClick={(e) => e.currentTarget.classList.toggle("shown")}>{match.children}</span>;
    },
    
    leafRender: ({ attributes, children }) => {
      return (
        <span className="spoiler-edit" {...attributes}>
          {children}
        </span>
      );
    }
  },
  // code
  {
    name: "code",
    regex: /(?<!`|\\)`(?<content>[^`]+(?<!\\))`(?!`)/gm,

    decorate(match) {
      const start = match.index;
      const before = match[0].indexOf("`");
      const after = match[0].lastIndexOf("`");

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + 1
        },
        {
          type: "code",
          anchor: start + before + 1,
          focus: start + after
        },
        {
          type: "mds",
          anchor: start + after,
          focus: start + after + 1
        }
      ];
    },

    render(match) {
      return <code>{match.children}</code>;
    },
    
    leafRender: ({ attributes, children }) => {
      return (
        <code {...attributes}>
          {children}
        </code>
      );
    }
  },
  // multiline code block
  {
    name: "multicode",
    regex: /(?<!`|\\)```\n?(?<content>(?:.|\n)+?(?<!\\))```(?!`)/gm,

    decorate(match) {
      const start = match.index;
      const before = match[0].indexOf("```");
      const after = match[0].lastIndexOf("```");

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + 3
        },
        {
          type: "multicode",
          anchor: start + before + 3,
          focus: start + after
        },
        {
          type: "mds",
          anchor: start + after,
          focus: start + after + 3
        }
      ];
    },

    render(match) {
      return <span>{match.children}</span>;
    },
    
    leafRender: ({ attributes, children }) => {
      return (
        <span {...attributes}>
          {children}
        </span>
      );
    }
  },
  // headers
  {
    name: "header",
    regex: /^(#{1,6})\s(?<content>.+)/gm,

    decorate(match) {
      const start = match.index;

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + match[1].length
        },
        {
          type: "header",
          attributes: {
            size: match[1].length
          },
          anchor: start,
          focus: start + match[0].length
        }
      ];
    },

    render(match) {
      return <span className={`h${match.match[1].length}`}>{match.children}</span>;
    },
    
    leafRender: ({ attributes, children, leaf }) => {
      return (
        <span className={`h${leaf.size}`} {...attributes}>
          {children}
        </span>
      );
    }
  },
  // subheaders
  {
    name: "subheader",
    regex: /^-#\s(?<content>.+)/gm,

    decorate(match) {
      const start = match.index;

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + 2
        },
        {
          type: "subheader",
          anchor: start,
          focus: start + match[0].length
        }
      ];
    },

    render(match) {
      return <span className="subheader">{match.children}</span>;
    },
    
    leafRender: ({ attributes, children }) => {
      return (
        <span className="subheader" {...attributes}>
          {children}
        </span>
      );
    }
  },
  // quotes
  {
    name: "quote",
    regex: /^> (?<content>.+)/gm,

    decorate(match) {
      const start = match.index;

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + 1
        },
        {
          type: "quote",
          anchor: start,
          focus: start + match[0].length
        }
      ];
    },

    render(match) {
      return <span className="quote">{match.children}</span>;
    },
    
    leafRender: ({ attributes, children }) => {
      return (
        <span className="quote" {...attributes}>
          {children}
        </span>
      );
    }
  },
  // list
  {
    name: "list",
    regex: /^[-*]\s(?<content>.+)/gm,

    decorate(match) {
      const start = match.index;

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + 1
        },
        {
          type: "list",
          anchor: start,
          focus: start + match[0].length
        }
      ];
    },

    render(match) {
      return <span className="list">{match.children}</span>;
    },
    
    leafRender: ({ attributes, children }) => {
      return (
        <span {...attributes}>
          {children}
        </span>
      );
    }
  },
  // colors
  {
    name: "color",
    regex: /(?<!\\)<(c|color):(?<hex>#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})|[a-zA-Z]{1,21})>(?<content>[\s\S]*?(?<!\\))<\/\1>/gmi,

    decorate(match) {
      if (!match.groups || match.groups.hex?.charAt(0) !== "#" && !COLORS.includes(match.groups.hex.toLowerCase()))
        return [];

      const start = match.index;
      const before = match[0].indexOf(">") + 1;
      const after = match[0].lastIndexOf("<");

      return [
        {
          type: "mds",
          anchor: start,
          focus: start + before
        },
        {
          type: "color",
          attributes: {
            hex: match.groups!.hex
          },
          anchor: start + before,
          focus: start + after
        },
        {
          type: "mds",
          anchor: start + after,
          focus: start + match[0].length
        }
      ];
    },

    render(match) {
      return <span style={{ color: match.match.groups!.hex }}>{match.children}</span>;
    },
    
    leafRender: ({ attributes, children, leaf }) => {
      return (
        <span style={{ color: leaf.hex }} {...attributes}>
          {children}
        </span>
      );
    }
  },
  // links
  {
    name: "link",
    regex: /\[(?<content>[^/]+)\]\((?<link>https?:\/\/[^\s/$.?#]+?\.[^\s]+?)\)|(?<content2>https?:\/\/[^\s/$.?#]+?\.[^\s]+)/gm,
    parseInner: (match) => match.groups?.link !== undefined,

    decorate(match) {
      const start = match.index;

      return match.groups?.link ? [
        {
          type: "mds",
          anchor: start,
          focus: start + 1
        },
        {
          type: "mds",
          anchor: start + match.groups.content.length + 1,
          focus: start + match.groups.content.length + 3
        },
        {
          type: "link",
          attributes: {
            link: match.groups.link
          },
          anchor: start + match.groups.content.length + 3,
          focus: start + match.groups.content.length + match.groups.link.length + 3
        },
        {
          type: "mds",
          anchor: start + match[0].length - 1,
          focus: start + match[0].length
        }
      ] : [
        {
          type: "link",
          attributes: {
            link: match.groups!.content2
          },
          anchor: start,
          focus: start + match[0].length
        }
      ];
    },

    render(match) {
      return <a target="_blank" href={match.match.groups!.link ?? match.match.groups!.content2} >{match.children}</a>;
    },
    
    leafRender: ({ attributes, children }) => {
      return (
        <a {...attributes}>
          {children}
        </a>
      );
    }
  },
  // @everyone and @here
  {
    name: "mention_everyone",
    regex: /(?<!\\)@(?<type>everyone|here)/gm,

    decorate() {
      return [];
    },

    render(match) {
      return <span className="mention int">{match.match[0]}</span>;
    }
  },
  // user mentions
  {
    name: "mention_user",
    regex: /(?<!\\)<@(?<id>-?[0-9]+)>/gm,

    decorate() {
      return [];
    },

    render(match) {
      if (match.match.groups!.id.startsWith("-") && match.match.groups!.id !== "-1")
        return match.match[0]; // invalid mention
      const fallback = `<@${match.match.groups!.id}>`;
      const u = match.attributes?.userState.users.find(
        (u: User) => u.id === Number(match.match.groups!.id)
      );
      const m = u ? match.attributes?.userState.getMember(u.id, match.attributes?.serverState.currentServer?.id) : undefined;

      const name = u ? "@" + getDisplayName(u, m) : fallback;
      const roleColor = u ? getRoleColor(match.attributes?.serverState, u, m, match.attributes?.serverState.currentServer === null) : undefined;

      return (
        <span
          className="mention int"
          style={{
            fontFamily: `${m?.nameFont}, ${u?.nameFont}, Inter, Avenir, Helvetica, Arial, sans-serif`,
            // @ts-expect-error CSS variable
            "--special-mention-color": roleColor
          }}
          onClick={u && match.attributes?.onMentionClick ? e => match.attributes.onMentionClick(u, m, e) : undefined}
        >
          {name}
        </span>
      );
    }
  },
  // role mentions
  {
    name: "mention_role",
    regex: /(?<!\\)<@&(?<id>[0-9]+)>/gm,

    decorate() {
      return [];
    },

    render(match) {
      const fallback = `<@&${match.match.groups!.id}>`;
      const s: Server = match.attributes?.currentServer;
      if (!s)
        return <span className="mention int">{fallback}</span>;
      const r = s.roles.find(r => r.id == Number(match.match.groups!.id));
      const name = r?.name ? "@" + r?.name : fallback;
      return (
        <span
          className="mention int"
          style={{
            // @ts-expect-error CSS variable
            "--special-mention-color": r && r.color ? `#${r.color.toString(16).padStart(6, "0")}` : undefined
          }}
          onClick={r && match.attributes?.onRoleClick ? e => match.attributes.onRoleClick(r, s, e) : undefined}
        >
          {name}
        </span>
      );
    }
  },
  // channel mentions
  {
    name: "mention_channel",
    regex: /(?<!\\)<#(?<id>-?[0-9]+)>/gm,

    decorate() {
      return [];
    },

    render(match) {
      if (match.match.groups!.id.startsWith("-") && match.match.groups!.id !== "-1")
        return match.match[0]; // invalid mention
      const fallback = `<#${match.match.groups!.id}>`;
      const c: AbstractChannel = match.attributes?.channelState.get(Number(match.match.groups!.id));
      const name = c?.name ?? fallback;
      return (
        <span
          className="mention int"
          onClick={c && match.attributes?.onChannelClick ? e => match.attributes.onChannelClick(c, e) : undefined}
        >
          {c?.name && getChannelIcon(c, { className: "icon" })}{name}
        </span>
      );
    }
  },
  // server mentions
  {
    name: "mention_server",
    regex: /(?<!\\)<~(?<id>-?[0-9]+)>/gm,

    decorate() {
      return [];
    },

    render(match) {
      if (match.match.groups!.id.startsWith("-") && match.match.groups!.id !== "-1")
        return match.match[0]; // invalid mention
      const fallback = `<~${match.match.groups!.id}>`;
      const s = match.attributes?.serverState.get(Number(match.match.groups!.id));
      const name = s?.name ? "~" + s?.name : fallback;
      return (
        <span
          className="mention int"
          onClick={s && match.attributes?.onServerClick ? e => match.attributes.onServerClick(s, e) : undefined}
        >
          {name}
        </span>
      );
    }
  },
  // big emoji
  {
    name: "big_emoji",
    regex: /^(\p{Extended_Pictographic}\ufe0f?){1,64}$/ug,

    decorate() {
      return [];
    },

    render(match) {
      const text = match.match[0];

      // Split into individual emoji codepoints (each may include FE0F)
      const parts = Array.from(text.matchAll(/\p{Extended_Pictographic}\uFE0F?/ug)).map(m => m[0]);

      return parts.map(emoji =>
        renderEmoji(
          match.attributes.userSettings,
          emoji,
          `emoji-${match.attributes.noBigEmoji ? "text" : "big"} int`,
          match.attributes.onEmojiClick
        )
      );
    }
  },
  // emoji
  {
    name: "emoji",
    regex: /(?<!\\)(\p{Extended_Pictographic})/ug,

    decorate() {
      return [];
    },

    render(match) {
      return renderEmoji(match.attributes.userSettings, match.match[1], "emoji-text int", match.attributes.onEmojiClick);
    }
  }

  //{ type: "italicbold", regex: /(?<filler>^|[^*])(?<mds>\*\*\*)(?<content>.*?)(?<esc>[^*])(?<mds2>\*\*\*)(?<endFiller>$|[^*])/gm },
  //{ type: "italicunderline", regex: /(?<filler>^|[^_])(?<mds>___)(?<content>.*?)(?<esc>[^_])(?<mds2>___)(?<endFiller>$|[^_])/gm },
];

export const LEAF_RULES = [...RULES.filter(rule => rule.leafRender),
  {
    name: "mds",
    leafRender: ({ attributes, children }: any) => {
      return (
        <span className="mds" {...attributes}>
          {children}
        </span>
      );
    }
  },
  {
    name: "hide",
    leafRender: ({ attributes, children }: any) => {
      return (
        <span className="hide" {...attributes}>
          {children}
        </span>
      );
    }
  }
];

export function renderEmoji(userSettings: UserSettings | null, emoji: string, className: string = "emoji-text", onClick: Function | null = null) {
  return (
    userSettings?.emojiStyle === EmojiStyle.System ? (
      <span
        className={className.replace(/emoji-([a-z]+)/g, match => match + "-system")}
        onClick={e => {
          if (onClick == null)
            return;
          onClick(emoji, e);
        }}
      >
        {emoji}
      </span>
    ) : (
      <Twemoji
        options={{
          className,
          folder: "svg",
          ext: ".svg"
        }}
        noWrapper={true}
      >
        <span
          onClick={e => {
            if (onClick == null)
              return;
            onClick(emoji, e);
          }}
        >
          {emoji}
        </span>
      </Twemoji>
    )
  );
}