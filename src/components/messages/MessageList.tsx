import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthState } from "../../lib/state/Auth";
import { useServerState } from "../../lib/state/Servers";
import { useChannelState } from "../../lib/state/Channels";
import { useMessageState } from "../../lib/state/Messages";
import { useUserState } from "../../lib/state/Users";
import { usePopoutState } from "../../lib/state/Popouts";
import { useLoadingState } from "../../lib/state/Loading";
import { RenderMarkdown } from "../../lib/utils/MarkdownRenderer";
import {
  getAvatar,
  getPronouns,
  mentionedIn
} from "../../lib/utils/UserUtils";
import { Member, Message, User } from "../../lib/utils/Types";
import {
  deleteMessage,
  editMessage,
  getMessages,
  pinMessage,
  react,
  unreact
} from "../../lib/api/MessageApi";
import { addToQuotebook } from "../../lib/api/SocialApi";
import {
  canManageMessages,
  canPinMessages,
  canEditOthers
} from "../../lib/utils/PermissionUtils";
import UserPopout from "../layout/popouts/UserPopout";
import ContextMenu, { ContextMenuItem } from "../layout/ContextMenu";
import MessageInput, { MessageInputHandle } from "./MessageInput";
import EmojiPickerPopout from "../layout/popouts/EmojiPickerPopout";
import Twemoji from "react-twemoji";
import { EmojiStyle } from "../../lib/utils/UserSettings";
import { SkeletonMessages } from "../layout/Skeleton";
import { t, useLocale } from "../../lib/i18n/Index";
import { Name } from "../layout/Generic";
import { makeMarkdownContext } from "../../lib/utils/Funcs";
import MessageAttachment from "./MessageAttachment";
import { BookmarkIcon, CopyIcon, EditIcon, HashIcon, PinIcon, ReplyIcon, SmileIcon, TrashIcon } from "../svgs/other/Icons";

const MERGE_WINDOW  = 7 * 60 * 1000; // 7 minutes in ms
const SCROLL_THRESHOLD = 120;
const PAGE_SIZE = 50;

function getId(msg: Message): string {
  return msg.id + msg.timestamp + msg.nonce;
}

function AnimatedCount({ count }: { count: number }) {
  const prevRef = useRef(count);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fromCount, setFromCount] = useState(count);
  const [animKey, setAnimKey] = useState<number | null>(null);

  useEffect(() => {
    if (count === prevRef.current)
      return;
    if (timerRef.current)
      clearTimeout(timerRef.current);

    setFromCount(prevRef.current);
    setAnimKey(Date.now());
    prevRef.current = count;

    timerRef.current = setTimeout(() => setAnimKey(null), 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [count]);

  if (animKey === null)
    return <>{count}</>;

  return (
    <span style={{
      position: "relative",
      display: "inline-block",
      overflow: "hidden",
      height: "1.2em",
      verticalAlign: "middle"
    }}>
      <span
        key={`out-${animKey}`}
        style={{ position: "absolute", animation: "rxnSlideOut 280ms ease forwards" }}
      >
        {fromCount}
      </span>
      <span
        key={`in-${animKey}`}
        style={{ position: "absolute", animation: "rxnSlideIn 280ms ease forwards" }}
      >
        {count}
      </span>
      {/* hidden */}
      <span style={{ color: "transparent" }}>{count}</span>
    </span>
  );
}

export default function MessageList() {
  useLocale();

  const { token, user, userSettings } = useAuthState();
  const { currentServer } = useServerState();
  const { currentChannel, getPendingReplies, removePendingReply, addPendingReply, getTyping } = useChannelState();
  const { get, getMember } = useUserState();
  const ms = useMessageState();
  const { messages, getMessage, addMessages, removeMessage, updateMessage } = ms;
  const { messagesLoading } = useLoadingState();
  const { open, close } = usePopoutState();

  const container = useRef<HTMLDivElement>(null);

  const wasAtBottomRef = useRef(true);

  const messageRefs = useRef(new Map<number, HTMLDivElement>());

  const [highlightedMessage, setHighlightedMessage] = useState<number | null>(null);

  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const hasMoreRef = useRef(true);

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isLoadingMoreRef = useRef(false);

  const prevScrollHeightRef = useRef(0);
  const restoringScrollRef = useRef(false);

  const [messageHover, setMessageHover] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    msg: Message;
  } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string | null | undefined>("");

  const inputRef = useRef<MessageInputHandle>(null);
  const spoilerState = useRef<Map<number, boolean>>(new Map());

  const reMember = getMember(user!.id, currentServer?.id);
  const me = currentServer
    ? getMember(user?.id, currentServer.id)
    : undefined;

  const currentChan = currentChannel;
  const canDeleteOthers = canManageMessages(me, currentServer);
  const canPin = canPinMessages(me, currentServer);
  const canEditOther = canEditOthers(me, currentServer);

  const channelMessages = useMemo(() => {
    if (!!!currentChan)
      return [];
    return messages
      .filter((m) => m.channelId === currentChan.id)
      .sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }, [currentChan, messages]);

  const pendingReplyIds = new Set(
    (currentChan ? getPendingReplies(currentChan.id) : []).map(r => r.id)
  );

  useEffect(() => {
    setHasMoreMessages(true);
    hasMoreRef.current = true;
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
    restoringScrollRef.current = false;
    prevScrollHeightRef.current = 0;
  }, [currentChan?.id]);

  const loadMoreMessages = useCallback(async (around?: number, amount?: number) => {
    if (
      isLoadingMoreRef.current ||
      !hasMoreRef.current ||
      !currentChan ||
      !container.current
    )
      return;

    amount ??= 50;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    const oldestMsg = around ? Math.min(channelMessages[0].id, Math.floor(around + amount / 2)) : channelMessages[0].id;
    prevScrollHeightRef.current = container.current.scrollHeight;
    restoringScrollRef.current = true;

    try {
      const msgs = await getMessages(currentChan.id, oldestMsg, amount);

      if (msgs.length === 0 || msgs.length < PAGE_SIZE) {
        setHasMoreMessages(false);
        hasMoreRef.current = false;
      }

      if (msgs.length > 0) {
        addMessages(msgs);
      } else {
        restoringScrollRef.current = false;
        prevScrollHeightRef.current = 0;
      }
    } catch (e) {
      console.warn("Could not load more messages", e);
      restoringScrollRef.current = false;
      prevScrollHeightRef.current = 0;
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [currentChan, channelMessages, token, ms]);

  const handleScroll = useCallback(() => {
    if (!container.current)
      return;
    const el = container.current;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 10;

    if (el.scrollTop <= SCROLL_THRESHOLD && !isLoadingMoreRef.current && hasMoreRef.current)
      loadMoreMessages();
  }, [loadMoreMessages]);

  useEffect(() => {
    const el = container.current;
    if (!el)
      return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!container.current)
      return;

    const el = container.current;

    if (restoringScrollRef.current && prevScrollHeightRef.current > 0) {
      restoringScrollRef.current = false;
      const diff = el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
      if (diff > 0)
        el.scrollTop += diff;
      return;
    }

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
      if (wasAtBottomRef.current)
        el.scrollTop = el.scrollHeight;
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!container.current)
      return;

    if (wasAtBottomRef.current) {
      const el = container.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [editingId]);

  function startEditing(msg: Message, useAnimationFrame = false) {
    setEditingId(msg.id);
    setEditContent(msg.content);
    if (useAnimationFrame)
      requestAnimationFrame(() => inputRef.current?.focus(true, true));
    else
      inputRef.current?.focus(true, true);
  }

  function handleReply(msg: Message) {
    if (!currentChan || msg.sending)
      return;
    if (pendingReplyIds.has(msg.id))
      removePendingReply(currentChan.id, msg.id);
    else
      addPendingReply(currentChan.id, msg);
  }

  function formatTimestamp(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (date.toDateString() === now.toDateString())
      return timeStr;
    if (date.toDateString() === yesterday.toDateString())
      return t("messages.yesterday", { time: timeStr });
    return `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date
      .getDate()
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;
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
          onClose={() => close(id)}
          position={{
            top: rect.bottom + window.scrollY,
            left: rect.right + window.scrollX
          }}
        />
      ),
      options: {}
    });
  }

  async function jumpToMessage(messageId: number) {
    let msg = get(messageId);

    if (!msg) {
      await loadMoreMessages(messageId);
      msg = get(messageId);
    }

    const element = messageRefs.current.get(messageId);
    if (!element || !container.current)
      return;

    const containerRect = container.current.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();

    const fullyVisible =
      elRect.top >= containerRect.top &&
      elRect.bottom <= containerRect.bottom;

    if (!fullyVisible) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    setHighlightedMessage(messageId);

    setTimeout(() => {
      setHighlightedMessage((current) =>
        current === messageId ? null : current
      );
    }, 2000);
  }

  function openCtxMenu(e: React.MouseEvent, msg: Message) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, msg });
  }

  async function handleDelete(msg: Message) {
    try {
      await deleteMessage(msg.channelId, msg.id);
      removeMessage(msg.id);
    } catch (e) {
      console.error(e);
    }
  }

  async function handlePin(msg: Message) {
    try {
      await pinMessage(msg.channelId, msg.id);
      updateMessage({ id: msg.id, isPinned: !msg.isPinned });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSaveEdit(msg: Message) {
    if (!editContent!.trim())
      return;
    try {
      await editMessage(msg.channelId, msg.id, editContent!.trim());
      updateMessage({
        id: msg.id,
        content: editContent!.trim(),
        editedTimestamp: new Date().toISOString(),
        previousContent: [
          ...(msg.previousContent ?? []),
          msg.content
        ]
      });
    } catch (e) {
      console.error(e);
    }
    setEditingId(null);
    setEditContent("");
  }

  async function handleAddToQuotebook(msg: Message) {
    try {
      await addToQuotebook(msg.id, msg.channelId, undefined);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleReact(msg: Message, emoji: string) {
    try {
      await react(
        msg.channelId, msg.id,
        { id: null, name: emoji }
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function handleUnreact(msg: Message, emojiName: string) {
    try {
      await unreact(
        msg.channelId, msg.id,
        { id: null, name: emojiName }
      );
    } catch (e) {
      console.error(e);
    }
  }

  function buildCtxItems(msg: Message): ContextMenuItem[] {
    const isMine = msg.authorId === user?.id;
    const isAlreadyReplying = currentChan
      ? getPendingReplies(currentChan.id).some(r => r.id === msg.id)
      : false;
    const items: ContextMenuItem[] = [];

    items.push({
      label: t("messages.react"),
      icon: <SmileIcon size={14} />,
      onClick: () => {
        const id = `emoji-picker-${msg.id}`;
        open({
          id,
          element: (
            <EmojiPickerPopout
              position={{ top: ctxMenu?.y ?? 0, left: ctxMenu?.x ?? 0 }}
              onSelect={(emoji, e) => { handleReact(msg, emoji); if (!e.shiftKey) close(id); }}
            />
          ),
          options: {}
        });
      },
    });

    items.push({
      label: isAlreadyReplying ? t("messages.reply.cancel") : t("messages.reply"),
      icon: <ReplyIcon size={14} />,
      onClick: () => handleReply(msg)
    });

    if (isMine) {
      items.push({
        label: t("messages.edit"),
        icon: <EditIcon size={14} />,
        onClick: () => startEditing(msg, true)
      });
    }

    if (canPin) {
      items.push({
        label: t(msg.isPinned ? "messages.unpin" : "messages.pin"),
        icon: <PinIcon size={14} />,
        onClick: () => handlePin(msg)
      });
    }

    items.push({
      label: t("messages.quotebook"),
      icon: <BookmarkIcon size={14} />,
      onClick: () => handleAddToQuotebook(msg)
    });

    items.push({
      label: t("messages.copy"),
      icon: <CopyIcon size={14} />,
      onClick: () => navigator.clipboard.writeText(msg.content)
    });

    if (userSettings?.developerMode) {
      items.push({
        label: t("messages.copy_id"),
        icon: <HashIcon size={14} />,
        onClick: () => navigator.clipboard.writeText(String(msg.id))
      });
    }

    if (isMine || canDeleteOthers || canEditOther) {
      items.push({ label: "", onClick: () => {}, divider: true });
      items.push({
        label: t("messages.delete"),
        icon: <TrashIcon size={14} />,
        danger: true,
        onClick: () => handleDelete(msg)
      });
    }

    return items;
  }

  const markdownData = makeMarkdownContext(
    open, openUserPopout,
    () => {
      if (!container.current)
        return;

      if (wasAtBottomRef.current) {
        const el = container.current;
        el.scrollTop = el.scrollHeight;
      }
    }
  );

  const typingIds = (
    (currentChan && getTyping(currentChan.id)) ?? []
  ).filter(id => id !== user?.id);

  const compact = !!userSettings?.compactMode;

  return (<>
    <div
      className={
        "message-list ovy-auto" +
        (typingIds.length > 0 ? " typing" : "") +
        (compact ? " compact-messages" : "")
      }
      ref={container}
    >
      {messagesLoading && channelMessages.length === 0 ? <SkeletonMessages count={8} compact={compact} /> : (<>
        {isLoadingMore && (
          <div style={{ padding: "4px 0 8px" }}>
            <SkeletonMessages count={3} compact={compact} />
          </div>
        )}

        {!hasMoreMessages && channelMessages.length > 0 && (
          <div
            style={{
              padding: "20px 16px 8px",
              textAlign: "center",
              color: "var(--text-5)",
              fontSize: 12,
              userSelect: "none"
            }}
          >
            {t("messages.beginning", { name: currentChan?.name ?? t("messages.unknown_channel") })}
          </div>
        )}

        {channelMessages.map((msg, i) => {
          const author = get(msg.authorId) ?? ({
            id: msg.authorId,
            displayName: null,
            username: t("user.unknown"),
            avatar: null,
            nameFont: null
          } as User);
          const member = getMember(author.id, currentServer?.id);
          const avatar = getAvatar(author, member);
          const pronouns = getPronouns(author, member);
          const isMentioned = mentionedIn(msg, user!, reMember);
          const isPendingReply = pendingReplyIds.has(msg.id);

          let showHeader = !compact;
          const prev = channelMessages[i - 1];
          if (prev && prev.authorId === msg.authorId && (msg.references?.length || 0) <= 0 &&
              new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime() <= MERGE_WINDOW)
            showHeader = false;

          const isHovered = messageHover === getId(msg) || ctxMenu?.msg.id === msg.id;
          const isEditing = editingId === msg.id;

          return (
            <div
              key={getId(msg)}
              ref={(el) => {
                if (el)
                  messageRefs.current.set(msg.id, el);
                else
                  messageRefs.current.delete(msg.id);
              }}
              className={
                "message" +
                (isMentioned ? " mentioned" : "") +
                (isHovered ? " hover" : "") +
                (isPendingReply ? " pending-reply" : "") +
                (highlightedMessage === msg.id ? " flash-highlight" : "")
              }
              onMouseEnter={() => setMessageHover(getId(msg))}
              onMouseLeave={() => setMessageHover(null)}
              onContextMenu={e => openCtxMenu(e, msg)}
              onDoubleClick={() => {
                const canEdit = !!!msg.sending && (msg.authorId === user?.id || canEditOther);
                if (canEdit) {
                  if (editingId !== msg.id)
                    startEditing(msg, true);
                  return;
                }
                
                handleReply(msg);
              }}
            >
              {!!msg.references?.length && (
                <div className="replies">
                  {msg.references.map((r, i) => {
                    const reply = getMessage(r);
                    const repAuthor = (reply && get(reply.authorId)) ?? ({
                      id: reply?.authorId,
                      displayName: null,
                      username: t("user.unknown"),
                      avatar: null,
                      nameFont: null
                    } as User);
                    const repMember = getMember(repAuthor.id, currentServer?.id);
                    const repAvatar = getAvatar(repAuthor, repMember);

                    return (
                      <div className="reply">
                        <div className={"reply-bar" + (i === 0 ? " first" : "")} />
                        <img
                          className="avatar uno int"
                          src={repAvatar}
                          alt={t("alt.avatar")}
                          onClick={e => openUserPopout(e.currentTarget, repAuthor, repMember)}
                          onDoubleClick={e => e.stopPropagation()}
                        />
                        <Name
                          user={repAuthor}
                          member={repMember}
                          md={markdownData}
                          spoilerState={spoilerState}
                          className="author int"
                          onClick={e => openUserPopout(e.currentTarget, repAuthor, repMember)}
                          onDoubleClick={e => e.stopPropagation()}
                        />
                        <div
                          className="reply-content"
                          onClick={() => jumpToMessage(r)}
                        >
                          {RenderMarkdown({
                            // TODO: figure out way to determine if message is genuinely deleted or just not in message cache
                            content: reply ? reply.content ?? t("message.unknown") : t("message.deleted"),
                            spoilerStateRef: spoilerState,
                            noBigEmoji: true,
                            forceInline: true,
                            maxLength: 64
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {showHeader && (
                <div className="group-header">
                  <img
                    className="avatar uno int"
                    src={avatar}
                    alt={t("alt.avatar")}
                    onClick={e => openUserPopout(e.currentTarget, author, member)}
                    onDoubleClick={e => e.stopPropagation()}
                  />
                  <div className="header-meta">
                    <Name
                      user={author}
                      member={member}
                      md={markdownData}
                      spoilerState={spoilerState}
                      className="author int"
                      onClick={e => openUserPopout(e.currentTarget, author, member)}
                      onDoubleClick={e => e.stopPropagation()}
                    />
                    <span className="timestamp" onDoubleClick={e => e.stopPropagation()}>
                      <span className="mr uno">•</span>
                      {formatTimestamp(msg.timestamp)}
                    </span>
                    {pronouns && (
                      <span className="timestamp" onDoubleClick={e => e.stopPropagation()}>
                        <span className="mr ml uno">•</span>
                        {pronouns}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="content-container">
                {!showHeader && (
                  <span className={compact ? "compact-ts uno" : "timestamp uno"}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </span>
                )}

                {compact && (
                  <Name
                    user={author}
                    member={member}
                    md={markdownData}
                    spoilerState={spoilerState}
                    className="author int"
                    onClick={e => openUserPopout(e.currentTarget, author, member)}
                  />
                )}

                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    <div
                      style={{
                        background: "var(--bg-1)",
                        color: "var(--text-3)",
                        border: "1px solid var(--accent-1)",
                        borderRadius: 6,
                        padding: "8px",
                        fontFamily: "inherit",
                        fontSize: 14,
                        resize: "none",
                        lineHeight: 1.4
                      }}
                    >
                      <MessageInput
                        isChannel={false}
                        placeholderText=""
                        initialText={editContent}
                        setText={setEditContent}
                        onEnter={() => handleSaveEdit(msg)}
                        onKey={e => {
                          if (e.key === "Escape") {
                            setEditingId(null);
                            setEditContent("");
                            return true;
                          }
                          return false;
                        }}
                        ref={inputRef}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-4)" }}>
                      <span>{t("messages.edit_text")}</span>
                      <button
                        onClick={() => handleSaveEdit(msg)}
                        style={{
                          padding: "2px 10px",
                          background: "var(--accent-3)",
                          color: "var(--text-0)",
                          border: "none",
                          borderRadius: 4
                        }}
                      >
                        {t("save")}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditContent(""); }}
                        style={{ padding: "2px 10px" }}
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  msg.content && (
                    <span className={"content" + (msg.sending ? " sending" : "")}>
                      {RenderMarkdown({
                        content: msg.content,
                        spoilerStateRef: spoilerState,
                        ...markdownData
                      })}
                      {msg.editedTimestamp && (
                        <span className="edited-mark uno">{t("messages.edited")}</span>
                      )}
                    </span>
                  )
                )}

                {msg.attachments?.map(a => (
                  <MessageAttachment key={a.fileName} attachment={a} sending={msg.sending} />
                ))}
                
                {msg.reactions && msg.reactions.length > 0 && (
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}
                    onDoubleClick={e => e.stopPropagation()}
                  >
                    {msg.reactions.map((reaction, ri) => {
                      const hasReacted = reaction.reactors.includes(user?.id ?? -1);
                      return (
                        <button
                          key={ri}
                          onClick={() => {
                            if (hasReacted)
                              handleUnreact(msg, reaction.emoji?.name ?? "");
                            else
                              react(
                                msg.channelId, msg.id,
                                reaction.emoji!
                              );
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 6px",
                            borderRadius: 8,
                            background: hasReacted
                              ? "color-mix(in hsl, var(--accent-2), transparent 70%)"
                              : "var(--bg-2)",
                            border: hasReacted
                              ? "1.8px solid color-mix(in hsl, var(--accent-1), transparent 30%)"
                              : "1.8px solid var(--border)",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            color: hasReacted
                              ? "var(--accent-reaction)"
                              : "var(--text-4)",
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
                              noWrapper
                            >
                              <span>{reaction?.emoji.name}</span>
                            </Twemoji>
                          )}
                          <span
                            style={{
                              color: hasReacted
                                ? "var(--accent-reaction)"
                                : "var(--text-4)"
                            }}
                          >
                            <AnimatedCount count={reaction.reactors.length} />
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
                              position={{ top: rect.bottom, left: rect.left + 32 }}
                              onSelect={emoji => { handleReact(msg, emoji); if (!e.shiftKey) close(id); }}
                            />
                          ),
                          options: {}
                        });
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 6px",
                        borderRadius: 10,
                        background: "var(--bg-2)",
                        border: "1px solid var(--border)",
                        fontSize: 16,
                        cursor: "pointer",
                        color: "var(--text-3)",
                        boxShadow: "none"
                      }}
                    >
                      <SmileIcon size={18} />
                    </button>
                  </div>
                )}
              </div>

              {isHovered && !isEditing && !!!msg.sending && (
                <div className="message-actions">
                  <button
                    title={t("messages.react")}
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const id = `emoji-picker-${msg.id}`;
                      open({
                        id,
                        element: (
                          <EmojiPickerPopout
                            position={{ top: rect.bottom, left: rect.left + 32 }}
                            onSelect={emoji => { handleReact(msg, emoji); if (!e.shiftKey) close(id); }}
                          />
                        ),
                        options: {}
                      });
                    }}
                  >
                    <SmileIcon size={14} />
                  </button>
                  <button
                    title={isPendingReply ? t("messages.reply.cancel") : t("messages.reply")}
                    onClick={() => handleReply(msg)}
                    style={{ color: isPendingReply ? "var(--accent-1)" : undefined }}
                  >
                    <ReplyIcon size={14} />
                  </button>
                  {msg.authorId === user?.id && (
                    <button title={t("edit")} onClick={() => startEditing(msg, true)}>
                      <EditIcon size={14} />
                    </button>
                  )}
                  {(msg.authorId === user?.id || canDeleteOthers) && (
                    <button title={t("delete")} onClick={() => handleDelete(msg)}>
                      <TrashIcon size={14} />
                    </button>
                  )}
                  <button
                    title={t("more")}
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
      </>)}
    </div>

    {ctxMenu && (
      <ContextMenu
        items={buildCtxItems(ctxMenu.msg)}
        position={{ x: ctxMenu.x, y: ctxMenu.y }}
        onClose={() => setCtxMenu(null)}
      />
    )}
  </>);
}