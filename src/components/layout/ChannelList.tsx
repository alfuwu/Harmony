import { useChannelState } from "../../lib/state/Channels";
import { useServerState } from "../../lib/state/Servers";
import { getChannelIcon } from "../../lib/utils/ChannelUtils";

export default function ChannelList() {
  const { channels, currentChannel, setCurrentChannel } = useChannelState();
  const { currentServer } = useServerState();

  return (
    <div className="channel-list">
      <div className="server-header uno">
        {(currentServer && currentServer.name) || "No server selected"}
      </div>
      <hr />
      {channels.map(c => (
        c.serverId === currentServer?.id && <div
          key={c.id}
          className={"channel uno int" + (currentChannel && currentChannel.id === c.id ? " selected" : "")}
          onClick={() => setCurrentChannel(c)}
        >
          {getChannelIcon(c, { className: "channel-icon" })}
          {c.name}
        </div>
      ))}
    </div>
  );
}
