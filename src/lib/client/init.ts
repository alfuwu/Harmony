import { api } from "../api/http";
//import { connectRealtime } from "./realtime";

export async function initializeClient({
  token,
  setServers,
  setCurrentServer,
  setChannels,
  setCurrentChannel,
  setMembers
}: {
  token: string,
  setServers: (servers: any[]) => void,
  setCurrentServer: (server: any) => void,
  setChannels: (channels: any[]) => void,
  setCurrentChannel: (channel: any) => void,
  setMembers: (members: any[]) => void
}) {
  if (!token)
    return;

  // fetch servers
  const servers = await api("/servers", { headers: { Authorization: `Bearer ${token}` } });
  setServers(servers);
  setCurrentServer(servers[0]);

  // auto-load channels for each server
  const allChannels = [];
  for (const server of servers) {
    const channels = await api(`/servers/${server.id}/channels`, { headers: { Authorization: `Bearer ${token}` } });
    allChannels.push(...channels);
  }
  setChannels(allChannels);
  setCurrentChannel(allChannels[0]);

  // load members for the currently viewed server
  const lastServerId = Number(localStorage.getItem("currentServerId"));
  if (lastServerId) {
    const members = await api(`/servers/${lastServerId}/members`, { headers: { Authorization: `Bearer ${token}` } });
    setMembers(members);
  }

  //connectRealtime(token);
}