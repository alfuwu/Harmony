import { channelState } from "../../lib/state/channels";
import { serverState } from "../../lib/state/servers";
import TextChannel from "../svgs/TextChannel";

export default function ChannelList() {
  return (
    <div class="channel-list">
      <div class="server-header uno">
        {serverState.currentServer()?.name ?? "No server selected"}
      </div>
      <hr />
      {channelState.channels().map(c => (
        <div
          class={"channel uno" + (channelState.currentChannel() == c ? " selected" : "")}
          onClick={() => channelState.setCurrentChannel(c)}
        >
          {<TextChannel class="channel-icon" />}
          {c.name}
        </div>
      ))}
    </div>
  );
}
