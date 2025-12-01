import { api } from "../api/http";
import { getMessages } from "../api/messageApi";
import { getServerChannels, getServerMembers, getServers } from "../api/serverApi";
import { AbstractChannel, Member, Message, Server } from "../utils/types";
import { UserSettings } from "../utils/userSettings";
//import { connectRealtime } from "./realtime";

export async function initializeClient({
  token,
  addServers,
  setCurrentServer,
  addChannels,
  setCurrentChannel,
  addMembers,
  addMessages,
  setUserSettings
}: {
  token: string,
  addServers: (servers: Server[]) => void,
  setCurrentServer: (server: Server) => void,
  addChannels: (channels: AbstractChannel[]) => void,
  setCurrentChannel: (channel: AbstractChannel) => void,
  addMembers: (members: Member[]) => void,
  addMessages: (messages: Message[]) => void,
  setUserSettings: (settings: UserSettings) => void
}) {
  if (!token)
    return;

  // fetch servers
  const servers = await getServers({ headers: { Authorization: `Bearer ${token}` } });
  addServers(servers);
  if (servers.length > 0) {
    const lastServerId = Number(localStorage.getItem("currentServerId") || servers[0].id);
    setCurrentServer(servers.find(s => s.id === lastServerId)!);

    // auto-load channels for each server
    const allChannels = [];
    for (const server of servers) {
      const channels = await getServerChannels(server.id, { headers: { Authorization: `Bearer ${token}` } });
      allChannels.push(...channels);
    }
    addChannels(allChannels);
    const defChannel = allChannels.find(c => c.serverId === lastServerId);
    const currentlChannelId = Number(localStorage.getItem("currentChannelId") || defChannel?.id);
    const currentChannel = allChannels.find(c => c.id === currentlChannelId && c.serverId === lastServerId) || defChannel;
    if (currentChannel) {
      setCurrentChannel(currentChannel);
      addMessages([...await getMessages(currentChannel.id, undefined, { headers: { Authorization: `Bearer ${token}` } })]);
    }

    // load members for the currently viewed server
    const members = await getServerMembers(lastServerId, { headers: { Authorization: `Bearer ${token}` } });
    addMembers(members);
  }

  const settings = await api(`/users/@me/settings`, { headers: { Authorization: `Bearer ${token}` } });
  setUserSettings(settings);

  //connectRealtime(token);
}