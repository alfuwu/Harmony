import { useChannelState } from "../../lib/state/Channels";
import { useServerState } from "../../lib/state/Servers";
import TextChannel from "../svgs/TextChannel";

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
        <div
          key={c.id}
          className={"channel uno" + (currentChannel && currentChannel.id === c.id ? " selected" : "")}
          onClick={() => setCurrentChannel(c)}
        >
          <TextChannel className="channel-icon" />
          {c.name}
        </div>
      ))}
    </div>
  );
}
