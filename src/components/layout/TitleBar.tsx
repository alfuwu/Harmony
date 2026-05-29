import { useState } from "react";
import { useChannelState } from "../../lib/state/Channels";
import { useUserState } from "../../lib/state/Users";
import { useAuthState } from "../../lib/state/Auth";
import { getChannelIcon } from "../../lib/utils/ChannelUtils";
import { ChannelType, DmChannel } from "../../lib/utils/types";
import { getAvatar, getDisplayName } from "../../lib/utils/UserUtils";
import { searchMessages } from "../../lib/api/channelApi";
import { useMessageState } from "../../lib/state/Messages";

export default function TitleBar() {
  const { currentChannel } = useChannelState();
  const { get } = useUserState();
  const { user, token } = useAuthState();
  const { addMessages } = useMessageState();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    if (!currentChannel || !query.trim()) return;
    setSearching(true);
    try {
      const results = await searchMessages(
        currentChannel.id, query.trim(), 0,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      addMessages(results);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  }

  function getTitle(): { icon: React.ReactNode; name: string; sub?: string } {
    if (!currentChannel)
      return { icon: getChannelIcon(currentChannel, { className: "icon" }), name: "The Void" };

    const type = currentChannel.channelType;

    if (type === ChannelType.DM) {
      const dm = currentChannel as DmChannel;
      const otherId = dm.members?.find(id => id !== user?.id);
      const other = otherId ? get(otherId) : undefined;
      return {
        icon: other ? (
          <img src={getAvatar(other)} alt="" style={{ width: 20, height: 20, borderRadius: "50%", marginRight: 6 }} />
        ) : null,
        name: other ? getDisplayName(other) : "DM",
        sub: other ? `@${other.username}` : undefined,
      };
    }

    if (type === ChannelType.GroupDM) {
      return {
        icon: "👥",
        name: currentChannel.name ?? "Group DM",
      };
    }

    return {
      icon: getChannelIcon(currentChannel, { className: "icon" }),
      name: currentChannel.name ?? "Channel",
      sub: currentChannel.description ?? undefined,
    };
  }

  const { icon, name, sub } = getTitle();

  return (
    <div className="title-bar">
      <div className="title uno">
        {icon}
        <span>{name}</span>
        {sub && <span style={{ fontSize: 12, color: "var(--text-5)", fontWeight: 400, marginLeft: 8 }}>{sub}</span>}
      </div>
    </div>
  );
}