import { invoke, isTauri } from "@tauri-apps/api/core";
import { useAuthState } from "../../lib/state/Auth";
import { useServerState } from "../../lib/state/Servers";
import { useChannelState } from "../../lib/state/Channels";
import { UserState, useUserState } from "../../lib/state/Users";
import { getPs } from "../../lib/state/Popouts";
import { getAvatar, getDisplayName } from "../../lib/utils/UserUtils";
import UserPopout from "./popouts/UserPopout";
import { useLoadingState } from "../../lib/state/Loading";
import { useRef, useState } from "react";
import { canBanMembers, canKickMembers } from "../../lib/utils/PermissionUtils";
import { Member, OnlineStatus, Role } from "../../lib/utils/Types";
import { createDm } from "../../lib/api/DmApi";
import ContextMenu, { ContextMenuItem } from "./ContextMenu";
import { banMember, ipBanMember, kickMember } from "../../lib/api/ServerApi";
import NicknameModal from "./modals/NicknameModal";
import { SkeletonMemberList } from "./Skeleton";
import { Name } from "./Generic";
import { roleToStyle } from "../../lib/utils/Funcs";
import { t, useLocale } from "../../lib/i18n/Index";
import { BanIcon, EditIcon, HashIcon, MessageIcon, UserMinusIcon } from "../svgs/other/Icons";
import ModerationModal from "./modals/ModerationModal";

const LARGE_SERVER_THRESHOLD = 1500;

const STATUS_COLORS: Record<OnlineStatus, string> = {
  [OnlineStatus.Online]: "var(--online)",
  [OnlineStatus.Idle]: "var(--idle)",
  [OnlineStatus.Focusing]: "var(--blue-2)",
  [OnlineStatus.DND]: "var(--dnd)",
  [OnlineStatus.Offline]: "var(--offline)"
};

interface RoleSection {
  role: Role | null;
  online: Member[];
}

function buildSections(members: Member[], roles: Role[], us: UserState): { sections: RoleSection[]; offline: Member[] } {
  const sorted = [...roles].sort((a, b) => b.position - a.position);

  const byRole = new Map<bigint | null, { online: Member[]; offline: Member[] }>();
  byRole.set(null, { online: [], offline: [] });
  for (const r of sorted)
    byRole.set(r.id, { online: [], offline: [] });

  for (const m of members) {
    const highest = sorted.find(r => m.roles.includes(r.id) && r.displaysSeparately);
    const key = highest?.id ?? null;
    const bucket = byRole.get(key)!;
    const user = us.get(m.userId);
    if (user && user.onlineStatus !== OnlineStatus.Offline)
      bucket.online.push(m);
    else
      bucket.offline.push(m);
  }

  const sections: RoleSection[] = [];
  for (const r of sorted) {
    const bucket = byRole.get(r.id)!;
    if (bucket.online.length > 0)
      sections.push({ role: r, online: bucket.online });
  }
  const noBucket = byRole.get(null)!;
  if (noBucket.online.length > 0)
    sections.push({ role: null, online: noBucket.online });

  const offline: Member[] = [];
  for (const r of sorted) {
    const bucket = byRole.get(r.id)!;
    offline.push(...bucket.offline);
  }
  offline.push(...noBucket.offline);

  return { sections, offline };
}
 
export default function MemberList() {
  useLocale();

  const { user, userSettings } = useAuthState();
  const { currentServer } = useServerState();
  const { addChannel, setCurrentChannel } = useChannelState();
  const us = useUserState();
  const { members, get, removeMember } = us;
  const { open, close } = getPs();
  const { membersLoading } = useLoadingState();

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; member: Member } | null>(null);
  const [nicknameModal, setNicknameModal] = useState<{ member: Member } | null>(null);
  const [showOffline, setShowOffline] = useState(true);

  const spoilerState = useRef<Map<number, boolean>>(new Map());
  const [moderationTarget, setModerationTarget] = useState<{
    member: Member;
    action: "kick" | "ban" | "ip_ban";
  } | null>(null);

  const me = currentServer
    ? us.getMember(user?.id, currentServer.id)
    : undefined;
  const canKick = canKickMembers(me, currentServer);
  const canBan = canBanMembers(me, currentServer);

  function openCtx(e: React.MouseEvent, member: Member) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, member });
  }

  function buildCtxItems(member: Member): ContextMenuItem[] {
    const isSelf = member.userId === user?.id;
    const items: ContextMenuItem[] = [];

    if (!isSelf) {
      items.push({
        label: t("member.send_message"),
        icon: <MessageIcon size={14} />,
        onClick: async () => {
          try {
            const dm = await createDm(member.userId);
            addChannel(dm);
            setCurrentChannel(dm);
          } catch (e) { console.error(e); }
        },
      });
      items.push({ label: t("member.set_nickname"), icon: <EditIcon size={14} />, onClick: () => setNicknameModal({ member }) });
      items.push({ label: "", onClick: () => {}, divider: true });
    }

    if (!isSelf && (canKick || canBan)) {
      items.push({ label: "", onClick: () => {}, divider: true });
      if (canKick)
        items.push({
          label: t("member.kick"),
          icon: <UserMinusIcon size={14} />,
          danger: true,
          onClick: () => setModerationTarget({ member, action: "kick" })
        });
      if (canBan) {
        items.push({
          label: t("member.ban"),
          icon: <BanIcon size={14} />,
          danger: true,
          onClick: () => setModerationTarget({ member, action: "ban" })
        });
        items.push({
          label: t("member.ip_ban"),
          icon: <BanIcon size={14} />, // TODO: new icon?
          danger: true,
          onClick: () => setModerationTarget({ member, action: "ip_ban" })
        });
      }
    }

    if (userSettings?.developerMode) {
      items.push({
        label: t("member.copy_id"),
        icon: <HashIcon size={14} />,
        onClick: () => navigator.clipboard.writeText(String(member.userId))
      });
    }

    return items;
  }

  const serverMembers = members.filter(m => m.serverId === currentServer?.id);
  const serverRoles = currentServer?.roles ?? [];
  const isLargeServer = serverMembers.length > LARGE_SERVER_THRESHOLD;

  const { sections, offline } = buildSections(serverMembers, serverRoles, us);

  function renderMemberRow(m: Member) {
    const u = get(m.userId)!;
    const avatar = getAvatar(u, m);
    const status = u.onlineStatus ?? OnlineStatus.Offline;

    return (
      <div
        key={m.userId}
        className="member int"
        onClick={e => {
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          const id = `user-profile-${rect.bottom}-${rect.left}`;
          open({
            id,
            element: (
              <UserPopout
                user={u}
                member={m}
                onClose={() => close(id)}
                position={{ top: rect.bottom + window.scrollY, right: rect.left + window.scrollX }}
              />
            ),
            options: {}
          });
        }}
        onContextMenu={e => openCtx(e, m)}
      >
        <div style={{ position: "relative", marginRight: 10, flexShrink: 0 }}>
          <img
            className="avatar uno"
            src={avatar}
            alt={t("alt.avatar")}
            style={{ pointerEvents: "none", margin: 0 }}
          />
          <span
            style={{
              position: "absolute",
              bottom: -3, right: 0,
              width: 6, height: 6,
              borderRadius: "50%",
              background: STATUS_COLORS[status],
              border: "4px solid var(--bg-3)"
            }}
          />
        </div>
        <Name
          user={u}
          member={m}
          md={{}}
          spoilerState={spoilerState}
          className="author uno"
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            pointerEvents: "none"
          }}
        />
      </div>
    );
  }

  function renderRoleHeader(role: Role | null, count: number) {
    if (!role) {
      return (
        <div className="member-role-header">
          {t("member.header", { count })}
        </div>
      );
    }

    const colorStyle = roleToStyle(role, true, false);
    return (
      <div
        className="member-role-header"
        style={{ color: "var(--text-5)", ...colorStyle }}
      >
        {role.name} — {count}
      </div>
    );
  }

  return (
    <>
      {isTauri() && (
        <>
          <div className="window-buttons">
            <button onClick={() => invoke("minimize")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="currentColor" d="M19 13H5v-2h14z" />
              </svg>
            </button>
            <button onClick={() => invoke("toggle_maximize")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="currentColor" d="M4 4h16v16H4zm2 2v12h12V6z" />
              </svg>
            </button>
            <button className="close-btn" onClick={() => invoke("close")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="currentColor" d="M13.46 12L19 17.54V19h-1.46L12 13.46L6.46 19H5v-1.46L10.54 12L5 6.46V5h1.46L12 10.54L17.54 5H19v1.46z" />
              </svg>
            </button>
          </div>
          <hr />
        </>
      )}

      <div className="real-member-list">
        {membersLoading ? (
          <SkeletonMemberList count={10} />
        ) : (
          <>
            {sections.map(({ role, online }) => (
              <div key={role?.id ?? "no-role"}>
                {renderRoleHeader(role, online.length)}
                {online
                  .slice()
                  .sort((a, b) => getDisplayName(get(a.userId), a).localeCompare(getDisplayName(get(b.userId), b)))
                  .map(renderMemberRow)}
              </div>
            ))}

            {offline.length > 0 && (
              <div>
                <div
                  className="member-offline-header"
                  onClick={() => setShowOffline(v => !v)}
                >
                  <em
                    className="member-offline-chevron"
                    style={{ transform: showOffline ? "none" : "rotate(-90deg)" }}
                  >
                    ›
                  </em>
                  {t("member.offline", { count: offline.length })}
                  {isLargeServer && !showOffline && (
                    <span style={{ fontSize: 10, color: "var(--text-5)", marginLeft: 4, fontWeight: 400 }}>
                      {t("member.offline_hidden")}
                    </span>
                  )}
                </div>
                {showOffline && offline
                  .slice()
                  .sort((a, b) => getDisplayName(get(a.userId), a).localeCompare(getDisplayName(get(b.userId), b)))
                  .map(renderMemberRow)}
              </div>
            )}

            {sections.length === 0 && offline.length === 0 && currentServer && (
              <div style={{ padding: "16px 12px", color: "var(--text-5)", fontSize: 12 }}>
                {t("member.empty")}
              </div>
            )}
          </>
        )}
      </div>

      {ctxMenu && (
        <ContextMenu
          items={buildCtxItems(ctxMenu.member)}
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {nicknameModal && (
        <NicknameModal
          user={us.get(nicknameModal.member.userId)!}
          onClose={() => setNicknameModal(null)}
        />
      )}

      {moderationTarget && (
        <ModerationModal
          target={moderationTarget.member}
          action={moderationTarget.action}
          onConfirm={async (reason) => {
            if (!currentServer)
              return;
            const { userId } = moderationTarget.member;
            if (moderationTarget.action === "kick")
              await kickMember(currentServer.id, userId, reason || undefined);
            else if (moderationTarget.action === "ban")
              await banMember(currentServer.id, userId, reason || undefined);
            else
              await ipBanMember(currentServer.id, userId, reason || undefined);
            removeMember(userId, currentServer.id);
          }}
          onClose={() => setModerationTarget(null)}
        />
      )}
    </>
  );
}
