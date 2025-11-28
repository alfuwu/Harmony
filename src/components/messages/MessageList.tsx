import { createMemo, For, onMount, onCleanup, createSignal, Show } from "solid-js";
import { messageState } from "../../lib/state/messages";
import { channelState } from "../../lib/state/channels";
import { userState } from "../../lib/state/users";
import { rules } from "../../lib/utils/markdown";

const MERGE_WINDOW = 7 * 60 * 1000; // 7 minutes in ms
const DEFAULT_AVATAR =
  "https://cdn.discordapp.com/avatars/1038466644353232967/2cf70b3cc2b0314758dd9f8155228c89.png?size=1024";

export default function MessageList() {
  let container: HTMLDivElement | undefined;

  // filter messages by channel
  const channelMessages = createMemo(() => {
    const chan = channelState.currentChannel();
    if (!chan)
      return [];
    return messageState.messages()
      .filter(m => m.channelId === chan.id)
      .sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  });

  function parseMarkdown(content: string) {
    let nodes: any[] = [content];

    for (const rule of rules) {
      const newNodes: any[] = [];

      nodes.forEach((node) => {
        if (typeof node !== "string") {
          // Already parsed JSX node
          newNodes.push(node);
          return;
        }

        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = rule.regex.exec(node)) !== null) {
          if (match.index > lastIndex)
            newNodes.push(node.slice(lastIndex, match.index));
          if (!match.groups) {
            lastIndex = match.index + match[0].length;
            continue;
          }

          const inner = (match.groups.content ?? match.groups.content2) + (match.groups.esc !== "\\" && match.groups.esc !== undefined ? match.groups.esc : "");

          switch (rule.type) {
            case "bold":
              newNodes.push(<b>{inner}</b>);
              break;
            case "italic":
              newNodes.push(<i>{inner}</i>);
              break;
            case "italicbold":
              newNodes.push(<b><i>{inner}</i></b>);
              break;
            case "underline":
              newNodes.push(<u>{inner}</u>);
              break;
            case "italicunderline":
              newNodes.push(<u><i>{inner}</i></u>);
              break;
            case "strikethrough":
              newNodes.push(<s>{inner}</s>);
              break;
            case "spoiler":
            case "subheader":
            case "quote":
            case "list":
              newNodes.push(<span class={rule.type}>{inner}</span>);
              break;
            case "code":
              newNodes.push(<code>{inner}</code>);
              break;
            case "multicode":
              newNodes.push(<pre><code>{inner}</code></pre>);
              break;
            case "header":
              newNodes.push(<span class={`h${match.groups.mds.length}`}>{inner}</span>);
              break;
            case "mention_user":
              newNodes.push(<span class="mention int">{(() => {
                const u = userState.users().filter(u => u.id == Number(match!.groups!.id))[0];
                return "@" + (u?.displayName ?? u?.username ?? match!.groups!.id);
              })()}</span>);
              break;
            case "mention_role":
              newNodes.push(<span>{inner}</span>);
              break;
            case "mention_channel":
              newNodes.push(<span>{inner}</span>);
              break;
            case "mention_server":
              newNodes.push(<span>{inner}</span>);
              break;
            case "emoji":
              newNodes.push(<span>{inner}</span>);
              break;
            case "color":
              newNodes.push(<span style={{ color: match.groups.hex }}>{inner}</span>);
              break;
            case "link":
              newNodes.push(<a target="_blank" href={match.groups.link ?? inner}>{inner}</a>);
              break;
          }

          lastIndex = match.index + match[0].length;
        }

        if (lastIndex < node.length)
          newNodes.push(node.slice(lastIndex));
      });

      nodes = newNodes;
    }

    return nodes;
  }

  function formatMessageTimestamp(iso: string): string {
    const date = new Date(iso);
    const now = new Date();

    const isSameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isSameDay)
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    const isYesterday =
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate();

    if (isYesterday) {
      const t = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return `Yesterday at ${t}`;
    }

    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear().toString();
    return `${month}/${day}/${year}`;
  }

  // scroll handling
  const scrollToBottom = () => {
    if (container)
      container.scrollTop = container.scrollHeight;
  };

  const observer = new MutationObserver(scrollToBottom);

  onMount(() => {
    scrollToBottom();
    if (container)
      observer.observe(container, { childList: true, subtree: true });
  });

  onCleanup(() => observer.disconnect());

  return (
    <div class="message-list" ref={container}>
      <For each={channelMessages()}>
        {(msg, i) => {
          const author =
            userState.users().find(u => u.id === msg.authorId) ?? {
              displayName: null,
              username: "Unknown User",
              avatar: null,
              nameFont: null
            };
          const avatar = author.avatar ?? DEFAULT_AVATAR;
          
          let showHeader = true;
          const prevMsg = channelMessages()[i() - 1];
          if (prevMsg && prevMsg.authorId === msg.authorId) {
            const prevTs = new Date(prevMsg.timestamp).getTime();
            const currTs = new Date(msg.timestamp).getTime();
            if (currTs - prevTs <= MERGE_WINDOW)
              showHeader = false;
          }

          const [hover, setHover] = createSignal(false);

          return (
            <div class={"message" + (msg.isDeleted ? " deleted" : "")}>
              {showHeader && (
                <div class="group-header">
                  <img class="avatar int" src={avatar} alt="avatar" />
                  <div class="header-meta">
                    <span
                      class="author int"
                      style={{
                        "font-family": hover() ? "" : author.nameFont?.startsWith("https://") ? `url(${author.nameFont})` : author.nameFont ?? ""
                      }}
                      onMouseEnter={() => setHover(true)}
                      onMouseLeave={() => setHover(false)}
                      data-hover={hover()}
                    >
                      <Show when={hover()}>
                        <span class="semitrans">@</span>
                      </Show>
                      {hover() ? author.username : author.displayName ?? author.username}
                    </span>
                    <span class="timestamp">
                      <span class="mr uno">•</span>
                      {formatMessageTimestamp(msg.timestamp)}
                    </span>
                  </div>
                </div>
              )}

              <div class="content-container">
                {!showHeader && (
                  <span class="timestamp">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
                <span class="content">
                  {parseMarkdown(msg.content)}
                </span>
              </div>

              {msg.editedTimestamp && <span class="edited-mark"> (edited)</span>}

              {msg.previousContent && msg.previousContent.length > 0 && (
                <div class="edit-history">
                  <ul>
                    <For each={msg.previousContent}>{prev => <span>{prev}</span>}</For>
                  </ul>
                </div>
              )}
            </div>
          );
        }}
      </For>
    </div>
  );
}
