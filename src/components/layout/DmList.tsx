import { useAuthState } from "../../lib/state/Auth";
import { useChannelState } from "../../lib/state/Channels";
import { useMessageState } from "../../lib/state/Messages";
import { useUserState } from "../../lib/state/Users";
import { useLoadingState } from "../../lib/state/Loading";
import { getAvatar, getDisplayName } from "../../lib/utils/UserUtils";
import { AbstractChannel, ChannelType, DmChannel, GroupDmChannel, OnlineStatus } from "../../lib/utils/Types";
import { getMessages } from "../../lib/api/MessageApi";
import { joinChannel } from "../../lib/client/GatewayClient";
import { useCacheState, CacheKey } from "../../lib/state/Cache";
import { t, useLocale } from "../../lib/i18n/Index";

const STATUS_COLORS: Record<OnlineStatus, string> = {
  [OnlineStatus.Online]: "var(--online)",
  [OnlineStatus.Idle]: "var(--idle)",
  [OnlineStatus.Focusing]: "var(--blue-2)",
  [OnlineStatus.DND]: "var(--dnd)",
  [OnlineStatus.Offline]: "var(--offline)"
};

export default function DmList() {
  useLocale();
  const { user } = useAuthState();
  const channelState = useChannelState();
  const { get } = useUserState();
  const { addMessages } = useMessageState();
  const { setMessagesLoading } = useLoadingState();

  const hidden: bigint[] = [];//userSettings?.hiddenChannels ?? [];

  const dmChannels = channelState.channels
    .filter(c => {
      const t = c.type;
      return (t === ChannelType.DM || t === ChannelType.GroupDM) &&
        !(c as DmChannel).isDeleted &&
        !hidden.includes(c.id);
    })
    .sort((a, b) => Number(a > b) - Number(a < b));

  async function handleSelect(c: AbstractChannel) {
    if (channelState.currentChannel?.id === c.id)
      return;

    channelState.setCurrentChannel(c);
    joinChannel(c.id);

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

  return (
    <div className="channel-list" style={{ display: "flex", flexDirection: "column" }}>
      <div className="server-header uno">{t("dm.title")}</div>
      <hr />
      {dmChannels.length === 0 && (
        <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-5)" }}>
          {t("dm.empty")}
        </div>
      )}
      {dmChannels.map(c => {
        const type = c.type;
        const isSelected = channelState.currentChannel?.id === c.id;
        const isGroup = type === ChannelType.GroupDM;

        if (isGroup) {
          const gdm = c as GroupDmChannel;
          return (
            <div
              key={c.id}
              className={"channel uno int" + (isSelected ? " selected" : "")}
              style={{ gap: 10, alignItems: "center" }}
              onClick={() => handleSelect(c)}
            >
              <span style={{
                width: 32, height: 32, borderRadius: "33%",
                background: "var(--bg-2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}>
                👥
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {gdm.name ?? t("dm.group")}
              </span>
            </div>
          );
        }

        const dm = c as DmChannel;
        const otherId = dm.dmMembers?.find(id => id !== user?.id);
        const other = otherId !== undefined ? get(otherId) : undefined;
        const name = other ? getDisplayName(other) : t("user.unknown");
        const avatar = getAvatar(other ?? null);
        const status = other?.onlineStatus ?? OnlineStatus.Offline;

        return (
          <div
            key={c.id}
            className={"channel uno int" + (isSelected ? " selected" : "")}
            style={{ gap: 10, alignItems: "center" }}
            onClick={() => handleSelect(c)}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={avatar}
                alt={t("alt.avatar")}
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", display: "block" }}
              />
              <span style={{
                position: "absolute", bottom: -2, right: -2,
                width: 8, height: 8, borderRadius: "50%",
                background: STATUS_COLORS[status],
                border: "2px solid var(--bg-3)",
              }} />
            </div>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}