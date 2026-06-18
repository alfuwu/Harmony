import { useCallback, useRef, useState } from "react";
import { loadServer, leaveServer } from "../../lib/api/ServerApi";
import { useChannelState } from "../../lib/state/Channels";
import { useServerState } from "../../lib/state/Servers";
import { useLoadingState } from "../../lib/state/Loading";
import { SkeletonServerList } from "./Skeleton";
import CreateServerModal from "./modals/CreateSeverModal";
import ContextMenu, { ContextMenuItem } from "./ContextMenu";
import { joinServer } from "../../lib/client/GatewayClient";
import { hostUrl } from "../../App";
import { getIcon } from "../../lib/utils/ServerUtils";
import { t, useLocale } from "../../lib/i18n/Index";
import { BellIcon, CodeBracketsIcon, GearIcon, HashIcon, InviteIcon, LogOutIcon, MessageIcon, PlusIcon } from "../svgs/other/Icons";
import { Server } from "../../lib/utils/Types";
import UnreadBadge from "./misc/UnreadBadge";
import ViewRawModal from "./modals/ViewRawModal";
import { ServerFolder, useServerArrangement } from "../../lib/state/ServerArrangement";
import { useUnread } from "../../lib/state/Unread";
import { getChannelIds } from "../../lib/utils/ChannelUtils";
import { getAs, userSettings } from "../../lib/state/Auth";
import { hasPermission, Permission } from "../../lib/utils/PermissionUtils";
import { getUs } from "../../lib/state/Users";
import ServerSettingsModal from "./modals/ServerSettingsModal";
import { BigJSON } from "../../lib/utils/JSON";

function ServerIcon({
  server,
  active,
  unread,
  mention,
  dragging,
  onPointerDown,
  onClick,
  onContextMenu
}: {
  server: Server;
  active: boolean;
  unread: boolean;
  mention: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        marginBottom: 8,
        userSelect: "none",
        opacity: dragging ? 0.3 : 1,
        transition: dragging ? "none" : "opacity 120ms"
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -8,
          width: 4,
          borderRadius: 2,
          background: "var(--text-1)",
          height: active ? 40 : unread ? 8 : hovered ? 20 : 0,
          transition: "height 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          top: "50%",
          transform: "translateY(-50%)"
        }}
      />

      <div
        onPointerDown={onPointerDown}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 48,
          height: 48,
          borderRadius: active || hovered ? 16 : "50%",
          overflow: "hidden",
          cursor: "pointer",
          background: server.icon ? "transparent" : "var(--bg-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-2)",
          transition: "border-radius 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          flexShrink: 0,
          boxShadow: active
            ? "0 0 0 3px color-mix(in hsl, var(--accent-1), transparent 60%)"
            : "none"
        }}
      >
        {server.icon
          ? getIcon(server)
          : server.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
        }
      </div>

      {(unread || mention) && !active && (
        <div style={{ position: "absolute", bottom: 0, right: 0 }}>
          <UnreadBadge mention={mention} />
        </div>
      )}
    </div>
  );
}

function FolderItem({
  folder,
  servers,
  currentServerId,
  unreadMap,
  mentionMap,
  onSelect,
  onContextMenu,
  onFolderContextMenu
}: {
  folder: ServerFolder;
  servers: Server[];
  currentServerId?: bigint | null;
  unreadMap: Map<bigint, boolean>;
  mentionMap: Map<bigint, boolean>;
  onSelect: (s: Server) => void;
  onContextMenu: (e: React.MouseEvent, s: Server) => void;
  onFolderContextMenu: (e: React.MouseEvent, folder: ServerFolder) => void;
}) {
  const toggleFolder = useServerArrangement(s => s.toggleFolder);
  const folderUnread  = folder.serverIds.some(id => unreadMap.get(id));
  const folderMention = folder.serverIds.some(id => mentionMap.get(id));
  const color = folder.color ?? "var(--accent-1)";

  if (folder.collapsed) {
    return (
      <div
        style={{ position: "relative", marginBottom: 8 }}
        onContextMenu={e => onFolderContextMenu(e, folder)}
      >
        <div
          onClick={() => toggleFolder(folder.id)}
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            background: `color-mix(in hsl, ${color}, transparent 80%)`,
            border: `2px solid ${color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
            color,
            flexShrink: 0
          }}
          title={folder.name}
        >
          {folder.name.slice(0, 2).toUpperCase()}
        </div>
        {(folderUnread || folderMention) && (
          <div style={{ position: "absolute", bottom: 0, right: 0 }}>
            <UnreadBadge mention={folderMention} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 8,
        background: `color-mix(in hsl, ${color}, transparent 91%)`,
        border: `1px solid color-mix(in hsl, ${color}, transparent 72%)`,
        borderRadius: 16,
        padding: "6px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6
      }}
    >
      <div
        onClick={() => toggleFolder(folder.id)}
        onContextMenu={e => onFolderContextMenu(e, folder)}
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          cursor: "pointer",
          padding: "2px 8px",
          borderRadius: 6,
          textAlign: "center",
          maxWidth: 48,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
        title={`Collapse ${folder.name}`}
      >
        {folder.name}
      </div>
      {servers.map(s => (
        <ServerIcon
          key={s.id}
          server={s}
          active={currentServerId === s.id}
          unread={unreadMap.get(s.id) ?? false}
          mention={mentionMap.get(s.id) ?? false}
          dragging={false}
          onPointerDown={() => {}}
          onClick={() => onSelect(s)}
          onContextMenu={e => onContextMenu(e, s)}
        />
      ))}
    </div>
  );
}

interface Props {
  onDmClick: () => void;
  showDms: boolean;
}

export default function ServerList({ onDmClick, showDms }: Props) {
  useLocale();

  const { servers, currentServer, setCurrentServer, removeServer } = useServerState();
  const { setCurrentChannel } = useChannelState();
  const { serversLoading, setChannelsLoading, setMembersLoading, setMessagesLoading } =
    useLoadingState();

  const { order, folders, init, move } = useServerArrangement();
  const { serverHasUnread, hasMention } = useUnread();

  const [modalOpen, setModalOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; server: Server } | null>(null);

  const prevIds = useRef<bigint[]>([]);
  const ids = servers.map(s => s.id);
  if (BigJSON.stringify(ids) !== BigJSON.stringify(prevIds.current)) {
    prevIds.current = ids;
    init(ids);
  }

  const unreadMap: Map<bigint, boolean> = new Map();
  const mentionMap: Map<bigint, boolean> = new Map();
  for (const s of servers) {
    const channelIds = getChannelIds(s.id);
    unreadMap.set(s.id, serverHasUnread(channelIds));
    mentionMap.set(s.id, channelIds.some(hasMention));
  }

  const serverMap = new Map(servers.map(s => [s.id, s]));

  const dragIdx = useRef<number | null>(null);
  const [draggingOrderIdx, setDraggingOrderIdx] = useState<number | null>(null);
  const dragStartY = useRef(0);

  const [notifOpen, setNotifOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState<Server | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [folderPickOpen,  setFolderPickOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent, orderIdx: number) => {
    e.preventDefault();
    dragIdx.current = orderIdx;
    dragStartY.current = e.clientY;
    setDraggingOrderIdx(orderIdx);

    function onMove(ev: PointerEvent) {
      if (dragIdx.current == null)
        return;
      const delta = ev.clientY - dragStartY.current;
      const steps = Math.round(delta / 56); // 48px icon + 8px gap ≈ 56
      if (steps === 0)
        return;
      const next = Math.max(0, Math.min(order.length - 1, dragIdx.current + steps));
      if (next !== dragIdx.current) {
        move(dragIdx.current, next);
        dragIdx.current = next;
        dragStartY.current = ev.clientY;
        setDraggingOrderIdx(next);
      }
    }

    function onUp() {
      dragIdx.current = null;
      setDraggingOrderIdx(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [order, move]);

  async function handleSelectServer(s: any) {
    setChannelsLoading(true);
    setMembersLoading(true);
    setMessagesLoading(true);

    try {
      await loadServer(s);
    } finally {
      setChannelsLoading(false);
      setMembersLoading(false);
      setMessagesLoading(false);
    }

    setCurrentServer(s);
    setCurrentChannel(null);
    localStorage.setItem("currentServerId", String(s.id));
    joinServer(s.id);
  }

  async function handleLeaveServer(serverId: bigint) {
    try {
      await leaveServer(serverId);
      removeServer(serverId);
      if (currentServer?.id === serverId) {
        setCurrentServer(null);
        setCurrentChannel(null);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function openCtx(e: React.MouseEvent, server: Server) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, server });
  }

  function buildCtxItems(server: Server): ContextMenuItem[] {
    if (!server)
      return [];

    const items: ContextMenuItem[] = [
      {
        label: "Notification level...",
        icon: <BellIcon size={16} />,
        onClick: () => setNotifOpen(true)
      }
    ];

    if (server.inviteUrls?.[0]) {
      items.push({
        label: t("server.copy_invite"),
        icon: <InviteIcon size={16} />,
        onClick: () =>
          navigator.clipboard.writeText(
            `${hostUrl}/invite/${server.inviteUrls![0]}`
          )
      });
    }

    if (hasPermission(getUs().getMember(getAs().user?.id, server.id), server, Permission.ManageServer)) {
      items.push({
        label: "Server Settings",
        icon: <GearIcon size={16} />,
        onClick: () => setSettingsOpen(true)
      })
    }

    if (userSettings()?.developerMode) {
      items.push({ label: "", onClick: () => {}, divider: true });
      items.push({
        label: t("server.copy_id"),
        icon: <HashIcon size={16} />,
        onClick: () => navigator.clipboard.writeText(String(server.id))
      })
      items.push({
        label: "View Raw",
        icon: <CodeBracketsIcon size={16} />,
        onClick: () => setRawOpen(server)
      })
    }

    items.push({ label: "", onClick: () => {}, divider: true });
    items.push({
      label: t("server.leave"),
      icon: <LogOutIcon size={16} />,
      danger: true,
      onClick: () => handleLeaveServer(server.id)
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
        <>
          {order.map((item, idx) => {
            if (typeof item === "string") {
              const folder = folders[item];
              if (!folder)
                return null;
              const folderServers = folder.serverIds
                .map(id => serverMap.get(id))
                .filter(Boolean) as Server[];

              return (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  servers={folderServers}
                  currentServerId={currentServer?.id}
                  unreadMap={unreadMap}
                  mentionMap={mentionMap}
                  onSelect={handleSelectServer}
                  onContextMenu={openCtx}
                  onFolderContextMenu={() => {}}
                />
              );
            }

            const server = serverMap.get(item);
            if (!server)
              return null;

            return (
              <ServerIcon
                key={server.id}
                server={server}
                active={currentServer?.id !== undefined && currentServer?.id === server.id}
                unread={unreadMap.get(server.id) ?? false}
                mention={mentionMap.get(server.id) ?? false}
                dragging={draggingOrderIdx === idx}
                onPointerDown={e => onPointerDown(e, idx)}
                onClick={() => handleSelectServer(server)}
                onContextMenu={e => openCtx(e, server)}
              />
            );
          })}
        </>
      )}

      <hr />

      <div className="uno create-server" onClick={() => setModalOpen(true)}>
        <PlusIcon className="create-server" size={32} />
      </div>

      <CreateServerModal
        className="modal"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      {ctxMenu && (
        <ContextMenu
          items={buildCtxItems(ctxMenu.server)}
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {rawOpen && (
        <ViewRawModal
          title="json.raw_server"
          data={rawOpen}
          onClose={() => { setRawOpen(null); setCtxMenu(null); }}
        />
      )}

      <ServerSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}