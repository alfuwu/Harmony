import { api } from "../api/http";
import { authState } from "../state/auth";
import { serverState } from "../state/servers";
import { channelState } from "../state/channels";
import { memberState } from "../state/members";
//import { connectRealtime } from "./realtime";

export async function initializeClient() {
  const token = authState.token();
  if (!token)
    return;

  // fetch servers
  const servers = await api("/servers");
  serverState.setServers(servers);
  serverState.setCurrentServer(servers[0]);

  // auto-load channels for each server
  const allChannels = [];
  for (const server of servers) {
    const channels = await api(`/servers/${server.id}/channels`);
    allChannels.push(...channels);
  }
  channelState.setChannels(allChannels);
  channelState.setCurrentChannel(allChannels[0]);

  // load members for the currently viewed server
  const lastServerId = Number(localStorage.getItem("currentServerId"));
  if (lastServerId) {
    const members = await api(`/servers/${lastServerId}/members`);
    memberState.setMembers(members);
  }

  //connectRealtime(token);
}