import { useState } from "react";
import { useChannelState } from "../../lib/state/Channels";
import { useUserState } from "../../lib/state/Users";
import { useAuthState } from "../../lib/state/Auth";
import { getChannelIcon } from "../../lib/utils/ChannelUtils";
import { ChannelType, DmChannel } from "../../lib/utils/Types";
import { getAvatar, getDisplayName } from "../../lib/utils/UserUtils";
import { searchMessages } from "../../lib/api/ChannelApi";
import { useMessageState } from "../../lib/state/Messages";
import { t, useLocale } from "../../lib/i18n/Index";
import { UsersIcon } from "../svgs/other/Icons";

export default function TitleBar() {
  useLocale();
  const { currentChannel } = useChannelState();
  const { get } = useUserState();
  const { user, token } = useAuthState();
  const { addMessages } = useMessageState();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    if (!currentChannel || !query.trim())
      return;
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
      return { icon: getChannelIcon(currentChannel, { className: "title-icon" }), name: t("title.void") };

    const type = currentChannel.type;

    if (type === ChannelType.DM) {
      const dm = currentChannel as DmChannel;
      const otherId = dm.members?.find(id => id !== user?.id);
      const other = otherId !== undefined ? get(otherId) : undefined;
      return {
        icon: other ? (
          <img src={getAvatar(other)} alt="" style={{ width: 24, height: 24, borderRadius: "50%", marginRight: 6 }} />
        ) : null,
        name: other ? getDisplayName(other) : t("title.dm"),
        sub: other ? `@${other.username}` : undefined,
      };
    }

    if (type === ChannelType.GroupDM) {
      // TODO: make group dms able to have custom image icons
      return {
        icon: <UsersIcon size={14} />,
        name: currentChannel.name ?? t("title.group_dm"),
      };
    }

    return {
      icon: getChannelIcon(currentChannel, { className: "icon" }),
      name: currentChannel.name ?? t("title.channel"),
      sub: currentChannel.description ?? undefined
    };
  }

  const { icon, name, sub } = getTitle();

  return (
    <div className="title-bar" data-tauri-drag-region>
      <div className="title uno">
        {icon}
        <span>{name}</span>
        {sub && <span style={{ fontSize: 12, color: "var(--text-5)", fontWeight: 400, marginLeft: 8 }}>{sub}</span>}
      </div>
    </div>
  );
}