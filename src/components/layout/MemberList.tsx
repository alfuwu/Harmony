import { invoke, isTauri } from "@tauri-apps/api/core";
import { UserState, useUserState } from "../../lib/state/Users";
import { usePopoutState } from "../../lib/state/Popouts";
import { useServerState } from "../../lib/state/Servers";
import { getAvatar, getDisplayName } from "../../lib/utils/UserUtils";
import UserPopout from "./popouts/UserPopout";
import { useAuthState } from "../../lib/state/Auth";
import { useMessageState } from "../../lib/state/Messages";
import { useChannelState } from "../../lib/state/Channels";
import { useLoadingState } from "../../lib/state/Loading";
import { useRef, useState } from "react";
import { canBanMembers, canKickMembers, isOwner } from "../../lib/utils/PermissionUtils";
import { Member, OnlineStatus, Role } from "../../lib/utils/Types";
import { createDm } from "../../lib/api/DmApi";
import ContextMenu, { ContextMenuItem } from "./ContextMenu";
import { banMember, kickMember } from "../../lib/api/ServerApi";
import NicknameModal from "./modals/NicknameModal";
import { SkeletonMemberList } from "./Skeleton";
import { Name } from "./Generic";
import { RenderContext } from "../../lib/utils/MarkdownRenderer";
import { roleToStyle } from "../../lib/utils/Funcs";
import { t, useLocale } from "../../lib/i18n/Index";

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

function buildSections(members: Member[], roles: Role[], userState: UserState): { sections: RoleSection[]; offline: Member[] } {
  const sorted = [...roles].sort((a, b) => b.position - a.position);

  const byRole = new Map<number | null, { online: Member[]; offline: Member[] }>();
  byRole.set(null, { online: [], offline: [] });
  for (const r of sorted)
    byRole.set(r.id, { online: [], offline: [] });

  for (const m of members) {
    const highest = sorted.find(r => m.roles.includes(r.id) && r.displaysSeparately);
    const key = highest?.id ?? null;
    const bucket = byRole.get(key)!;
    const user = userState.get(m.userId);
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
  const { token, user, userSettings } = useAuthState();
  const serverState = useServerState();
  const channelState = useChannelState();
  const messageState = useMessageState();
  const userState = useUserState();
  const { membersLoading } = useLoadingState();
  const { open, close } = usePopoutState();

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; member: Member } | null>(null);
  const [nicknameModal, setNicknameModal] = useState<{ member: Member } | null>(null);
  const [showOffline, setShowOffline] = useState(true);

  const spoilerState = useRef<Map<number, boolean>>(new Map());

  const me = serverState.currentServer
    ? userState.getMember(user?.id, serverState.currentServer.id)
    : undefined;
  const canKick = canKickMembers(me, serverState.currentServer);
  const canBan = canBanMembers(me, serverState.currentServer);
  const owner = isOwner(me, serverState.currentServer);

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
        icon: "💬",
        onClick: async () => {
          try {
            const dm = await createDm(member.userId, { headers: { Authorization: `Bearer ${token}` } });
            channelState.addChannel(dm);
            channelState.setCurrentChannel(dm);
          } catch (e) { console.error(e); }
        },
      });
      items.push({ label: t("member.set_nickname"), icon: "✏️", onClick: () => setNicknameModal({ member }) });
      items.push({ label: "", onClick: () => {}, divider: true });
    }

    items.push({
      label: t("member.copy_id"),
      icon: "🆔",
      onClick: () => navigator.clipboard.writeText(String(member.userId))
    });

    if (!isSelf && (canKick || owner)) {
      items.push({ label: "", onClick: () => {}, divider: true });
      items.push({
        label: t("member.kick"),
        icon: "👢",
        danger: true,
        onClick: async () => {
          if (!serverState.currentServer)
            return;
          try {
            await kickMember(serverState.currentServer.id, member.userId, undefined, { headers: { Authorization: `Bearer ${token}` } });
            userState.removeMember(member.userId, serverState.currentServer.id);
          } catch (e) { console.error(e); }
        },
      });
    }

    if (!isSelf && (canBan || owner)) {
      items.push({
        label: t("member.ban"),
        icon: "🔨",
        danger: true,
        onClick: async () => {
          if (!serverState.currentServer)
            return;
          try {
            await banMember(serverState.currentServer.id, member.userId, undefined, { headers: { Authorization: `Bearer ${token}` } });
            userState.removeMember(member.userId, serverState.currentServer.id);
          } catch (e) { console.error(e); }
        },
      });
    }

    return items;
  }

  const markdownData: RenderContext = { serverState, channelState, userState, userSettings };

  const serverMembers = userState.members.filter(m => m.serverId === serverState.currentServer?.id);
  const serverRoles   = serverState.currentServer?.roles ?? [];
  const isLargeServer = serverMembers.length > LARGE_SERVER_THRESHOLD;

  const { sections, offline } = buildSections(serverMembers, serverRoles, userState);

  function renderMemberRow(m: Member) {
    const u = userState.get(m.userId)!;
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
          serverState={serverState}
          md={markdownData}
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

    const colorStyle = roleToStyle(role, true, userSettings, false);
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
                  .sort((a, b) => getDisplayName(a.user, a).localeCompare(getDisplayName(b.user, b)))
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
                  .sort((a, b) => getDisplayName(a.user, a).localeCompare(getDisplayName(b.user, b)))
                  .map(renderMemberRow)}
              </div>
            )}

            {sections.length === 0 && offline.length === 0 && serverState.currentServer && (
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
          open
          target={userState.get(nicknameModal.member.userId)!}
          onClose={() => setNicknameModal(null)}
          onSaved={() => setNicknameModal(null)}
        />
      )}
    </>
  );
}
 