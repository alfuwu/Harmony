import { useState } from "react";
import { useChannelState } from "../../lib/state/Channels";
import { useServerState } from "../../lib/state/Servers";
import { useAuthState } from "../../lib/state/Auth";
import { useUserState } from "../../lib/state/Users";
import { useMessageState } from "../../lib/state/Messages";
import { useLoadingState } from "../../lib/state/Loading";
import { getChannelIcon } from "../../lib/utils/ChannelUtils";
import { ChannelType, AbstractChannel } from "../../lib/utils/types";
import {
  canManageChannels,
  canCreateInvites,
  isOwner,
} from "../../lib/utils/PermissionUtils";
import { deleteChannel } from "../../lib/api/channelApi";
import { getMessages } from "../../lib/api/messageApi";
import { connection, joinChannel } from "../../lib/api/signalrClient";
import { SkeletonChannelList } from "./Skeleton";
import ContextMenu, { ContextMenuItem } from "./ContextMenu";
import CreateChannelModal from "./modals/CreateChannelModal";

export default function ChannelList() {
  const { channels, currentChannel, setCurrentChannel } = useChannelState();
  const { currentServer } = useServerState();
  const { user, token } = useAuthState();
  const { getMember } = useUserState();
  const { addMessages } = useMessageState();
  const { channelsLoading, setMessagesLoading } = useLoadingState();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(
    new Set()
  );
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    channel: AbstractChannel;
  } | null>(null);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const me = currentServer
    ? getMember(user?.id, currentServer.id)
    : undefined;
  const canManage  = canManageChannels(me, currentServer);
  const canInvite  = canCreateInvites(me, currentServer);
  const serverOwner = isOwner(me, currentServer);

  const serverChannels = channels.filter(c => c.serverId === currentServer?.id);

  const categories = serverChannels
    .filter(c => c.channelType === ChannelType.Category)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const uncategorized = serverChannels
    .filter(c => c.channelType !== ChannelType.Category && !c.parentId)
    .sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );

  function getChildren(categoryId: number) {
    return serverChannels
      .filter(c => c.parentId === categoryId && c.channelType !== ChannelType.Category)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  function toggleCategory(id: number) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSelectChannel(c: AbstractChannel) {
    if (currentChannel?.id === c.id)
      return;
    setCurrentChannel(c);
    joinChannel(c.id);
    connection?.invoke("JoinChannel", c.id).catch(() => {});
    localStorage.setItem("currentChannelId", String(c.id));

    setMessagesLoading(true);
    try {
      const msgs = await getMessages(c.id, undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
      addMessages(msgs);
    } catch (e) {
      console.warn("Could not load messages", e);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function handleDeleteChannel(c: AbstractChannel) {
    if (!currentServer)
      return;
    try {
      await deleteChannel(currentServer.id, c.id, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (currentChannel?.id === c.id) setCurrentChannel(null);
    } catch (e) {
      console.error(e);
    }
  }

  function openCtx(e: React.MouseEvent, channel: AbstractChannel) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, channel });
  }

  function buildCtxItems(channel: AbstractChannel): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    if (canManage || serverOwner) {
      items.push({
        label: "Delete Channel",
        icon: "🗑️",
        danger: true,
        onClick: () => handleDeleteChannel(channel),
      });
      items.push({
        label: "Create Channel Here",
        icon: "➕",
        onClick: () => setCreateChannelOpen(true),
      });
    }

    if (canInvite || serverOwner) {
      items.push({
        label: "Copy Invite Link",
        icon: "🔗",
        onClick: () => {
          const url = currentServer?.inviteUrls?.[0];
          if (url) navigator.clipboard.writeText(url);
        },
      });
    }

    items.push({
      label: "Copy Channel ID",
      icon: "🆔",
      onClick: () => navigator.clipboard.writeText(String(channel.id)),
    });

    return items;
  }

  function renderChannel(c: AbstractChannel, indent = false) {
    if (c.channelType === ChannelType.Category)
      return null;
    const isSelected = currentChannel?.id === c.id;
    return (
      <div
        key={c.id}
        className={"channel uno int" + (isSelected ? " selected" : "")}
        style={indent ? { paddingLeft: 20 } : undefined}
        onClick={() => handleSelectChannel(c)}
        onContextMenu={(e) => openCtx(e, c)}
      >
        {getChannelIcon(c, { className: "channel-icon" })}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {c.name ?? "Unnamed"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="channel-list"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div className="server-header uno">
        {currentServer?.name ?? "No server selected"}
      </div>
      <hr />

      {/* Create channel button */}
      {currentServer && (canManage || serverOwner) && (
        <div
          className="channel uno int"
          style={{ color: "var(--text-5)", gap: 6 }}
          onClick={() => setCreateChannelOpen(true)}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
          <span style={{ fontSize: 12 }}>Create Channel</span>
        </div>
      )}

      {channelsLoading ? (
        <SkeletonChannelList />
      ) : (
        <>
          {uncategorized.map(c => renderChannel(c))}

          {categories.map((cat) => {
            const collapsed = collapsedCategories.has(cat.id);
            const children = getChildren(cat.id);
            return (
              <div key={cat.id}>
                <div
                  className="channel-category uno int"
                  onClick={() => toggleCategory(cat.id)}
                  onContextMenu={(e) => openCtx(e, cat)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 8px 4px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-4)",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      marginRight: 4,
                      transition: "transform 150ms",
                      transform: collapsed ? "rotate(-90deg)" : "none",
                    }}
                  >
                    ›
                  </span>
                  {(cat as any).name}
                  {(canManage || serverOwner) && (
                    <span
                      style={{ marginLeft: "auto", fontSize: 16 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCreateChannelOpen(true);
                      }}
                      title="Create channel in category"
                    >
                      ＋
                    </span>
                  )}
                </div>
                {!collapsed && children.map(c => renderChannel(c, true))}
              </div>
            );
          })}
        </>
      )}

      {ctxMenu && (
        <ContextMenu
          items={buildCtxItems(ctxMenu.channel)}
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {currentServer && (
        <CreateChannelModal
          open={createChannelOpen}
          serverId={currentServer.id}
          onClose={() => setCreateChannelOpen(false)}
        />
      )}
    </div>
  );
}