import { useEffect, useMemo, useRef, useState } from "react";
import { useServerState } from "../../lib/state/Servers";
import { useChannelState } from "../../lib/state/Channels";
import { useMessageState } from "../../lib/state/Messages";
import { useUserState } from "../../lib/state/Users";
import { parseMarkdown } from "../../lib/utils/Markdown";
import { getAvatar, getDisplayName, getNameFont, getPronouns, getRoleColor } from "../../lib/utils/UserUtils";
import { Member, User } from "../../lib/utils/types";
import { useMemberState } from "../../lib/state/Members";
import UserPopout from "../layout/popouts/UserPopout";
import { usePopoutState } from "../../lib/state/Popouts";

const MERGE_WINDOW = 7 * 60 * 1000; // 7 minutes in ms

export default function MessageList() {
  const { messages } = useMessageState();
  const serverState = useServerState();
  const channelState = useChannelState();
  const userState = useUserState();
  const memberState = useMemberState();
  const container = useRef<HTMLDivElement>(null);
  const [hoveredMessages, setHoveredMessages] = useState<Record<string, boolean>>({});

  const { open, close } = usePopoutState();

  function setHover(id: string, value: boolean) {
    setHoveredMessages(prev => ({ ...prev, [id]: value }));
  }

  const channelMessages = useMemo(() => {
    let c = channelState.currentChannel;
    if (!c)
      return [];
    return messages
      .filter(m => m.channelId === c.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [channelState, messages]);

  useEffect(() => {
    if (!container.current)
      return;
    container.current.scrollTop = container.current.scrollHeight;
  }, [channelMessages]);

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

  function openUserPopout(target: HTMLElement, user: User, member: Member | undefined) {
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

        const member = serverState.currentServer ? memberState.get(author.id, serverState.currentServer?.id) : undefined;
        if (member && member.nameFont !== "standard galactic alphabet") {
          member.nameFont = "standard galactic alphabet";
          memberState.addMember(member); // send update
        }
        const name = getDisplayName(author, member);
        const avatar = getAvatar(author, member);
        const roleColor = getRoleColor(serverState, author, member, serverState.currentServer === null);
        const pronouns = getPronouns(author, member);
        const font = getNameFont(author, member);

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
                    openUserPopout(e.currentTarget as HTMLElement, author, member)}
                />
                <div className="header-meta">
                  <span
                    className="author int"
                    style={{
                      fontFamily: !hover ? font : undefined,
                      color: roleColor
                    }}
                    onMouseEnter={() => setHover(msg.id + msg.timestamp, true)}
                    onMouseLeave={() => setHover(msg.id + msg.timestamp, false)}
                    onClick={e => 
                      openUserPopout(e.currentTarget as HTMLElement, author, member)}
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
                <span className="timestamp">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
              <span className={"content" + (msg.sending ? " sending" : "")}>{parseMarkdown(msg.content, {
                serverState,
                channelState,
                memberState,
                userState,
                onMentionClick: (user: User, member: Member, event: React.MouseEvent) => 
                  openUserPopout(event.currentTarget as HTMLElement, user, member)
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
