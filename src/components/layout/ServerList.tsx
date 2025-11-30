import { useState } from "react";
import { loadServer } from "../../lib/api/serverApi";
import { useAuthState } from "../../lib/state/Auth";
import { useChannelState } from "../../lib/state/Channels";
import { useMemberState } from "../../lib/state/Members";
import { useServerState } from "../../lib/state/Servers";
import CreateServerModal from "./modals/CreateSeverModal";

export default function ServerList() {
  const { token } = useAuthState();
  const { servers, currentServer, setCurrentServer } = useServerState();
  const [modalOpen, setModalOpen] = useState(false);
  const channelState = useChannelState();
  const memberState = useMemberState();

  return (
    <div className="server-list">
      <hr style={{ width: "calc(100% - 20px)" }} />
      {servers.map(s => (
        <div
          key={s.id}
          className={"server uno" + (currentServer && currentServer.id === s.id ? " selected" : "")}
        >
          <img onClick={() => { loadServer(s, channelState, memberState, token!); setCurrentServer(s); channelState.setCurrentChannel(null); }} className="server-icon" src={s.icon ? "https://" + s.icon : "https://cdn.discordapp.com/emojis/1327190606535069726.png"} alt={s.name || "server"} />
        </div>
      ))}
      <hr style={{ width: "calc(100% - 20px)" }} />
      <div className="uno create-server">
        <svg
          className="create-server"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          role="img"
          fill="none"
          viewBox="0 0 90 90"
          onClick={() => setModalOpen(true)}
        >
          <path d="M 45 69.478 c -1.657 0 -3 -1.343 -3 -3 V 23.523 c 0 -1.657 1.343 -3 3 -3 c 1.657 0 3 1.343 3 3 v 42.955 C 48 68.135 46.657 69.478 45 69.478 z" stroke="none" strokeWidth="1" strokeDasharray="none" strokeLinejoin="miter" strokeMiterlimit="10" fill="currentColor" fillRule="nonzero" opacity="1" transform="matrix(1 0 0 1 0 0)" strokeLinecap="round" />
          <path d="M 66.478 48 H 23.523 c -1.657 0 -3 -1.343 -3 -3 c 0 -1.657 1.343 -3 3 -3 h 42.955 c 1.657 0 3 1.343 3 3 C 69.478 46.657 68.135 48 66.478 48 z" stroke="none" strokeWidth="1" strokeDasharray="none" strokeLinejoin="miter" strokeMiterlimit="10" fill="currentColor" fillRule="nonzero" opacity="1" transform="matrix(1 0 0 1 0 0)" strokeLinecap="round" />
          <path d="M 45 90 C 20.187 90 0 69.813 0 45 C 0 20.187 20.187 0 45 0 c 24.813 0 45 20.187 45 45 C 90 69.813 69.813 90 45 90 z M 45 6 C 23.495 6 6 23.495 6 45 s 17.495 39 39 39 s 39 -17.495 39 -39 S 66.505 6 45 6 z" stroke="none" strokeWidth="1" strokeDasharray="none" strokeLinejoin="miter" strokeMiterlimit="10" fill="currentColor" fillRule="nonzero" opacity="1" transform="matrix(1 0 0 1 0 0)" strokeLinecap="round"/>
        </svg>
      </div>
      
      <CreateServerModal className="modal" open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
