import { useEffect, useMemo, useRef, useState } from "react";
import { useServerState } from "../../lib/state/Servers";
import { useChannelState } from "../../lib/state/Channels";
import { useMessageState } from "../../lib/state/Messages";
import { useUserState } from "../../lib/state/Users";
import { parseMarkdown } from "../../lib/utils/Markdown";
import { getAvatar, getDisplayName, getPronouns, getRoleColor, mentionedIn } from "../../lib/utils/UserUtils";
import { Channel, Member, Message, Server, User } from "../../lib/utils/types";
import { usePopoutState } from "../../lib/state/Popouts";
import { useAuthState } from "../../lib/state/Auth";
import { loadServer } from "../../lib/api/serverApi";
import { deleteMessage, editMessage, pinMessage, react, unreact } from "../../lib/api/messageApi";
import { addToQuotebook } from "../../lib/api/socialApi";
import { canManageMessages, canPinMessages, canEditOthers } from "../../lib/utils/PermissionUtils";
import UserPopout from "../layout/popouts/UserPopout";
import EmojiPopout from "../layout/popouts/EmojiPopout";
import ContextMenu, { ContextMenuItem } from "../layout/ContextMenu";
import { getEmojiDataFromNative } from "emoji-mart";
import MessageInput, { MessageInputHandle } from "./MessageInput";
import EmojiPickerPopout from "../layout/popouts/EmojiPickerPopout";
import Twemoji from "react-twemoji";
import { EmojiStyle } from "../../lib/utils/userSettings";

const MERGE_WINDOW = 7 * 60 * 1000; // 7 minutes in ms

export default function MessageList() {
  const { token, user, userSettings } = useAuthState();
  const serverState = useServerState();
  const channelState = useChannelState();
  const userState = useUserState();
  const messageState = useMessageState();
  const container = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const { open, close } = usePopoutState();

  const [messageHover, setMessageHover] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; msg: Message } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string | null | undefined>("");

  const inputRef = useRef<MessageInputHandle>(null);

  const reMember = userState.getMember(user!.id, serverState.currentServer?.id);
  const me = serverState.currentServer
    ? userState.getMember(user?.id, serverState.currentServer.id)
    : undefined;

  const currentChan = channelState.currentChannel;
  const canDeleteOthers = canManageMessages(me, serverState.currentServer);
  const canPin = canPinMessages(me, serverState.currentServer);
  const canEditOther = canEditOthers(me, serverState.currentServer);

  const channelMessages = useMemo(() => {
    if (!currentChan)
      return [];
    return messageState.messages
      .filter(m => m.channelId === currentChan.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [currentChan, messageState.messages]);

  const handleScroll = () => {
    if (!container.current)
      return;
    const el = container.current;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 10;
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
    const last = channelMessages[channelMessages.length - 1];
    if ((last && last.authorId === user?.id) || wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      wasAtBottomRef.current = true;
    }
  }, [channelMessages]);

  useEffect(() => {
    if (!container.current)
      return;
    const el = container.current;
    const obs = new ResizeObserver(() => {
      if (wasAtBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!container.current)
      return;

    if (editingId !== null && wasAtBottomRef.current) {
      const el = container.current;
      el.scrollTop = el.scrollHeight;
      wasAtBottomRef.current = true;
    }
  }, [editingId]);

  function formatTimestamp(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const sameDay = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const t = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) return t;
    if (isYesterday) return `Yesterday at ${t}`;
    return `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}/${date.getFullYear()}`;
  }

  function openUserPopout(target: Element, u: User, m: Member | undefined) {
    const rect = target.getBoundingClientRect();
    const id = `user-profile-${u.id}`;
    open({
      id,
      element: (
        <UserPopout
          user={u}
          member={m}
          serverState={serverState}
          channelState={channelState}
          messageState={messageState}
          userState={userState}
          userSettings={userSettings}
          currentUser={user}
          open={open}
          close={close}
          onClose={() => close(id)}
          token={token}
          position={{
            top: rect.bottom + window.scrollY,
            left: rect.right + window.scrollX
          }}
        />
      ),
      options: {},
    });
  }

  function openCtxMenu(e: React.MouseEvent, msg: Message) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, msg });
  }

  async function handleDelete(msg: Message) {
    try {
      await deleteMessage(msg.channelId, msg.id, { headers: { Authorization: `Bearer ${token}` } });
      messageState.removeMessage(msg.id);
    } catch (e) { console.error(e); }
  }

  async function handlePin(msg: Message) {
    try {
      await pinMessage(msg.channelId, msg.id, { headers: { Authorization: `Bearer ${token}` } });
      messageState.updateMessage({ id: msg.id, isPinned: !msg.isPinned });
    } catch (e) { console.error(e); }
  }

  async function handleSaveEdit(msg: Message) {
    if (!editContent!.trim()) return;
    try {
      await editMessage(msg.channelId, msg.id, editContent!.trim(), { headers: { Authorization: `Bearer ${token}` } });
      messageState.updateMessage({
        id: msg.id,
        content: editContent!.trim(),
        editedTimestamp: new Date().toISOString(),
        previousContent: [...(msg.previousContent ?? []), msg.content],
      });
    } catch (e) { console.error(e); }
    setEditingId(null);
    setEditContent("");
  }

  async function handleAddToQuotebook(msg: Message) {
    try {
      await addToQuotebook(msg.id, msg.channelId, undefined, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) { console.error(e); }
  }

  async function handleReact(msg: Message, emoji: string) {
    try {
      await react(msg.channelId, msg.id, { id: null, name: emoji }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) { console.error(e); }
  }

  async function handleUnreact(msg: Message, emojiName: string) {
    try {
      await unreact(msg.channelId, msg.id, { id: null, name: emojiName }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) { console.error(e); }
  }

  function buildCtxItems(msg: Message): ContextMenuItem[] {
    const isMine = msg.authorId === user?.id;
    const items: ContextMenuItem[] = [];

    items.push({
      label: "Add Reaction",
      icon: "😊",
      onClick: () => {
        const id = `emoji-picker-${msg.id}`;
        open({
          id,
          element: (
            <EmojiPickerPopout
              position={{
                top: ctxMenu?.y ?? 0,
                left: ctxMenu?.x ?? 0
              }}
              onSelect={(emoji) => {
                handleReact(msg, emoji);
                close(id);
              }}
            />
          ),
          options: {},
        });
      }
    });

    if (isMine) {
      items.push({
        label: "Edit Message",
        icon: "✏️",
        onClick: () => { setEditingId(msg.id); setEditContent(msg.content); inputRef.current?.focus(); }
      });
    }

    if (canPin) {
      items.push({
        label: msg.isPinned ? "Unpin Message" : "Pin Message",
        icon: "📌",
        onClick: () => handlePin(msg)
      });
    }

    items.push({
      label: "Save to Quotebook",
      icon: "📖",
      onClick: () => handleAddToQuotebook(msg)
    });

    items.push({
      label: "Copy Message ID",
      icon: "🆔",
      onClick: () => navigator.clipboard.writeText(String(msg.id))
    });

    items.push({
      label: "Copy Text",
      icon: "📋",
      onClick: () => navigator.clipboard.writeText(msg.content)
    });

    if (isMine || canDeleteOthers || canEditOther) {
      items.push({ label: "", onClick: () => {}, divider: true });
      items.push({
        label: "Delete Message",
        icon: "🗑️",
        danger: true,
        onClick: () => handleDelete(msg)
      });
    }

    return items;
  }

  const markdownData = {
    serverState,
    channelState,
    userState,
    userSettings,
    onMentionClick: (u: User, m: Member, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      openUserPopout(event.currentTarget, u, m);
    },
    onChannelClick: (channel: Channel, event: React.MouseEvent) => {
      event.stopPropagation();
      if (channelState.currentChannel?.id !== channel.id) {
        event.preventDefault();
        if (serverState.currentServer?.id !== (channel as any).serverId) {
          const s = serverState.get((channel as any).serverId);
          if (s) {
            loadServer(s, channelState, userState, messageState, token!);
            serverState.setCurrentServer(s);
          } else return;
        }
        channelState.setCurrentChannel(channel);
      }
    },
    onServerClick: (server: Server, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      if (serverState.currentServer?.id !== server.id) {
        loadServer(server, channelState, userState, messageState, token!);
        serverState.setCurrentServer(server);
        channelState.setCurrentChannel(null);
      }
    },
    onEmojiClick: async (emoji: string, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const name = await getEmojiDataFromNative(emoji);
      open({
        id: "emoji",
        element: (
          <EmojiPopout
            emoji={emoji}
            emojiName={name?.id ?? emoji}
            userSettings={userSettings}
            position={{ top: rect.bottom + window.scrollY, left: rect.right + window.scrollX }}
          />
        ),
        options: {}
      });
    },
  };

  const typingIds = ((currentChan && channelState.getTyping(currentChan.id)) ?? []).filter(id => id !== user?.id);
  return (
    <>
      <div className={"message-list ovy-auto" + (typingIds.length > 0 ? " typing" : "")} ref={container}>
        {channelMessages.map((msg, i) => {
          const author = userState.get(msg.authorId) ?? {
            id: msg.authorId, displayName: null, username: "Unknown User",
            avatar: null, nameFont: null,
          } as User;
          const member = userState.getMember(author.id, serverState.currentServer?.id);
          const name = getDisplayName(author, member);
          const avatar = getAvatar(author, member);
          const roleColor = getRoleColor(serverState, author, member, serverState.currentServer === null);
          const pronouns = getPronouns(author, member);
          const isMentioned = mentionedIn(msg, user!, reMember);

          let showHeader = true;
          const prev = channelMessages[i - 1];
          if (prev && prev.authorId === msg.authorId)
            if (new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime() <= MERGE_WINDOW)
              showHeader = false;

          const isHovered = messageHover === String(msg.id) || ctxMenu?.msg.id === msg.id;
          const isEditing = editingId === msg.id;

          return (
            <div
              key={msg.id + msg.timestamp}
              className={"message" + (isMentioned ? " mentioned" : "") + (isHovered ? " hover" : "")}
              onMouseEnter={() => setMessageHover(String(msg.id))}
              onMouseLeave={() => setMessageHover(null)}
              onContextMenu={e => openCtxMenu(e, msg)}
              onDoubleClick={() => {
                const canEdit =
                  msg.authorId === user?.id ||
                  canEditOther;

                if (!canEdit || editingId === msg.id)
                  return;

                setEditingId(msg.id);
                setEditContent(msg.content);
                requestAnimationFrame(() => inputRef.current?.focus(true));
              }}
            >
              {showHeader && (
                <div className="group-header">
                  <img
                    className="avatar uno int"
                    src={avatar}
                    alt="avatar"
                    onClick={e => openUserPopout(e.currentTarget, author, member)}
                  />
                  <div className="header-meta">
                    <span
                      className="author int"
                      style={{
                        fontFamily: `"${member?.nameFont ?? ""}", "${author.nameFont ?? ""}", Inter, sans-serif`,
                        color: roleColor,
                      }}
                      onClick={e => openUserPopout(e.currentTarget, author, member)}
                    >
                      {parseMarkdown(name, markdownData)}
                    </span>
                    <span className="timestamp">
                      <span className="mr uno">•</span>
                      {formatTimestamp(msg.timestamp)}
                    </span>
                    {pronouns && (
                      <span className="timestamp">
                        <span className="mr ml uno">•</span>
                        {pronouns}
                      </span>
                    )}
                    {msg.isPinned && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: "var(--accent-1)" }}>📌</span>
                    )}
                  </div>
                </div>
              )}

              <div className="content-container">
                {!showHeader && (
                  <span className="timestamp uno">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}

                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    <div
                      style={{
                        background: "var(--bg-1)", color: "var(--text-3)",
                        border: "1px solid var(--accent-1)", borderRadius: 6,
                        padding: "8px", fontFamily: "inherit", fontSize: 14,
                        resize: "none", lineHeight: 1.4,
                      }}
                    >
                      <MessageInput
                        isChannel={false}
                        placeholderText=""
                        initialText={editContent}
                        setText={setEditContent}
                        onEnter={() => handleSaveEdit(msg)}
                        onKey={(e) => { if (e.key === "Escape") { setEditingId(null); setEditContent(""); return true; } return false; }}
                        ref={inputRef}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-4)" }}>
                      <span>ESC to cancel • Enter to save</span>
                      <button
                        onClick={() => handleSaveEdit(msg)}
                        style={{ padding: "2px 10px", background: "var(--accent-3)", color: "var(--text-0)", border: "none", borderRadius: 4 }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditContent(""); }}
                        style={{ padding: "2px 10px" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <span className={"content" + (msg.sending ? " sending" : "")}>
                    {parseMarkdown(msg.content, markdownData)}
                  </span>
                )}

                {msg.editedTimestamp && !isEditing && (
                  <span className="edited-mark">(edited)</span>
                )}

                {msg.reactions && msg.reactions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }} onDoubleClick={e => e.stopPropagation()}>
                    {msg.reactions.map((reaction, ri) => {
                      const hasReacted = reaction.reactors.includes(user?.id ?? -1);
                      return (
                        <button
                          key={ri}
                          onClick={() => {
                            if (hasReacted)
                              handleUnreact(msg, reaction.emoji?.name ?? "");
                            else
                              react(msg.channelId, msg.id, reaction.emoji!, { headers: { Authorization: `Bearer ${token}` } });
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "3px 6px", borderRadius: 8,
                            background: hasReacted ? "color-mix(in hsl, var(--accent-2), transparent 70%)" : "var(--bg-2)",
                            border: hasReacted ? "1.8px solid color-mix(in hsl, var(--accent-1), transparent 30%)" : "1.8px solid var(--border)",
                            fontSize: 14, fontWeight: 600, cursor: "pointer", color: hasReacted ? "var(--accent-reaction)" : "var(--text-4)",
                            boxShadow: "none"
                          }}
                        >
                          {userSettings?.emojiStyle === EmojiStyle.System ? (
                            <span className="emoji-reaction-system">
                              {reaction?.emoji.name}
                            </span>
                          ) : (
                            <Twemoji
                              options={{
                                className: "emoji-reaction",
                                folder: "svg",
                                ext: ".svg"
                              }}
                              noWrapper={true}
                            >
                              <span>
                                {reaction?.emoji.name}
                              </span>
                            </Twemoji>
                          )}
                          <span style={{ color: hasReacted ? "var(--accent-reaction)" : "var(--text-4)" }}>
                            {reaction.reactors.length}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const id = `emoji-picker-${msg.id}`;
                        open({
                          id,
                          element: (
                            <EmojiPickerPopout
                              position={{
                                top: rect.bottom,
                                left: rect.left + 32
                              }}
                              onSelect={(emoji) => {
                                handleReact(msg, emoji);
                                close(id);
                              }}
                            />
                          ),
                          options: {}
                        });
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "2px 6px", borderRadius: 10,
                        background: "var(--bg-2)",
                        border: "1px solid var(--border)",
                        fontSize: 16, cursor: "pointer", color: "var(--text-3)",
                        boxShadow: "none"
                      }}
                    >
                      <svg width={18} height={18}>

                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {isHovered && !isEditing && (
                <div className="message-actions">
                  <button
                    title="React"
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const id = `emoji-picker-${msg.id}`;
                      open({
                        id,
                        element: (
                          <EmojiPickerPopout
                            position={{
                              top: rect.bottom,
                              left: rect.left + 32
                            }}
                            onSelect={(emoji) => {
                              handleReact(msg, emoji);
                              close(id);
                            }}
                          />
                        ),
                        options: {}
                      });
                    }}
                  >
                    😊
                  </button>
                  {msg.authorId === user?.id && (
                    <button
                      title="Edit"
                      onClick={() => { setEditingId(msg.id); setEditContent(msg.content); requestAnimationFrame(() => inputRef.current?.focus(true)); }}
                    >
                      ✏️
                    </button>
                  )}
                  {(msg.authorId === user?.id || canDeleteOthers) && (
                    <button
                      title="Delete"
                      onClick={() => handleDelete(msg)}
                    >
                      🗑️
                    </button>
                  )}
                  <button
                    title="More"
                    onContextMenu={e => { e.preventDefault(); openCtxMenu(e, msg); }}
                    onClick={e => openCtxMenu(e, msg)}
                  >
                    ⋯
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {ctxMenu && (
        <ContextMenu
          items={buildCtxItems(ctxMenu.msg)}
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
}