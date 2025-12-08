import { api } from "../api/http";
import { getMessages } from "../api/messageApi";
import { getServerChannels, getServerMembers, getServers } from "../api/serverApi";
import { initSignalR } from "../api/signalrClient";
import { AuthState } from "../state/Auth";
import { ChannelState } from "../state/Channels";
import { MemberState } from "../state/Members";
import { MessageState } from "../state/Messages";
import { ServerState } from "../state/Servers";
import { UserState } from "../state/Users";
import { UserSettings } from "../utils/userSettings";
//import { connectRealtime } from "./realtime";

export async function initializeClient({
  authState,
  serverState,
  channelState,
  messageState,
  memberState,
  userState,
  setUserSettings
}: {
  authState: AuthState;
  serverState: ServerState;
  channelState: ChannelState;
  messageState: MessageState;
  memberState: MemberState;
  userState: UserState;
  setUserSettings: (settings: UserSettings) => void
}) {
  if (!authState.token)
    return;

  const { addServers, setCurrentServer } = serverState;
  const { addChannels, setCurrentChannel } = channelState;
  const { addMessages } = messageState;
  const { addMembers } = memberState;

  // fetch servers
  const servers = await getServers({ headers: { Authorization: `Bearer ${authState.token}` } });
  addServers(servers);
  if (servers.length > 0) {
    const lastServerId = Number(localStorage.getItem("currentServerId") || servers[0].id);
    setCurrentServer(servers.find(s => s.id === lastServerId)!);

    // auto-load channels for each server
    const allChannels = [];
    for (const server of servers) {
      const channels = await getServerChannels(server.id, { headers: { Authorization: `Bearer ${authState.token}` } });
      allChannels.push(...channels);
    }
    addChannels(allChannels);
    const defChannel = allChannels.find(c => c.serverId === lastServerId);
    const currentlChannelId = Number(localStorage.getItem("currentChannelId") || defChannel?.id);
    const currentChannel = allChannels.find(c => c.id === currentlChannelId && c.serverId === lastServerId) || defChannel;
    if (currentChannel) {
      setCurrentChannel(currentChannel);
      addMessages([...await getMessages(currentChannel.id, undefined, { headers: { Authorization: `Bearer ${authState.token}` } })]);
    }

    // load members for the currently viewed server
    const members = await getServerMembers(lastServerId, { headers: { Authorization: `Bearer ${authState.token}` } });
    addMembers(members);
  }

  const settings = await api(`/users/@me/settings`, { headers: { Authorization: `Bearer ${authState.token}` } });
  setUserSettings(settings);

  initSignalR({ authState, serverState, channelState, messageState, memberState, userState });
}