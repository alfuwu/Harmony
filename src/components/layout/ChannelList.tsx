import { channelState } from "../../lib/state/channels";

export default function ChannelList() {
  return (
    <div>
      {channelState.channels().map(c => (
        <div
          style="padding: 8px; cursor: pointer;"
          onClick={() => channelState.setCurrentChannel(c.id)}
        >
          {c.name}
        </div>
      ))}
    </div>
  );
}
