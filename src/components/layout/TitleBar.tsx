import { useChannelState } from '../../lib/state/Channels';
import { getChannelIcon } from '../../lib/utils/ChannelUtils';

export default function TitleBar() {
  const { currentChannel } = useChannelState();
  return (
    <div className="title-bar">
      <div className="title uno">
        {getChannelIcon(currentChannel, { className: "icon" })}
        <span>
          {(currentChannel && currentChannel.name) || "The Void"}
        </span>
      </div>
    </div>
  );
}
