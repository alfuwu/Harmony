export const linkRegex = /(?<mds>\[)(?<content>[^/]+)(?<mds3>\]\()(?<link>https?:\/\/[^\s)]+)(?<mds2>\))|(?<content2>https?:\/\/[^\s/$.?#].[^\s]*)/gm;

export const rules = [
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
  { type: "header", regex: /^(?<mds>#{1,6})\s(?<content>.+)/gm },
  { type: "subheader", regex: /^(?<mds>-#)\s(?<content>.+)/gm },
  { type: "quote", regex: /^(?<mds>>)\s(?<content>.*)/gm },
  { type: "list", regex: /^(\s*)(?<mds>[-*+])\s(?<content>.*)/gm },
  { type: "mention_user", regex: /<@(?<id>[0-9]+)>/gm },
  { type: "mention_role", regex: /<@&(?<id>[0-9]+)>/gm },
  { type: "mention_channel", regex: /<#(?<id>[0-9]+)>/gm },
  { type: "mention_server", regex: /<~(?<id>[0-9]+)>/gm },
  { type: "emoji", regex: /<:(?<name>[a-zA-Z0-9_]{1,32}):(?<id>[0-9]+)>/gm },
  { type: "color", regex: /(?<mds><(?:color|c):(?<hex>#[0-9A-Fa-f]{3,6}|[a-zA-Z]{0,21})>)(?<content>[\s\S]*?)(?<mds2><\/(?:color|c)>)/gm },
  { type: "link", regex: linkRegex }
];