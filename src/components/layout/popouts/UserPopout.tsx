import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { Member, OnlineStatus, Review, User } from "../../../lib/utils/Types";
import {
  getAvatar,
  getBanner,
  getBio,
  getDisplayName,
  getHandle,
  getPronouns,
} from "../../../lib/utils/UserUtils";
import { getSs } from "../../../lib/state/Servers";
import { getUs } from "../../../lib/state/Users";
import { getPs } from "../../../lib/state/Popouts";
import { RenderContext, RenderMarkdown } from "../../../lib/utils/MarkdownRenderer";
import {
  getUserBadges,
  Badge,
  BadgeLabels,
  BadgeIcons,
} from "../../../lib/api/SocialApi";
import { getReviews } from "../../../lib/api/UserApi";
import { t, useLocale } from "../../../lib/i18n/Index";
import type { TranslationKeys } from "../../../lib/i18n/Schema";
import { Divider, Name, SectionLabel } from "../Generic";
import ReviewsModal, { reviewsCache } from "../modals/ReviewsModal";
import { formatDate, intToHex, makeMarkdownContext, roleToStyle } from "../../../lib/utils/Funcs";
import { getAs } from "../../../lib/state/Auth";
import { ClockIcon } from "../../svgs/other/Icons";

interface UserPopoutProps {
  user: User;
  member?: Member;
  onClose: () => void;
  position: { top: number; left?: number; right?: number };
}

const STATUS_META: Record<OnlineStatus, { labelKey: TranslationKeys; color: string; dot: string }> = {
  [OnlineStatus.Online]:   { labelKey: "status.online",   color: "var(--online)",  dot: "●" },
  [OnlineStatus.Idle]:     { labelKey: "status.idle",     color: "var(--idle)",    dot: "◐" },
  [OnlineStatus.Focusing]: { labelKey: "status.focusing", color: "var(--blue-2)",  dot: "◎" },
  [OnlineStatus.DND]:      { labelKey: "status.dnd",      color: "var(--dnd)",     dot: "⊖" },
  [OnlineStatus.Offline]:  { labelKey: "status.offline",  color: "var(--offline)", dot: "○" },
};

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

function XpBar({ label, level, totalXp, accentVar = "var(--accent-1)" }: {
  label?: string;
  level: number;
  totalXp: number;
  accentVar?: string;
}) {
  useLocale();
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
          {t("user.level", { level })}
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
        {t("user.xp_total", { xp: totalXp.toLocaleString() })}
      </div>
    </div>
  );
}

interface ReviewsButtonProps {
  user: User;
  member?: Member,
  ctx: RenderContext;
  spoilerState: React.MutableRefObject<Map<number, boolean>>;
}

function ReviewsButton({
  user,
  member,
  ctx,
  spoilerState
}: ReviewsButtonProps) {
  const [previews, setPreviews] = useState<Review[]>(
    reviewsCache.has(user.id) ? reviewsCache.get(user.id)!.slice(0, 4) : []
  );
  const [count, setCount] = useState(
    reviewsCache.has(user.id) ? reviewsCache.get(user.id)!.length : 0
  );
  const { getUser } = getUs();
  const { open, close } = getPs();

  useEffect(() => {
    if (reviewsCache.has(user.id))
      return;
    getReviews(user)
      .then(data => {
        reviewsCache.set(user.id, data);
        const sorted = [...data].sort(
          (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
        );
        setPreviews(sorted.slice(0, 4));
        setCount(data.length);
      })
      .catch(() => {});
  }, [user.id]);

  const sortedPreviews = [...previews].sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  );

  return (
    <button
      onClick={() => open({
        id: "user-reviews",
        element: <ReviewsModal
          user={user}
          member={member}
          ctx={ctx}
          spoilerState={spoilerState}
          setPreviews={setPreviews}
          setCount={setCount}
          onClose={() => close("user-reviews")}
        />,
        options: {}
      })}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        minHeight: 40,
        padding: "7px 10px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "color-mix(in hsl, var(--bg-4), transparent 50%)",
        color: "var(--text-3)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        gap: 8
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>{t("user.reviews")}</span>
        {count > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: "color-mix(in hsl, var(--accent-2), transparent 70%)",
            color: "var(--accent-1)", borderRadius: 10, padding: "1px 6px",
          }}>
            {count.toLocaleString()}
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
                  flexShrink: 0
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
  onClose,
  position
}: UserPopoutProps) {
  useLocale();
  const name = getDisplayName(user, member);
  const avatar = getAvatar(user, member);
  const resolvedBannerUrl = getBanner(user, member);
  const resolvedBio = getBio(user, member);
  const resolvedPronouns = getPronouns(user, member);

  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [badges, setBadges] = useState<Badge[]>([]);
  const spoilerState = useRef<Map<number, boolean>>(new Map());

  const { token } = getAs();
  const { open, close } = getPs();
  const ss = getSs();

  const markdownData = makeMarkdownContext( open, openUserPopout );

  useLayoutEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    if (!token)
      return;
    getUserBadges(user.id)
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
          timeZoneName: "short"
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
          onClose={() => close(id)}
          position={{ top: rect.bottom + window.scrollY, left: rect.right + window.scrollX }}
        />
      ),
      options: {},
    });
  }

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
          animation: "popout-in 150ms cubic-bezier(0.2,0,0,1.4) both"
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
            flexShrink: 0
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
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
            title={t("close")}
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
              boxShadow: `0 0 0 3px ${statusMeta.color}`
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
            paddingTop: 6, minHeight: 28
          }}>
            {badges.map(b => (
              <span
                key={b.type}
                title={BadgeLabels[b.type] ?? t("user.badge_fallback", { type: b.type })}
                style={{
                  fontSize: 15,
                  lineHeight: 1,
                  cursor: "default",
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
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
            maxHeight: "calc(90vh - 160px)"
          }}
        >
          <div style={{ marginBottom: 2 }}>
            <Name
              user={user}
              member={member}
              md={markdownData}
              spoilerState={spoilerState}
              style={{
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.2,
                wordBreak: "break-word"
              }}
            />
            <div style={{
              fontSize: 13, color: "var(--text-5)", fontWeight: 500,
              display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap",
            }}>
              <span>@{getHandle(user)}</span>
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
                {user.title}
              </div>
            )}
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            marginBottom: 8, marginTop: 6, flexWrap: "wrap",
          }}>
            <StatusDot status={status} size={10} />
            <span style={{ fontSize: 12, color: statusMeta.color, fontWeight: 600 }}>
              {t(statusMeta.labelKey)}
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
              <SectionLabel>{t("about.l")}</SectionLabel>
              <div style={{
                fontSize: 13, color: "var(--text-3)",
                lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                background: "color-mix(in hsl, var(--bg-4), transparent 40%)",
                borderRadius: 6, padding: "6px 8px",
                border: "1px solid var(--border-light)",
              }}>
                {RenderMarkdown({ content: resolvedBio, spoilerStateRef: spoilerState, ...markdownData })}
              </div>
            </div>
          )}

          <div style={{
            display: "grid",
            gridTemplateColumns: member ? "1fr 1fr" : "1fr",
            gap: 8, marginBottom: 8,
          }}>
            <div>
              <SectionLabel>{t("joined")}</SectionLabel>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>
                {formatDate(user.joinedAt)}
              </div>
            </div>
            {member && (
              <div>
                <SectionLabel>{t("user.joined_server")}</SectionLabel>
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
                <SectionLabel>{t("user.local_time")}</SectionLabel>
                <div style={{ color: "var(--text-3)", fontWeight: 500 }}>
                  <ClockIcon size={12} /> {tzDisplay}
                </div>
              </div>
            </>
          )}

          <Divider />

          <div style={{ marginBottom: 10 }}>
            {showBothLevels ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <XpBar
                  label={t("user.global_level")}
                  level={globalLevel}
                  totalXp={globalXp}
                  accentVar="var(--accent-1)"
                />
                <XpBar
                  label={t("user.server_level")}
                  level={memberLevel}
                  totalXp={memberXp}
                  accentVar="var(--blue-2)"
                />
              </div>
            ) : (
              <XpBar
                label={member ? t("user.server_level") : t("user.global_level_title")}
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
              member={member}
              ctx={markdownData}
              spoilerState={spoilerState}
            />
          </div>

          {member && member.roles.length > 0 && (
            <>
              <Divider />
              <div style={{ marginBottom: 8 }}>
                <SectionLabel>{t("user.roles_count", { count: member.roles.length })}</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {member.roles.map(roleId => {
                    const role = ss.get(member.serverId)?.roles.find(r => r.id === roleId);
                    const roleStyle = role ? roleToStyle(role, false) : {};

                    return (
                      <span
                        key={roleId}
                        className="uno"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "0 7px", borderRadius: 1,
                          fontSize: 12, fontWeight: 600,
                          background: "color-mix(in hsl, var(--bg-1), transparent 60%)",
                          border: `2px solid color-mix(in hsl, var(--bg-1), transparent 10%)`,
                          color: "var(--text-4)"
                        }}
                      >
                        <span style={{
                          width: 12, height: 12, borderRadius: "50%",
                          flexShrink: 0, display: "inline-block", transform: "translateY(-1px) translateX(-2px)", ...roleStyle
                        }} />
                        {role?.name ?? t("user.role_fallback", { id: roleId })}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {(user.dmColor || (user.dmColors && user.dmColors.length > 0)) && (
            <>
              <Divider />
              <div style={{ marginBottom: 4 }}>
                <SectionLabel>{t("user.dm_accent")}</SectionLabel>
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

          {status === OnlineStatus.Offline && user.lastSeen && (
            <>
              <Divider />
              <div>
                <SectionLabel>{t("user.last_seen")}</SectionLabel>
                <div style={{ fontSize: 12, color: "var(--text-5)" }}>
                  {formatDate(user.lastSeen)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}