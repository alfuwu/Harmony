import { invoke, isTauri } from '@tauri-apps/api/core';
import { useUserState } from "../../lib/state/Users";
import { usePopoutState } from "../../lib/state/Popouts";
import { useServerState } from "../../lib/state/Servers";
import { getAvatar, getDisplayName, getRoleColor } from "../../lib/utils/UserUtils";
import UserPopout from "./popouts/UserPopout";
import { useAuthState } from '../../lib/state/Auth';
import { useMessageState } from '../../lib/state/Messages';
import { useChannelState } from '../../lib/state/Channels';
import { useState } from 'react';
import { canBanMembers, canKickMembers, isOwner } from '../../lib/utils/PermissionUtils';
import { Member, OnlineStatus } from '../../lib/utils/types';
import { createDm } from '../../lib/api/dmApi';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { banMember, kickMember } from '../../lib/api/serverApi';
import NicknameModal from './modals/NicknameModal';

const STATUS_COLORS: Record<OnlineStatus, string> = {
  [OnlineStatus.Online]: "var(--online)",
  [OnlineStatus.Idle]: "var(--idle)",
  [OnlineStatus.Focusing]: "var(--blue-2)",
  [OnlineStatus.DND]: "var(--dnd)",
  [OnlineStatus.Offline]: "var(--offline)",
};

export default function MemberList() {
  const { token, user, userSettings } = useAuthState();
  const serverState = useServerState();
  const channelState = useChannelState();
  const messageState = useMessageState();
  const userState = useUserState();
  
  const { open, close } = usePopoutState();

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; member: Member } | null>(null);
  const [nicknameModal, setNicknameModal] = useState<{ member: Member } | null>(null);
  
  const me = serverState.currentServer ? userState.getMember(user?.id, serverState.currentServer.id) : undefined;
  const canKick = canKickMembers(me, serverState.currentServer);
  const canBan = canBanMembers(me, serverState.currentServer);
  const owner = isOwner(me, serverState.currentServer);

  const serverMembers = userState.members
    .filter(m => m.serverId === serverState.currentServer?.id)
    .sort((a, b) => getDisplayName(a.user, a).localeCompare(getDisplayName(b.user, b)));
  
  function openCtx(e: React.MouseEvent, member: Member) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, member });
  }

  function buildCtxItems(member: Member): ContextMenuItem[] {
    const isSelf = member.user.id === user?.id;
    const items: ContextMenuItem[] = [];

    if (!isSelf) {
      items.push({
        label: "Send Message",
        icon: "💬",
        onClick: async () => {
          try {
            const dm = await createDm(member.user.id, { headers: { Authorization: `Bearer ${token}` } });
            channelState.addChannel(dm);
            channelState.setCurrentChannel(dm);
          } catch (e) { console.error(e); }
        },
      });

      items.push({
        label: "Set Nickname",
        icon: "✏️",
        onClick: () => setNicknameModal({ member }),
      });

      items.push({ label: "", onClick: () => {}, divider: true });
    }

    items.push({
      label: "Copy User ID",
      icon: "🆔",
      onClick: () => navigator.clipboard.writeText(String(member.user.id)),
    });

    if (!isSelf && (canKick || owner)) {
      items.push({ label: "", onClick: () => {}, divider: true });
      items.push({
        label: "Kick Member",
        icon: "👢",
        danger: true,
        onClick: async () => {
          if (!serverState.currentServer)
            return;
          try {
            await kickMember(serverState.currentServer.id, member, undefined, { headers: { Authorization: `Bearer ${token}` } });
            userState.removeMember(member.user.id, serverState.currentServer.id);
          } catch (e) { console.error(e); }
        },
      });
    }

    if (!isSelf && (canBan || owner)) {
      items.push({
        label: "Ban Member",
        icon: "🔨",
        danger: true,
        onClick: async () => {
          if (!serverState.currentServer)
            return;
          try {
            await banMember(serverState.currentServer.id, member.user, undefined, { headers: { Authorization: `Bearer ${token}` } });
            userState.removeMember(member.user.id, serverState.currentServer.id);
          } catch (e) { console.error(e); }
        },
      });
    }

    return items;
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
      {serverState.currentServer && (
        <div style={{ padding: "4px 12px", fontSize: 11, color: "var(--text-5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Members — {serverMembers.length}
        </div>
      )}
      <div className="real-member-list">
        {userState.members.sort((a, b) => getDisplayName(a.user, a).localeCompare(getDisplayName(b.user, b))).map(m => {
          const name = getDisplayName(m.user, m);
          const avatar = getAvatar(m.user, m);
          const roleColor = getRoleColor(serverState, m.user, m, serverState.currentServer === null);
          const status = m.user.onlineStatus ?? OnlineStatus.Offline;

          return m.serverId === serverState.currentServer?.id && (
            <div
              key={m.user.id}
              className="member int"
              onClick={e => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                
                const id = `user-profile-${rect.bottom}-${rect.left}`;
                open({
                  id,
                  element: (
                    <UserPopout
                      user={m.user}
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
                        right: rect.left + window.scrollX
                      }}
                    />
                  ),
                  options: {}
                });
              }}
              onContextMenu={e => openCtx(e, m)}
            >
              <div style={{ position: "relative", marginRight: 10, flexShrink: 0 }}>
                <img className="avatar uno" src={avatar} alt="avatar" style={{ pointerEvents: "none", margin: 0 }} />
                <span
                  style={{
                    position: "absolute", bottom: -3, right: 0,
                    width: 6, height: 6, borderRadius: "50%",
                    background: STATUS_COLORS[status],
                    border: "4px solid var(--bg-3)",
                  }}
                />
              </div>
              <div
                key={m.user.id}
                className="author uno"
                style={{
                  fontFamily: `"${m.nameFont}", "${m.user.nameFont}", Inter, Avenir, Helvetica, Arial, sans-serif`,
                  color: roleColor,
                  pointerEvents: "none"
                }}
              >
                {name}
              </div>
            </div>
          )
        })}
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
          target={nicknameModal.member.user}
          onClose={() => setNicknameModal(null)}
          onSaved={() => setNicknameModal(null)}
        />
      )}
    </>
  );
}
