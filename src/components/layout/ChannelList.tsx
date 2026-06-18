import { useState } from "react";
import { getCs } from "../../lib/state/Channels";
import { getSs } from "../../lib/state/Servers";
import { getAs } from "../../lib/state/Auth";
import { getUs } from "../../lib/state/Users";
import { getMs } from "../../lib/state/Messages";
import { useLoadingState } from "../../lib/state/Loading";
import { getChannelIcon, getLastMessage } from "../../lib/utils/ChannelUtils";
import { ChannelType, AbstractChannel } from "../../lib/utils/Types";
import { canManageChannels, canCreateInvites, isOwner } from "../../lib/utils/PermissionUtils";
import { deleteChannel } from "../../lib/api/ChannelApi";
import { getMessages } from "../../lib/api/MessageApi";
import { updateSettings } from "../../lib/api/UserApi";
import { joinChannel } from "../../lib/client/GatewayClient";
import { useCacheState, CacheKey } from "../../lib/state/Cache";
import { t, useLocale } from "../../lib/i18n/Index";
import { SkeletonChannelList } from "./Skeleton";
import ContextMenu, { ContextMenuItem } from "./ContextMenu";
import CreateChannelModal from "./modals/CreateChannelModal";
import ViewRawModal from "./modals/ViewRawModal";
import { BellIcon, BellOffIcon, ChevronRightIcon, CodeBracketsIcon, EyeIcon, EyeOffIcon, HashIcon, InviteIcon, PlusIcon, TrashIcon } from "../svgs/other/Icons";
import UnreadBadge from "./misc/UnreadBadge";
import { useUnread } from "../../lib/state/Unread";

export default function ChannelList() {
  useLocale();

  const { channels, currentChannel, setCurrentChannel } = getCs();
  const { currentServer } = getSs();
  const { user, userSettings, setUserSettings } = getAs();
  const { getMember } = getUs();
  const { addMessages } = getMs();
  const { channelsLoading, setMessagesLoading } = useLoadingState();
  const { isUnread, hasMention } = useUnread();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<bigint>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channel: AbstractChannel } | null>(null);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const me = currentServer ? getMember(user?.id, currentServer.id) : undefined;
  const canManage = canManageChannels(me, currentServer);
  const canInvite = canCreateInvites(me, currentServer);
  const serverOwner = isOwner(me, currentServer);

  const [rawOpen, setRawOpen] = useState<AbstractChannel | null>(null);

  const hidden: bigint[] = []; //userSettings?.hiddenChannels ?? [];
  const muted: bigint[] = []; //userSettings?.mutedChannels ?? [];

  const serverChannels = channels.filter(c => c.serverId === currentServer?.id);
  const visibleChannels = serverChannels.filter(c => !hidden.includes(c.id));
  const hiddenChannels = serverChannels.filter(c => hidden.includes(c.id));

  const categories = visibleChannels
    .filter(c => c.type === ChannelType.Category)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const uncategorized = visibleChannels
    .filter(c => c.type !== ChannelType.Category && !c.parentId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  function getChildren(categoryId: bigint) {
    return visibleChannels
      .filter(c => c.parentId === categoryId && c.type !== ChannelType.Category)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  function toggleCategory(id: bigint) {
    setCollapsedCategories(prev => {
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
    localStorage.setItem("currentChannelId", String(c.id));

    setMessagesLoading(true);
    const cache = useCacheState.getState();
    const key = CacheKey.messages(c.id);
    try {
      if (cache.isStale(key)) {
        const msgs = await getMessages(c.id);
        addMessages(msgs);
        cache.markFresh(key);
      }
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
      await deleteChannel(currentServer.id, c.id);
      if (currentChannel?.id === c.id)
        setCurrentChannel(null);
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleHideChannel(channelId: bigint) {
    if (!userSettings)
      return;
    const isHidden = hidden.includes(channelId);
    const next = {
      ...userSettings,
      hiddenChannels: isHidden
        ? hidden.filter(id => id !== channelId)
        : [...hidden, channelId],
    };
    setUserSettings(next);
    try {
      await updateSettings(next);
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleMuteChannel(channelId: bigint) {
    if (!userSettings)
      return;
    const isMuted = muted.includes(channelId);
    const next = {
      ...userSettings,
      mutedChannels: isMuted
        ? muted.filter(id => id !== channelId)
        : [...muted, channelId],
    };
    setUserSettings(next);
    try {
      await updateSettings(next);
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
    const isMuted = muted.includes(channel.id);
    const isHidden = hidden.includes(channel.id);
    const items: ContextMenuItem[] = [];

    if (canManage) {
      items.push({
        label: t("channel.delete"), icon: <TrashIcon size={14} />, danger: true,
        onClick: () => handleDeleteChannel(channel)
      });
      items.push({
        label: t("channel.create_here"), icon: <PlusIcon size={14} />,
        onClick: () => setCreateChannelOpen(true)
      });
    }

    if (canInvite) {
      items.push({
        label: t("channel.copy_invite"), icon: <InviteIcon size={14} />,
        onClick: () => {
          const url = currentServer?.inviteUrls?.[0];
          if (url) navigator.clipboard.writeText(url);
        }
      });
    }

    items.push({ label: "", onClick: () => {}, divider: true });
    items.push({
      label: isMuted ? t("channel.unmute") : t("channel.mute"),
      icon: isMuted ? <BellIcon size={14} /> : <BellOffIcon size={14} />,
      onClick: () => toggleMuteChannel(channel.id)
    });
    items.push({
      label: isHidden ? t("channel.unhide") : t("channel.hide"),
      icon: isHidden ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />,
      onClick: () => toggleHideChannel(channel.id)
    });
    if (userSettings?.developerMode) {
      items.push({ label: "", onClick: () => {}, divider: true });
      items.push({
        label: t("channel.copy_id"), icon: <HashIcon size={14} />,
        onClick: () => navigator.clipboard.writeText(String(channel.id))
      });
      items.push({
        label: "View Raw", icon: <CodeBracketsIcon size={14} />,
        onClick: () => setRawOpen(channel)
      });
    }

    return items;
  }

  function renderChannel(c: AbstractChannel, indent = false) {
    if (c.type === ChannelType.Category)
      return null;
    const isSelected = currentChannel?.id === c.id;
    const isMuted = muted.includes(c.id);
    const unread = isUnread(c.id, getLastMessage(c.id));
    const mention = hasMention(c.id);
    return (
      <div
        key={c.id}
        className={"channel uno int" + (isSelected ? " selected" : "")}
        style={{
          ...(indent ? { paddingLeft: 20 } : undefined),
          ...(isMuted ? { opacity: 0.55 } : undefined),
        }}
        onClick={() => handleSelectChannel(c)}
        onContextMenu={(e) => openCtx(e, c)}
      >
        {getChannelIcon(c, { className: "channel-icon" })}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {c.name ?? t("channel.unnamed")}
        </span>
        {(mention || unread) && !isSelected && (
          <UnreadBadge mention={mention} style={{ marginLeft: "auto" }} />
        )}
        {isMuted && (
          <BellOffIcon size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
        )}
      </div>
    );
  }

  return (
    <div className="channel-list" style={{ display: "flex", flexDirection: "column" }}>
      <div className="server-header uno">
        {currentServer?.name ?? t("channel.no_server")}
      </div>
      <hr />

      {currentServer && (canManage || serverOwner) && (
        <div
          className="channel uno int"
          style={{ color: "var(--text-5)", gap: 6 }}
          onClick={() => setCreateChannelOpen(true)}
        >
          <PlusIcon size={18} style={{ lineHeight: 1 }} />
          <span style={{ fontSize: 12 }}>{t("channel.create")}</span>
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
                    display: "flex", alignItems: "center",
                    padding: "12px 8px 4px", fontSize: 12,
                    fontWeight: 700, color: "var(--text-4)",
                    letterSpacing: "0.05em", textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ marginRight: 4, transition: "transform 150ms", transform: collapsed ? "rotate(-90deg)" : "none" }}>
                    <ChevronRightIcon size={14} />
                  </span>
                  {cat.name}
                  {(canManage || serverOwner) && (
                    <span
                      style={{ marginLeft: "auto", fontSize: 16 }}
                      onClick={(e) => { e.stopPropagation(); setCreateChannelOpen(true); }}
                      title={t("channel.create_in_category")}
                    >
                      
                    </span>
                  )}
                </div>
                {!collapsed && children.map(c => renderChannel(c, true))}
              </div>
            );
          })}

          {hiddenChannels.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div
                className="channel-category uno int"
                onClick={() => setShowHidden(v => !v)}
                style={{
                  display: "flex", alignItems: "center",
                  padding: "4px 8px", fontSize: 11,
                  fontWeight: 700, color: "var(--text-5)",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                <span style={{ marginRight: 4, transition: "transform 150ms", transform: showHidden ? "rotate(0deg)" : "rotate(-90deg)" }}>
                  <ChevronRightIcon size={14} />
                </span>
                {t("channel.hidden_count", { count: hiddenChannels.length })}
              </div>
              {showHidden && hiddenChannels.map(c => (
                <div
                  key={c.id}
                  className="channel uno"
                  style={{ opacity: 0.4, gap: 6 }}
                  onContextMenu={(e) => openCtx(e, c)}
                >
                  {getChannelIcon(c, { className: "channel-icon" })}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontSize: 12 }}>
                    {c.name ?? t("channel.unnamed")}
                  </span>
                  <button
                    title={t("channel.unhide_title")}
                    onClick={(e) => { e.stopPropagation(); toggleHideChannel(c.id); }}
                    style={{
                      background: "none", border: "none", boxShadow: "none",
                      padding: "0 2px", color: "var(--text-5)",
                      cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    <EyeIcon size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
      
      {rawOpen && (
        <ViewRawModal
          title="json.raw_channel"
          data={rawOpen}
          onClose={() => { setRawOpen(null); setCtxMenu(null); }}
        />
      )}
    </div>
  );
}