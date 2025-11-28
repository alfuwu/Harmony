import { invoke } from '@tauri-apps/api/core';
import { channelState } from '../../lib/state/channels';
import TextChannelLocked from '../svgs/TextChannelLocked';

export default function TitleBar() {
  return (
    <div class="title-bar">
      <div class="title uno">
        {<TextChannelLocked />}
        <span>{channelState.currentChannel()?.name ?? "No channel"}</span>
      </div>
      <div class="window-buttons">
        <button onClick={() => invoke("minimize") /* i couldn't figure out how tauri permissions work */}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <path fill="currentColor" d="M19 13H5v-2h14z" />
          </svg>
        </button>
        <button onClick={() => invoke("toggle_maximize")}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <path fill="currentColor" d="M4 4h16v16H4zm2 2v12h12V6z" />
          </svg>
        </button>
        <button class="close-btn" onClick={() => invoke("close")}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M13.46 12L19 17.54V19h-1.46L12 13.46L6.46 19H5v-1.46L10.54 12L5 6.46V5h1.46L12 10.54L17.54 5H19v1.46z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
