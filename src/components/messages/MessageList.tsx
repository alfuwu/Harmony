import { useEffect, useMemo, useRef, useState } from "react";
import { useServerState } from "../../lib/state/Servers";
import { useChannelState } from "../../lib/state/Channels";
import { useMessageState } from "../../lib/state/Messages";
import { useUserState } from "../../lib/state/Users";
import { parseMarkdown } from "../../lib/utils/Markdown";
import { getAvatar, getDisplayName, getPronouns, getRoleColor } from "../../lib/utils/UserUtils";
import { Channel, Member, Server, User } from "../../lib/utils/types";
import { useMemberState } from "../../lib/state/Members";
import { usePopoutState } from "../../lib/state/Popouts";
import { useAuthState } from "../../lib/state/Auth";
import { loadServer } from "../../lib/api/serverApi";
import UserPopout from "../layout/popouts/UserPopout";
import EmojiPopout from "../layout/popouts/EmojiPopout";
import { getEmojiDataFromNative } from "emoji-mart";

const MERGE_WINDOW = 7 * 60 * 1000; // 7 minutes in ms

export default function MessageList() {
  const { token, user, userSettings } = useAuthState();
  const serverState = useServerState();
  const channelState = useChannelState();
  const userState = useUserState();
  const memberState = useMemberState();
  const messageState = useMessageState();
  const container = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const [hoveredMessages, setHoveredMessages] = useState<Record<string, boolean>>({});

  const { open, close } = usePopoutState();

  function setHover(id: string, value: boolean) {
    setHoveredMessages(prev => ({ ...prev, [id]: value }));
  }

  const channelMessages = useMemo(() => {
    let c = channelState.currentChannel;
    if (!c)
      return [];
    return messageState.messages
      .filter(m => m.channelId === c.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [channelState, messageState.messages]);

  const handleScroll = () => {
    if (!container.current)
      return;
    const el = container.current;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 10; // 10px threshold
  };

  useEffect(() => {
    const el = container.current;
    if (!el)
      return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!container.current)
      return;

    const el = container.current;

    const lastMessage = channelMessages[channelMessages.length - 1];
    const userSentMessage = user && lastMessage?.authorId === user.id;

    if (userSentMessage || wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      wasAtBottomRef.current = true;
    }
  }, [channelMessages]);

  useEffect(() => {
    if (!container.current)
      return;
    const el = container.current;

    const resizeObserver = new ResizeObserver(() => {
      if (wasAtBottomRef.current)
        el.scrollTop = el.scrollHeight;
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

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

  function openUserPopout(target: Element, user: User, member: Member | undefined) {
    const rect = target.getBoundingClientRect();
    open({
      id: "user-profile",
      element: (
        <UserPopout
          user={user}
          member={member}
          serverState={serverState}
          onClose={() => close("user-profile")}
          position={{
            top: rect.bottom + window.scrollY,
            left: rect.right + window.scrollX
          }}
        />
      ),
      options: {}
    });
  }

  return (
    <div className="message-list ovy-auto" ref={container}>
      {channelMessages.map((msg, i) => {
        const author = userState.get(msg.authorId) || {
          displayName: null,
          username: "Unknown User",
          avatar: null,
          nameFont: null,
        } as User;

        const member = memberState.get(author.id, serverState.currentServer?.id);
        const name = getDisplayName(author, member);
        const avatar = getAvatar(author, member);
        const roleColor = getRoleColor(serverState, author, member, serverState.currentServer === null);
        const pronouns = getPronouns(author, member);

        let showHeader = true;
        const prevMsg = channelMessages[i - 1];
        if (prevMsg && prevMsg.authorId === msg.authorId) {
          const prevTs = new Date(prevMsg.timestamp).getTime();
          const currTs = new Date(msg.timestamp).getTime();
          if (currTs - prevTs <= MERGE_WINDOW)
            showHeader = false;
        }

        const hover = hoveredMessages[msg.id + msg.timestamp] || false;

        return (
          <div key={msg.id + msg.timestamp + "idx:" + i} className={"message" + (msg.isDeleted ? " deleted" : "")}> 
            {showHeader && (
              <div className="group-header">
                <img
                  className="avatar uno int"
                  src={avatar}
                  alt="avatar"
                  onClick={e => 
                    openUserPopout(e.currentTarget, author, member)}
                />
                <div className="header-meta">
                  <span
                    className="author int"
                    style={{
                      fontFamily: !hover ? `"${member?.nameFont}", "${author.nameFont}", Inter, Avenir, Helvetica, Arial, sans-serif` : undefined,
                      color: roleColor
                    }}
                    onMouseEnter={() => setHover(msg.id + msg.timestamp, true)}
                    onMouseLeave={() => setHover(msg.id + msg.timestamp, false)}
                    onClick={e => 
                      openUserPopout(e.currentTarget, author, member)}
                    data-hover={hover}
                  >
                    {hover && <span className="semitrans">@</span>}
                    {hover ? author.username : name}
                  </span>
                  <span className="timestamp">
                    <span className="mr uno">•</span>
                    {formatMessageTimestamp(msg.timestamp)}
                  </span>
                  {pronouns && <span className="timestamp">
                    <span className="mr ml uno">•</span>
                    {pronouns}
                  </span>}
                </div>
              </div>
            )}
            <div className="content-container">
              {!showHeader && (
                <span className="timestamp uno">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
              <span className={"content" + (msg.sending ? " sending" : "")}>{parseMarkdown(msg.content, {
                serverState,
                channelState,
                memberState,
                userState,
                userSettings,
                onMentionClick: (user: User, member: Member, event: React.MouseEvent) => {
                  event.preventDefault();
                  openUserPopout(event.currentTarget, user, member);
                },
                onChannelClick: (channel: Channel, event: React.MouseEvent) => {
                  if (channelState.currentChannel?.id !== channel.id) {
                    event.preventDefault();
                    if (serverState.currentServer?.id !== channel.serverId) {
                      const server = serverState.get(channel.serverId);
                      if (server) {
                        loadServer(server, channelState, memberState, messageState, token!);
                        serverState.setCurrentServer(server);
                      } else {
                        return;
                      }
                    }
                    channelState.setCurrentChannel(channel);
                  }
                },
                onServerClick: (server: Server, event: React.MouseEvent) => {
                  event.preventDefault();
                  if (serverState.currentServer?.id !== server.id) {
                    loadServer(server, channelState, memberState, messageState, token!);
                    serverState.setCurrentServer(server);
                    channelState.setCurrentChannel(null);
                  }
                },
                onEmojiClick: async (emoji: string, event: React.MouseEvent) => {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const name = await getEmojiDataFromNative(emoji);
                  open({
                    id: "emoji",
                    element: (
                      <EmojiPopout
                        emoji={emoji}
                        emojiName={name.id}
                        userSettings={userSettings}
                        position={{
                          top: rect.bottom + window.scrollY,
                          left: rect.right + window.scrollX
                        }}
                      />
                    ),
                    options: {}
                  });
                }
              })}</span>
            </div>
            {msg.editedTimestamp && <span className="edited-mark"> (edited)</span>}
            {msg.previousContent && msg.previousContent.length > 0 && (
              <div className="edit-history">
                <ul>
                  {msg.previousContent.map((prev, idx) => <span key={idx}>{prev}</span>)}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
