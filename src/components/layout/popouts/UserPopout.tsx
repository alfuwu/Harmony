import { useLayoutEffect, useRef, useState, useEffect, useCallback } from "react";
import { Channel, Member, OnlineStatus, Review, Server, User } from "../../../lib/utils/types";
import {
  getAvatar,
  getBanner,
  getBio,
  getDisplayName,
  getPronouns,
  getRoleColor,
} from "../../../lib/utils/UserUtils";
import { ServerState } from "../../../lib/state/Servers";
import { ChannelState } from "../../../lib/state/Channels";
import { UserState } from "../../../lib/state/Users";
import { UserSettings } from "../../../lib/utils/userSettings";
import { Popout } from "../../../lib/state/Popouts";
import { loadServer } from "../../../lib/api/serverApi";
import { MessageState } from "../../../lib/state/Messages";
import EmojiPopout from "./EmojiPopout";
import { getEmojiDataFromNative } from "emoji-mart";
import { parseMarkdown } from "../../../lib/utils/Markdown";
import {
  getUserBadges,
  Badge,
  BadgeLabels,
  BadgeIcons,
} from "../../../lib/api/socialApi";
import { deleteReview, getReviews, submitReview, updateReview } from "../../../lib/api/userApi";
import MessageInput, { MessageInputHandle } from "../../messages/MessageInput";
import { AuthState } from "../../../lib/state/Auth";

interface UserPopoutProps {
  user: User;
  member?: Member;
  serverState: ServerState;
  channelState: ChannelState;
  messageState: MessageState;
  userState: UserState;
  userSettings: UserSettings | null;
  currentUser: User | null;
  open: (popout: Popout) => void;
  close: (id: string) => void;
  onClose: () => void;
  token: string | null;
  position: { top: number; left?: number; right?: number };
}

const reviewsCache = new Map<number, Review[]>();

const STATUS_META: Record<OnlineStatus, { label: string; color: string; dot: string }> = {
  [OnlineStatus.Online]:   { label: "Online",         color: "var(--online)",  dot: "●" },
  [OnlineStatus.Idle]:     { label: "Idle",           color: "var(--idle)",    dot: "◐" },
  [OnlineStatus.Focusing]: { label: "Focusing",       color: "var(--blue-2)",  dot: "◎" },
  [OnlineStatus.DND]:      { label: "Do Not Disturb", color: "var(--dnd)",     dot: "⊖" },
  [OnlineStatus.Offline]:  { label: "Offline",        color: "var(--offline)", dot: "○" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function intToHex(n: number) {
  return `#${(n >>> 0).toString(16).padStart(6, "0")}`;
}

function xpProgress(totalXp: number, level: number): [number, number, number] {
  let spent = 0;
  for (let i = 1; i <= level; i++) spent += Math.round(100 * Math.pow(i, 1.5));
  const inLevel = Math.max(0, totalXp - spent);
  const needed  = Math.max(1, Math.round(100 * Math.pow(level + 1, 1.5)));
  return [inLevel, needed, Math.min(1, inLevel / needed)];
}

function StatusDot({ status, size = 12 }: { status?: OnlineStatus; size?: number }) {
  const s = status ?? OnlineStatus.Offline;
  const { color, dot } = STATUS_META[s];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--bg-3)",
        color,
        fontSize: size * 0.85,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {dot}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text-5)",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />;
}

function XpBar({ label, level, totalXp, accentVar = "var(--accent-1)" }: {
  label?: string;
  level: number;
  totalXp: number;
  accentVar?: string;
}) {
  const [, needed, frac] = xpProgress(totalXp, level);
  const [xpInLevel] = xpProgress(totalXp, level);
  return (
    <div>
      {label && <SectionLabel>{label}</SectionLabel>}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: accentVar,
          background: `color-mix(in hsl, ${accentVar}, transparent 82%)`,
          border: `1px solid color-mix(in hsl, ${accentVar}, transparent 55%)`,
          borderRadius: 5,
          padding: "1px 7px",
          flexShrink: 0,
        }}>
          Lvl {level}
        </span>
        <div style={{
          flex: 1,
          height: 5,
          background: "var(--bg-1)",
          borderRadius: 99,
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}>
          <div style={{
            width: `${frac * 100}%`,
            height: "100%",
            background: accentVar,
            borderRadius: 99,
            transition: "width 400ms ease",
          }} />
        </div>
        <span style={{ fontSize: 10, color: "var(--text-5)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
          {xpInLevel}/{needed}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-5)" }}>
        {totalXp.toLocaleString()} XP total
      </div>
    </div>
  );
}

interface ReviewsModalProps {
  user: User;
  currentUser: User | null;
  serverState: ServerState;
  channelState: ChannelState;
  messageState: MessageState;
  userState: UserState;
  authState: { token: string | null, userSettings: UserSettings | null, user: User | null };
  markdownData: {};
  opts: RequestInit;
  onClose: () => void;
}

function ReviewsModal({
  user,
  currentUser,
  serverState,
  channelState,
  messageState,
  userState,
  authState,
  markdownData,
  opts,
  onClose
}: ReviewsModalProps) {
  const [reviews, setReviews] = useState<Review[]>(reviewsCache.get(user.id) ?? []);
  const [loading, setLoading] = useState(!reviewsCache.has(user.id));
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null | undefined>("");
  const [submitting, setSubmitting] = useState(false);
  const { getUser } = userState;
  
  const inputRef = useRef<MessageInputHandle>(null);
  const myReview = reviews.find(r => r.authorId === currentUser?.id);

  useEffect(() => {
    if (myReview)
      setDraft(myReview.content);
  }, [myReview?.content]);

  useEffect(() => {
    if (reviewsCache.has(user.id))
      return;
    let cancelled = false;
    setLoading(true);
    getReviews(user, opts)
      .then(data => {
        if (cancelled)
          return;
        reviewsCache.set(user.id, data);
        setReviews(data);
      })
      .catch(() => {
        if (!cancelled)
          setError("Failed to load reviews.");
        })
      .finally(() => {
        if (!cancelled)
          setLoading(false);
        });
    return () => { cancelled = true; };
  }, [user.id]);

  const handleSubmit = useCallback(async () => {
    if (!draft || !draft.trim() || submitting)
      return;
    setSubmitting(true);
    setError(null);
    try {
      if (myReview)
        await updateReview(user, draft.trim(), opts);
      else
        await submitReview(user, draft.trim(), opts);
      reviewsCache.delete(user.id);
      const fresh = await getReviews(user, opts);
      reviewsCache.set(user.id, fresh);
      setReviews(fresh);
      setDraft("");
      inputRef.current?.setText("");
    } catch {
      setError("Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  }, [draft, myReview, submitting, user]);

  const handleDelete = useCallback(async () => {
    if (submitting)
      return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteReview(user, opts);
      reviewsCache.delete(user.id);
      const fresh = await getReviews(user, opts);
      reviewsCache.set(user.id, fresh);
      setReviews(fresh);
      setDraft("");
    } catch {
      setError("Failed to delete review.");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, user]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          zIndex: 1101,
          width: 400,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "80vh",
          borderRadius: 14,
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          animation: "popout-in 160ms cubic-bezier(0.2,0,0,1.4) both",
          overflow: "hidden",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-2)" }}>Reviews</div>
            <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 1 }}>
              {getDisplayName(user)} · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 24, height: 24, padding: 0, borderRadius: 5, border: "none",
              background: "rgba(255,255,255,0.07)", color: "var(--text-4)",
              fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >✕</button>
        </div>

        <div
          className="ovy-auto"
          style={{ flex: 1, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}
        >
          {loading && (
            <div style={{ color: "var(--text-5)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              Loading reviews...
            </div>
          )}
          {!loading && reviews.length === 0 && (
            <div style={{ color: "var(--text-5)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              No reviews yet. Be the first!
            </div>
          )}
          {reviews.map(review => {
            const isMine = review.authorId === currentUser?.id;
            const rUser = getUser(review.authorId) ?? null;
            const name = getDisplayName(rUser);
            return (
              <div
                key={review.authorId ?? review.content}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  background: isMine
                    ? "color-mix(in hsl, var(--accent-2), transparent 82%)"
                    : "color-mix(in hsl, var(--bg-4), transparent 40%)",
                  border: isMine
                    ? "1px solid color-mix(in hsl, var(--accent-2), transparent 55%)"
                    : "1px solid var(--border-light)",
                }}
              >
                <img
                  src={getAvatar(rUser)}
                  alt={name}
                  style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginTop: 1 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>
                      {name}
                    </span>
                    {isMine && (
                      <span style={{ fontSize: 10, color: "var(--accent-1)", fontWeight: 600 }}>YOU</span>
                    )}
                    {review.createdAt && (
                      <span style={{ fontSize: 11, color: "var(--text-5)", marginLeft: "auto", flexShrink: 0 }}>
                        {formatDate(review.createdAt)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.45, wordBreak: "break-word" }}>
                    {parseMarkdown(review.content, markdownData)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {currentUser && (
          <div style={{
            padding: "10px 14px 14px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}>
            <SectionLabel>{myReview ? "Edit your review" : "Write a review"}</SectionLabel>
            <div style={{
              resize: "none", width: "100%", padding: "7px 9px", borderRadius: 7,
              background: "var(--bg-1)", border: "1px solid var(--border)",
              color: "var(--text-2)", fontSize: 13, lineHeight: 1.45, outline: "none",
              boxSizing: "border-box", fontFamily: "inherit",
            }}>
              <MessageInput
                isChannel={false}
                initialText={draft}
                placeholderText={`Say something about ${getDisplayName(user)}...`}
                setText={setDraft}
                authState={authState as AuthState}
                serverState={serverState}
                channelState={channelState}
                messageState={messageState}
                userState={userState}
                onEnter={() => handleSubmit()}
                ref={inputRef}
              />
            </div>
            {error && <div style={{ fontSize: 12, color: "var(--red-2)" }}>{error}</div>}
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {myReview && (
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  style={{
                    padding: "5px 13px", borderRadius: 6, border: "none",
                    background: "color-mix(in hsl, var(--red-2), transparent 80%)",
                    color: "var(--red-2)", fontSize: 12, fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!draft || !draft.trim() || submitting}
                style={{
                  padding: "5px 16px", borderRadius: 6, border: "none",
                  background: "var(--accent-1)", color: "#fff",
                  fontSize: 12, fontWeight: 600,
                  cursor: (!draft || !draft.trim() || submitting) ? "not-allowed" : "pointer",
                  opacity: (!draft || !draft.trim() || submitting) ? 0.5 : 1,
                }}
              >
                {submitting ? "Saving..." : myReview ? "Update" : "Submit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ReviewsButtonProps {
  user: User;
  currentUser: User | null;
  serverState: ServerState;
  channelState: ChannelState;
  messageState: MessageState;
  userState: UserState;
  token: string | null;
  userSettings: UserSettings | null;
  markdownData: {};
  open: (popout: Popout) => void;
  close: (id: string) => void;
}

function ReviewsButton({
  user,
  currentUser,
  serverState,
  channelState,
  messageState,
  userState,
  token,
  userSettings,
  markdownData,
  open,
  close
}: ReviewsButtonProps) {
  const opts = { headers: { Authorization: `Bearer ${token}` } };
  const [previews, setPreviews] = useState<Review[]>(
    reviewsCache.has(user.id) ? reviewsCache.get(user.id)!.slice(0, 4) : [],
  );
  const [count, setCount] = useState(
    reviewsCache.has(user.id) ? reviewsCache.get(user.id)!.length : 0,
  );
  const { getUser } = userState;

  useEffect(() => {
    if (reviewsCache.has(user.id)) return;
    getReviews(user, opts)
      .then(data => {
        reviewsCache.set(user.id, data);
        const sorted = [...data].sort(
          (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
        );
        setPreviews(sorted.slice(0, 4));
        setCount(data.length);
      })
      .catch(() => {});
  }, [user.id]);

  const sortedPreviews = [...previews].sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
  );

  return (
    <button
      onClick={() => open({
        id: "user-reviews",
        element: <ReviewsModal
          user={user}
          currentUser={currentUser}
          serverState={serverState}
          channelState={channelState}
          messageState={messageState}
          userState={userState}
          authState={{ token, userSettings, user: currentUser }}
          markdownData={markdownData}
          opts={opts}
          onClose={() => close("user-reviews")}
        />,
        options: {},
        closeWhenClickOutside: false,
      })}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "7px 10px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "color-mix(in hsl, var(--bg-4), transparent 50%)",
        color: "var(--text-3)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        gap: 8,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>Reviews</span>
        {count > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: "color-mix(in hsl, var(--accent-2), transparent 70%)",
            color: "var(--accent-1)", borderRadius: 10, padding: "1px 6px",
          }}>
            {count}
          </span>
        )}
      </span>
      {sortedPreviews.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", flexDirection: "row-reverse" }}>
          {sortedPreviews.slice().reverse().map((r, i) => {
            const rUser = getUser(r.authorId) ?? null;
            return (
              <img
                key={r.authorId ?? i}
                src={getAvatar(rUser)}
                alt={getDisplayName(rUser)}
                title={getDisplayName(rUser)}
                style={{
                  width: 20, height: 20, borderRadius: "50%", objectFit: "cover",
                  border: "2px solid var(--bg-3)",
                  marginLeft: i === sortedPreviews.length - 1 ? 0 : -6,
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>
      )}
    </button>
  );
}

export default function UserPopout({
  user,
  member,
  serverState,
  channelState,
  messageState,
  userState,
  userSettings,
  currentUser,
  open,
  close,
  onClose,
  token,
  position,
}: UserPopoutProps) {
  const name = getDisplayName(user, member);
  const avatar = getAvatar(user, member);
  const roleColor = serverState ? getRoleColor(serverState, user, member, true) : undefined;
  const resolvedBannerUrl = getBanner(user, member);
  const resolvedBio = getBio(user, member);
  const resolvedPronouns = getPronouns(user, member);
  const resolvedNameFont = member?.nameFont ?? user.nameFont;

  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [badges, setBadges] = useState<Badge[]>([]);

  useLayoutEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    if (!token)
      return;
    getUserBadges(user.id, { headers: { Authorization: `Bearer ${token}` } })
      .then(b => setBadges(b.filter(x => x.isVisible).sort((a, b2) => a.displayOrder - b2.displayOrder)))
      .catch(() => {});
  }, [user.id, token]);

  const clampedLeft  = position.left  != null
    ? Math.max(0, Math.min(position.left,  window.innerWidth  - size.width))
    : undefined;
  const clampedRight = position.right != null
    ? Math.max(0, Math.min(position.right, window.innerWidth  + size.width))
    : undefined;
  const clampedTop = Math.max(0, Math.min(position.top, window.innerHeight - size.height - 50));

  const bannerBg = resolvedBannerUrl ? `url(${resolvedBannerUrl})` : undefined;
  const bannerColor = intToHex(user.bannerColor);
  const status = user.onlineStatus ?? OnlineStatus.Offline;
  const statusMeta = STATUS_META[status];

  const globalLevel = user.level ?? 0;
  const globalXp = user.totalXp ?? 0;
  const memberLevel = member?.level ?? 0;
  const memberXp = member?.totalXp ?? 0;
  const hasMemberLevel = !!member && (memberXp > 0 || memberLevel > 0);
  const showBothLevels = hasMemberLevel;

  let tzDisplay: string | undefined;
  if (user.timeZone) {
    try {
      const tz = typeof user.timeZone === "string" ? user.timeZone : (user.timeZone as any)?.id;
      if (tz) {
        const time = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(new Date());
        tzDisplay = time;
      }
    } catch { /* invalid tz */ }
  }

  function openUserPopout(target: Element, u: User, m: Member | undefined) {
    const rect = target.getBoundingClientRect();
    const id = `user-profile-${rect.bottom}-${rect.left}`;
    open({
      id,
      element: (
        <UserPopout
          user={u} member={m}
          serverState={serverState} channelState={channelState}
          messageState={messageState} userState={userState}
          userSettings={userSettings} currentUser={currentUser}
          open={open} close={close}
          onClose={() => close(id)}
          token={token}
          position={{ top: rect.bottom + window.scrollY, left: rect.right + window.scrollX }}
        />
      ),
      options: {},
    });
  }

  const markdownData = {
    serverState, channelState, userState, userSettings,
    onMentionClick: (u: User, m: Member, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      openUserPopout(event.currentTarget, u, m);
    },
    onChannelClick: (channel: Channel, event: React.MouseEvent) => {
      event.stopPropagation();
      if (channelState.currentChannel?.id !== channel.id) {
        event.preventDefault();
        if (serverState.currentServer?.id !== channel.serverId) {
          const s = serverState.get(channel.serverId);
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
      const emojiInfo = await getEmojiDataFromNative(emoji);
      open({
        id: "emoji",
        element: (
          <EmojiPopout
            emoji={emoji}
            emojiName={emojiInfo?.id ?? emoji}
            userSettings={userSettings}
            position={{ top: rect.bottom + window.scrollY, left: rect.right + window.scrollX }}
          />
        ),
        options: {},
      });
    },
  };

  return (
    <>
      <div
        ref={ref}
        style={{
          position: "fixed",
          top: clampedTop,
          left: clampedLeft !== undefined ? clampedLeft : (clampedRight ?? 0) - size.width,
          zIndex: 1000,
          width: 280,
          borderRadius: 12,
          overflow: "hidden",
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          animation: "popout-in 150ms cubic-bezier(0.2,0,0,1.4) both",
        }}
      >
        <div
          style={{
            height: 72,
            backgroundImage: bannerBg
              ? bannerBg
              : `linear-gradient(135deg, ${bannerColor}, color-mix(in hsl, ${bannerColor}, black 30%))`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            className="close-btn"
            style={{
              position: "absolute", top: 6, right: 6,
              width: 22, height: 22, padding: 0, borderRadius: 4,
              background: "rgba(0,0,0,0.45)", border: "none", color: "#fff",
              fontSize: 13, lineHeight: 1, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Close"
          >✕</button>
        </div>

        <div style={{ padding: "0 12px", position: "relative", marginBottom: 4 }}>
          <div
            style={{
              position: "absolute",
              top: -26, left: 12,
              width: 52, height: 52,
              borderRadius: "50%",
              background: "var(--bg-3)",
              padding: 3,
              boxSizing: "border-box",
              boxShadow: `0 0 0 3px ${statusMeta.color}`,
            }}
          >
            <img
              src={avatar}
              alt={name}
              style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }}
            />
            <div style={{ position: "absolute", bottom: 1, right: 1 }}>
              <StatusDot status={status} size={14} />
            </div>
          </div>

          <div style={{
            display: "flex", flexWrap: "wrap", gap: 3,
            justifyContent: "flex-end",
            paddingTop: 6, minHeight: 28,
          }}>
            {badges.map(b => (
              <span
                key={b.type}
                title={BadgeLabels[b.type] ?? `Badge ${b.type}`}
                style={{
                  fontSize: 15,
                  lineHeight: 1,
                  cursor: "default",
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
                }}
              >
                {BadgeIcons[b.type] ?? "🏅"}
              </span>
            ))}
          </div>
        </div>

        <div
          className="ovy-auto"
          style={{
            padding: "0 14px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            maxHeight: "calc(90vh - 160px)",
          }}
        >
          <div style={{ marginBottom: 2 }}>
            <div
              style={{
                fontFamily: resolvedNameFont
                  ? `"${resolvedNameFont}", Inter, Avenir, Helvetica, Arial, sans-serif`
                  : "inherit",
                fontSize: 18,
                fontWeight: 700,
                color: roleColor ?? "var(--text-2)",
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}
            >
              {name}
            </div>
            <div style={{
              fontSize: 13, color: "var(--text-5)", fontWeight: 500,
              display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap",
            }}>
              <span>@{user.username}</span>
              {resolvedPronouns && (
                <>
                  <span style={{ color: "var(--border)" }}>·</span>
                  <span style={{ color: "var(--text-4)" }}>{resolvedPronouns}</span>
                </>
              )}
            </div>

            {user.title && (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 5,
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                background: user.titleIsSystem
                  ? "color-mix(in hsl, var(--accent-2), transparent 75%)"
                  : "color-mix(in hsl, var(--yellow-2), transparent 78%)",
                color: user.titleIsSystem ? "var(--accent-1)" : "var(--yellow-1)",
                border: `1px solid ${user.titleIsSystem
                  ? "color-mix(in hsl, var(--accent-2), transparent 50%)"
                  : "color-mix(in hsl, var(--yellow-2), transparent 50%)"}`,
                letterSpacing: "0.04em",
              }}>
                {user.titleIsSystem ? "⚡ " : "🏷 "}{user.title}
              </div>
            )}
          </div>

          {/* Status line */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            marginBottom: 8, marginTop: 6, flexWrap: "wrap",
          }}>
            <StatusDot status={status} size={10} />
            <span style={{ fontSize: 12, color: statusMeta.color, fontWeight: 600 }}>
              {statusMeta.label}
            </span>
            {user.status && (
              <span
                style={{
                  fontSize: 12, color: "var(--text-4)",
                  overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap", maxWidth: 140,
                }}
                title={user.status}
              >
                — {user.status}
              </span>
            )}
          </div>

          <Divider />

          {resolvedBio && (
            <div style={{ marginBottom: 10 }}>
              <SectionLabel>About me</SectionLabel>
              <div style={{
                fontSize: 13, color: "var(--text-3)",
                lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                background: "color-mix(in hsl, var(--bg-4), transparent 40%)",
                borderRadius: 6, padding: "6px 8px",
                border: "1px solid var(--border-light)",
              }}>
                {parseMarkdown(resolvedBio, markdownData)}
              </div>
            </div>
          )}

          <div style={{
            display: "grid",
            gridTemplateColumns: member ? "1fr 1fr" : "1fr",
            gap: 8, marginBottom: 8,
          }}>
            <div>
              <SectionLabel>Member since</SectionLabel>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>
                {formatDate(user.joinedAt)}
              </div>
            </div>
            {member && (
              <div>
                <SectionLabel>Joined server</SectionLabel>
                <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>
                  {formatDate(member.joinedAt)}
                </div>
              </div>
            )}
          </div>

          {tzDisplay && (
            <>
              <Divider />
              <div style={{ marginBottom: 8 }}>
                <SectionLabel>Local time</SectionLabel>
                <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>
                  🕐 {tzDisplay}
                </div>
              </div>
            </>
          )}

          <Divider />

          <div style={{ marginBottom: 10 }}>
            {showBothLevels ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <XpBar
                  label="Global level"
                  level={globalLevel}
                  totalXp={globalXp}
                  accentVar="var(--accent-1)"
                />
                <XpBar
                  label="Server level"
                  level={memberLevel}
                  totalXp={memberXp}
                  accentVar="var(--blue-2)"
                />
              </div>
            ) : (
              <XpBar
                label={member ? "Server level" : "Level"}
                level={hasMemberLevel ? memberLevel : globalLevel}
                totalXp={hasMemberLevel ? memberXp : globalXp}
                accentVar="var(--accent-1)"
              />
            )}
          </div>

          <Divider />

          <div style={{ marginBottom: 8 }}>
            <ReviewsButton
              user={user}
              currentUser={currentUser}
              serverState={serverState}
              channelState={channelState}
              messageState={messageState}
              userState={userState}
              token={token}
              userSettings={userSettings}
              markdownData={markdownData}
              open={open}
              close={close}
            />
          </div>

          {/* Roles */}
          {member && member.roles.length > 0 && (
            <>
              <Divider />
              <div style={{ marginBottom: 8 }}>
                <SectionLabel>Roles — {member.roles.length}</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {member.roles.map(roleId => {
                    const role  = serverState?.get(member.serverId)?.roles.find((r: any) => r.id === roleId);
                    const color = role?.color ? intToHex(role.color) : "var(--text-4)";
                    return (
                      <span
                        key={roleId}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 7px", borderRadius: 4,
                          fontSize: 12, fontWeight: 600,
                          background: "color-mix(in hsl, var(--bg-1), transparent 30%)",
                          border: `1px solid color-mix(in hsl, ${color}, transparent 60%)`,
                          color,
                        }}
                      >
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: color, flexShrink: 0, display: "inline-block",
                        }} />
                        {role?.name ?? `Role ${roleId}`}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* DM accent swatches */}
          {(user.dmColor || (user.dmColors && user.dmColors.length > 0)) && (
            <>
              <Divider />
              <div style={{ marginBottom: 4 }}>
                <SectionLabel>DM accent</SectionLabel>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {user.dmColors
                    ? user.dmColors.map((c, i) => (
                        <span
                          key={i}
                          title={intToHex(c)}
                          style={{
                            display: "inline-block",
                            width: 18, height: 18, borderRadius: 4,
                            background: intToHex(c),
                            border: "1px solid rgba(255,255,255,0.15)",
                            cursor: "default", flexShrink: 0,
                          }}
                        />
                      ))
                    : user.dmColor && (
                        <span
                          title={intToHex(user.dmColor)}
                          style={{
                            display: "inline-block",
                            width: 18, height: 18, borderRadius: 4,
                            background: intToHex(user.dmColor),
                            border: "1px solid rgba(255,255,255,0.15)",
                            cursor: "default",
                          }}
                        />
                      )}
                </div>
              </div>
            </>
          )}

          {/* Last seen (offline users, or users who share while offline) */}
          {(status === OnlineStatus.Offline || user.showStatusWhileOffline) && user.lastSeen && (
            <>
              <Divider />
              <div>
                <SectionLabel>Last seen</SectionLabel>
                <div style={{ fontSize: 12, color: "var(--text-5)" }}>
                  {formatDate(user.lastSeen)}
                </div>
              </div>
            </>
          )}
        </div>

        <style>{`
          @keyframes popout-in {
            from { opacity: 0; transform: scale(0.93) translateY(-6px); }
            to   { opacity: 1; transform: scale(1)    translateY(0); }
          }
        `}</style>
      </div>
    </>
  );
}