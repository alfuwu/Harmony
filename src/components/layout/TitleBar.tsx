import { useRef, useState } from "react";
import { useChannelState } from "../../lib/state/Channels";
import { useUserState } from "../../lib/state/Users";
import { useAuthState } from "../../lib/state/Auth";
import { useMessageState } from "../../lib/state/Messages";
import { getChannelIcon } from "../../lib/utils/ChannelUtils";
import { ChannelType, DmChannel } from "../../lib/utils/Types";
import { getAvatar, getDisplayName } from "../../lib/utils/UserUtils";
import { searchMessages } from "../../lib/api/ChannelApi";
import { t, useLocale } from "../../lib/i18n/Index";
import { CloseIcon, SearchIcon, UsersIcon } from "../svgs/other/Icons";
import { useServerState } from "../../lib/state/Servers";
import { makeMarkdownContext } from "../../lib/utils/Funcs";
import { RenderMarkdown } from "../../lib/utils/MarkdownRenderer";

export default function TitleBar() {
  useLocale();

  const { currentServer } = useServerState();
  const { currentChannel } = useChannelState();
  const { get } = useUserState();
  const { user } = useAuthState();
  const { addMessages } = useMessageState();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const spoilerState = useRef<Map<number, boolean>>(new Map());

  async function handleSearch() {
    if (!currentChannel || !query.trim())
      return;
    setSearching(true);
    try {
      const results = await searchMessages(currentChannel.id, query.trim(), 0);
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
      const otherId = dm.dmMembers?.find(id => id !== user?.id);
      const other = otherId !== undefined ? get(otherId) : undefined;
      return {
        icon: other ? (
          <img src={getAvatar(other)} alt="" style={{ width: 24, height: 24, borderRadius: "50%", marginRight: 6 }} />
        ) : null,
        name: other ? getDisplayName(other) : t("title.dm"),
        sub: other ? `@${other.username}` : undefined
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
  const markdownData = makeMarkdownContext();

  return (
    <div className="title-bar" data-tauri-drag-region>
      <div className="title uno">
        {icon}
        <span>{name}</span>
        {sub && (
          <span style={{ fontSize: 12, color: "var(--text-5)", fontWeight: 400, marginLeft: 16 }}>
            <span className="bmr">•</span>
            {RenderMarkdown({ content: sub, spoilerStateRef: spoilerState, allowBlocks: false, maxLength: 128, ...markdownData })}
          </span>
        )}
      </div>
      {currentChannel && (<>
        <input
          value={query}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setSearchOpen(false)}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter")
              handleSearch();
            if (e.key === "Escape") {
              setSearchOpen(false);
              setQuery(searchRef.current!.value = "");
            }
          }}
          placeholder={`Search ${currentServer?.name}...`}
          style={{
            background: "var(--bg-1)", border: "1px solid var(--border)", marginLeft: "auto",
            borderRadius: 6, padding: "4px 10px", color: "var(--text-2)", fontSize: 13,
            boxShadow: "none"
          }}
          ref={searchRef}
        />
        {/* 
          * TODO: implement actual display for search results (replace member list?)
          * TODO: implement search filters (from, date (during/before/after), in (channel), has (image/link/video/audio/3d model/attachment/embed), pinned, NOT(filter), "exact match", ...)
          */}
        <button
          onClick={() => { if (searchOpen) setQuery(searchRef.current!.value = ""); else searchRef.current?.focus(); setSearchOpen(!searchOpen); }}
          title={searchOpen ? "Close search" : "Search messages"}
          style={{ background: "none", border: "none", boxShadow: "none", color: "var(--text-4)", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", flexShrink: 0 }}
          data-tauri-drag-region={false}
        >
          {searchOpen ? <CloseIcon size={16} /> : <SearchIcon size={16} />}
        </button>
      </>)}
    </div>
  );
}