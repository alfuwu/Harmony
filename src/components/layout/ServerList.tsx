import { useServerState } from "../../lib/state/Servers";
import { Server } from "../../lib/utils/types";

export default function ServerList() {
  const { servers, currentServer, setCurrentServer } = useServerState();
  const onServerClick = (s: Server) => setCurrentServer(s);
  return (
    <div className="server-list">
      {servers.map(s => (
        <div
          key={s.id}
          className={"server uno" + (currentServer && currentServer.id === s.id ? " selected" : "")}
          onClick={() => setCurrentServer(s)}
        >
          <img onClick={() => onServerClick(s)} className="server-icon" src={s.icon ? "https://" + s.icon : "https://cdn.discordapp.com/emojis/1327190606535069726.png"} alt={s.name || "server"} />
        </div>
      ))}
    </div>
  );
}
