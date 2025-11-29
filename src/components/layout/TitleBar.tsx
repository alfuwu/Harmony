import { invoke } from '@tauri-apps/api/core';
import TextChannelLocked from '../svgs/TextChannelLocked';
import { useChannelState } from '../../lib/state/Channels';

export default function TitleBar() {
  const { currentChannel } = useChannelState();
  return (
    <div className="title-bar">
      <div className="title uno">
        <TextChannelLocked />
        <span>
          {(currentChannel && currentChannel.name) || "No channel"}
        </span>
      </div>
      <div className="window-buttons">
        <button onClick={() => invoke("minimize")}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M19 13H5v-2h14z" />
          </svg>
        </button>
        <button onClick={() => invoke("toggle_maximize")}> 
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M4 4h16v16H4zm2 2v12h12V6z" />
          </svg>
        </button>
        <button className="close-btn" onClick={() => invoke("close")}> 
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M13.46 12L19 17.54V19h-1.46L12 13.46L6.46 19H5v-1.46L10.54 12L5 6.46V5h1.46L12 10.54L17.54 5H19v1.46z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
