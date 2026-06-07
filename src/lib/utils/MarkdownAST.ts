export type TextNode            = { type: 'text';             content: string };
export type BoldNode            = { type: 'bold';             children: InlineNode[] };
export type ItalicNode          = { type: 'italic';           children: InlineNode[] };
export type BoldItalicNode      = { type: 'boldItalic';       children: InlineNode[] };
export type UnderlineNode       = { type: 'underline';        children: InlineNode[] };
export type StrikethroughNode   = { type: 'strikethrough';    children: InlineNode[] };
export type SpoilerNode         = { type: 'spoiler';          children: InlineNode[] };
export type CodeNode            = { type: 'code';             content: string };
export type SuperscriptNode     = { type: 'superscript';      children: InlineNode[] };
export type SubscriptNode       = { type: 'subscript';        children: InlineNode[] };
export type ColorNode           = { type: 'color';            hex: string; children: InlineNode[] };
export type LinkNode            = { type: 'link';             url: string; label?: InlineNode[] };
export type TimestampNode       = { type: 'timestamp';        timestamp: number; style: string };
export type MentionUserNode     = { type: 'mentionUser';      id: number };
export type MentionEveryoneNode = { type: 'mentionEveryone';  subtype: 'everyone' | 'here' };
export type MentionRoleNode     = { type: 'mentionRole';      id: number };
export type MentionChannelNode  = { type: 'mentionChannel';   id: number };
export type MentionServerNode   = { type: 'mentionServer';    id: number };
export type EmojiNode           = { type: 'emoji';            native: string };
export type InlineSubheader     = { type: 'inlineSubheader';  children: InlineNode[] };
export type InlineHeader        = { type: 'inlineHeader';     level: 1|2|3|4|5|6; children: InlineNode[] };
export type InlineMathNode      = { type: 'inlineMath';       content: string };
export type HighlightNode       = { type: 'highlight';        children: InlineNode[] };
export type LowlightNode        = { type: 'lowlight';         children: InlineNode[] };
export type HexColorNode        = { type: 'hexColor';         content: string };

export type InlineNode =
  | TextNode | BoldNode | ItalicNode | BoldItalicNode | UnderlineNode
  | StrikethroughNode | SpoilerNode | CodeNode | SuperscriptNode | SubscriptNode
  | ColorNode | LinkNode | TimestampNode | MentionUserNode | MentionEveryoneNode
  | MentionRoleNode | MentionChannelNode | MentionServerNode | EmojiNode
  | InlineSubheader | InlineHeader | InlineMathNode | HighlightNode | LowlightNode
  | HexColorNode;

export type ParagraphNode         = { type: 'paragraph';         children: InlineNode[] };
export type HeaderNode            = { type: 'header';            level: 1|2|3|4|5|6; children: InlineNode[] };
export type SubheaderNode         = { type: 'subheader';         children: InlineNode[] };
export type QuoteNode             = { type: 'quote';             children: InlineNode[] };
export type ListItemNode          = { type: 'listItem';          children: InlineNode[] };
export type NumberedListItemNode  = { type: 'numberedListItem';  number: number; children: InlineNode[] };
export type CodeBlockNode         = { type: 'codeBlock';         language?: string; content: string };
export type MathBlockNode         = { type: 'mathBlock';         content: string };
export type TableCellNode         = { type: 'tableCell';         header: boolean; align: 'left' | 'center' | 'right' | null; children: InlineNode[] };
export type TableRowNode          = { type: 'tableRow';          cells: TableCellNode[] };
export type TableNode             = { type: 'table';             rows: TableRowNode[] };

export type BlockNode =
  | ParagraphNode | HeaderNode | SubheaderNode | QuoteNode
  | ListItemNode | NumberedListItemNode | CodeBlockNode
  | MathBlockNode | TableNode;

export type DocumentAST = BlockNode[];

export interface DecoToken {
  start: number;
  end: number;
  style: string;
  attributes?: Record<string, unknown>;
}

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
