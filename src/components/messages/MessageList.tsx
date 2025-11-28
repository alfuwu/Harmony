import { createMemo, For, onMount, onCleanup } from "solid-js";
import { messageState } from "../../lib/state/messages";
import { channelState } from "../../lib/state/channels";
import { userState } from "../../lib/state/users";
import { Message } from "../../lib/utils/types";

const MERGE_WINDOW = 7 * 60 * 1000; // 7 minutes in ms
const DEFAULT_AVATAR =
  "https://cdn.discordapp.com/avatars/1038466644353232967/2cf70b3cc2b0314758dd9f8155228c89.png?size=1024";

export default function MessageList() {
  let container: HTMLDivElement | undefined;

  // Filter messages by channel
  const channelMessages = createMemo(() => {
    const chan = channelState.currentChannel();
    if (!chan) return [];
    return messageState.messages()
      .filter(m => m.channelId === chan.id)
      .sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  });

  function formatMessageTimestamp(iso: string): string {
    const date = new Date(iso);
    const now = new Date();

    const isSameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isSameDay) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

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
    if (container) container.scrollTop = container.scrollHeight;
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
            };
          const avatar = author.avatar ?? DEFAULT_AVATAR;

          let showHeader = true;
          const prevMsg = channelMessages()[i() - 1];
          if (prevMsg && prevMsg.authorId === msg.authorId) {
            const prevTs = new Date(prevMsg.timestamp).getTime();
            const currTs = new Date(msg.timestamp).getTime();
            if (currTs - prevTs <= MERGE_WINDOW) showHeader = false;
          }

          return (
            <div class={"message" + (msg.isDeleted ? " deleted" : "")}>
              {showHeader && (
                <div class="group-header">
                  <img class="avatar" src={avatar} alt="avatar" />
                  <div class="header-meta">
                    <span class="author">{author.displayName ?? author.username}</span>
                    <span class="timestamp">
                      {"• " + formatMessageTimestamp(msg.timestamp)}
                    </span>
                  </div>
                </div>
              )}

              <span class="content">{msg.content}</span>

              {msg.editedTimestamp && <span class="edited-mark"> (edited)</span>}

              {msg.previousContent && msg.previousContent.length > 0 && (
                <details class="edit-history">
                  <ul>
                    <For each={msg.previousContent}>{prev => <li>{prev}</li>}</For>
                  </ul>
                </details>
              )}
            </div>
          );
        }}
      </For>
    </div>
  );
}
