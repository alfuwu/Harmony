import { getServerChannels, getServerMembers, getServers } from "../api/serverApi";
//import { connectRealtime } from "./realtime";

export async function initializeClient({
  token,
  addServers,
  setCurrentServer,
  addChannels,
  setCurrentChannel,
  addMembers
}: {
  token: string,
  addServers: (servers: any[]) => void,
  setCurrentServer: (server: any) => void,
  addChannels: (channels: any[]) => void,
  setCurrentChannel: (channel: any) => void,
  addMembers: (members: any[]) => void
}) {
  if (!token)
    return;

  // fetch servers
  const servers = await getServers({ headers: { Authorization: `Bearer ${token}` } });
  addServers(servers);
  if (servers.length > 0) {
    const lastServerId = Number(localStorage.getItem("currentServerId") || servers[0].id);
    setCurrentServer(servers.find(s => s.id === lastServerId));

    // auto-load channels for each server
    const allChannels = [];
    for (const server of servers) {
      const channels = await getServerChannels(server.id, { headers: { Authorization: `Bearer ${token}` } });
      allChannels.push(...channels);
    }
    addChannels(allChannels);
    setCurrentChannel(allChannels.find(c => c.serverId === lastServerId));

    // load members for the currently viewed server
    const members = await getServerMembers(lastServerId, { headers: { Authorization: `Bearer ${token}` } });
    addMembers(members);
  }

  //connectRealtime(token);
}