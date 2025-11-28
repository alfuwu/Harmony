import { serverState } from "../../lib/state/servers";
import { Server } from "../../lib/utils/types";

export default function ServerList() {
  const onServerClick = (s: Server) => {
    serverState.setCurrentServer(s);
  }

  return (
    <div class="server-list">
      {serverState.servers().map(s => (
        <div
          class={"server uno" + (serverState.currentServer() == s ? " selected" : "")}
          onClick={() => serverState.setCurrentServer(s)}
        >
          <img onClick={() => onServerClick(s)} class="server-icon" src={s.icon ? "https://" + s.icon : "https://cdn.discordapp.com/emojis/1327190606535069726.png"} />
        </div>
      ))}
    </div>
  );
}
