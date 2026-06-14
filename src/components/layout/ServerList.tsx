import { useState } from "react";
import { loadServer, leaveServer } from "../../lib/api/ServerApi";
import { useAuthState } from "../../lib/state/Auth";
import { useChannelState } from "../../lib/state/Channels";
import { useServerState } from "../../lib/state/Servers";
import { useMessageState } from "../../lib/state/Messages";
import { useUserState } from "../../lib/state/Users";
import { useLoadingState } from "../../lib/state/Loading";
import { SkeletonServerList } from "./Skeleton";
import CreateServerModal from "./modals/CreateSeverModal";
import ContextMenu, { ContextMenuItem } from "./ContextMenu";
import { joinServer } from "../../lib/api/SignalrClient";
import { hostUrl } from "../../App";
import { getIcon } from "../../lib/utils/ServerUtils";
import { t, useLocale } from "../../lib/i18n/Index";
import { HashIcon, InviteIcon, LogOutIcon, MessageIcon } from "../svgs/other/Icons";

interface Props {
  onDmClick: () => void;
  showDms: boolean;
}

export default function ServerList({ onDmClick, showDms }: Props) {
  useLocale();
  const { token } = useAuthState();
  const { servers, currentServer, setCurrentServer, removeServer } = useServerState();
  const { serversLoading, setChannelsLoading, setMembersLoading, setMessagesLoading } =
    useLoadingState();

  const [modalOpen, setModalOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; serverId: number } | null>(null);

  const channelState = useChannelState();
  const userState = useUserState();
  const messageState = useMessageState();

  async function handleSelectServer(s: any) {
    setChannelsLoading(true);
    setMembersLoading(true);
    setMessagesLoading(true);

    try {
      await loadServer(s, channelState, userState, messageState, token!);
    } finally {
      setChannelsLoading(false);
      setMembersLoading(false);
      setMessagesLoading(false);
    }

    setCurrentServer(s);
    channelState.setCurrentChannel(null);
    localStorage.setItem("currentServerId", String(s.id));
    joinServer(s.id);
  }

  async function handleLeaveServer(serverId: number) {
    try {
      await leaveServer(serverId, { headers: { Authorization: `Bearer ${token}` } });
      removeServer(serverId);
      if (currentServer?.id === serverId) {
        setCurrentServer(null);
        channelState.setCurrentChannel(null);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function openCtx(e: React.MouseEvent, serverId: number) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, serverId });
  }

  function buildCtxItems(serverId: number): ContextMenuItem[] {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return [];

    const items: ContextMenuItem[] = [
      {
        label: t("server.copy_id"),
        icon: <HashIcon size={14} />,
        onClick: () => navigator.clipboard.writeText(String(serverId))
      },
    ];

    if (server.inviteUrls?.[0]) {
      items.push({
        label: t("server.copy_invite"),
        icon: <InviteIcon size={14} />,
        onClick: () =>
          navigator.clipboard.writeText(
            `${hostUrl}/invite/${server.inviteUrls![0]}`
          )
      });
    }

    items.push({ label: "", onClick: () => {}, divider: true });
    items.push({
      label: t("server.leave"),
      icon: <LogOutIcon size={14} />,
      danger: true,
      onClick: () => handleLeaveServer(serverId)
    });

    return items;
  }

  return (
    <div className="server-list">
      <div
        className={"server uno" + (showDms && !currentServer ? " selected" : "")}
        title={t("dm.title")}
        onClick={onDmClick}
        style={{ cursor: "pointer" }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: "33%",
            background:
              showDms && !currentServer ? "var(--accent-3)" : "var(--bg-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "border-radius 150ms",
          }}
        >
          <MessageIcon size={22} />
        </div>
      </div>

      <hr />

      {serversLoading ? (
        <SkeletonServerList count={4} />
      ) : (
        servers.map((s) => (
          <div
            key={s.id}
            className={
              "server uno" +
              (currentServer && currentServer.id === s.id ? " selected" : "")
            }
            onContextMenu={(e) => openCtx(e, s.id)}
          >
            <img
              onClick={() => handleSelectServer(s)}
              className="server-icon"
              src={getIcon(s)}
              alt={s.name || t("alt.server")}
            />
          </div>
        ))
      )}

      <hr />

      <div className="uno create-server">
        <svg
          className="create-server"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          role="img"
          fill="none"
          viewBox="0 0 90 90"
          onClick={() => setModalOpen(true)}
        >
          <path d="M 45 69.478 c -1.657 0 -3 -1.343 -3 -3 V 23.523 c 0 -1.657 1.343 -3 3 -3 c 1.657 0 3 1.343 3 3 v 42.955 C 48 68.135 46.657 69.478 45 69.478 z" stroke="none" strokeWidth="1" strokeDasharray="none" strokeLinejoin="miter" strokeMiterlimit="10" fill="currentColor" fillRule="nonzero" opacity="1" transform="matrix(1 0 0 1 0 0)" strokeLinecap="round" />
          <path d="M 66.478 48 H 23.523 c -1.657 0 -3 -1.343 -3 -3 c 0 -1.657 1.343 -3 3 -3 h 42.955 c 1.657 0 3 1.343 3 3 C 69.478 46.657 68.135 48 66.478 48 z" stroke="none" strokeWidth="1" strokeDasharray="none" strokeLinejoin="miter" strokeMiterlimit="10" fill="currentColor" fillRule="nonzero" opacity="1" transform="matrix(1 0 0 1 0 0)" strokeLinecap="round" />
          <path d="M 45 90 C 20.187 90 0 69.813 0 45 C 0 20.187 20.187 0 45 0 c 24.813 0 45 20.187 45 45 C 90 69.813 69.813 90 45 90 z M 45 6 C 23.495 6 6 23.495 6 45 s 17.495 39 39 39 s 39 -17.495 39 -39 S 66.505 6 45 6 z" stroke="none" strokeWidth="1" strokeDasharray="none" strokeLinejoin="miter" strokeMiterlimit="10" fill="currentColor" fillRule="nonzero" opacity="1" transform="matrix(1 0 0 1 0 0)" strokeLinecap="round"/>
        </svg>
      </div>

      <CreateServerModal
        className="modal"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      {ctxMenu && (
        <ContextMenu
          items={buildCtxItems(ctxMenu.serverId)}
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}