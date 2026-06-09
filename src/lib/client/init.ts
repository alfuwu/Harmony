import { api } from "../api/http";
import { getMessages } from "../api/messageApi";
import { getServerChannels, getServerMembers, getServers } from "../api/serverApi";
import { getDmChannels } from "../api/dmApi";
import { initSignalR, updateSignalRRefs } from "../api/signalrClient";
import { AuthState } from "../state/Auth";
import { ChannelState } from "../state/Channels";
import { MessageState } from "../state/Messages";
import { ServerState } from "../state/Servers";
import { UserState } from "../state/Users";
import { UserSettings } from "../utils/userSettings";
import { useLoadingState } from "../state/Loading";

export async function initializeClient({
  authState,
  serverState,
  channelState,
  messageState,
  userState,
  setUserSettings,
}: {
  authState: AuthState;
  serverState: ServerState;
  channelState: ChannelState;
  messageState: MessageState;
  userState: UserState;
  setUserSettings: (settings: UserSettings) => void;
}) {
  if (!authState.token)
    return;

  const token = authState.token;
  const headers = { Authorization: `Bearer ${token}` };
  const loading = useLoadingState.getState();

  loading.setServersLoading(true);
  const servers = await getServers({ headers });
  serverState.addServers(servers);
  loading.setServersLoading(false);

  try {
    const dms = await getDmChannels({ headers });
    channelState.addChannels(dms as any[]);
  } catch (e) {
    console.warn("Could not fetch DM channels", e);
  }

  const allChannels: any[] = [];

  if (servers.length > 0) {
    const lastServerId = Number(
      localStorage.getItem("currentServerId") || servers[0].id
    );
    const targetServer =
      servers.find((s) => s.id === lastServerId) ?? servers[0];
    serverState.setCurrentServer(targetServer);

    loading.setChannelsLoading(true);
    for (const server of servers) {
      try {
        const channels = await getServerChannels(server.id, { headers });
        allChannels.push(...channels);
      } catch (e) {
        console.warn(`Could not load channels for server ${server.id}`, e);
      }
    }
    channelState.addChannels(allChannels);
    loading.setChannelsLoading(false);

    loading.setMembersLoading(true);
    try {
      const members = await getServerMembers(targetServer.id, { headers });
      userState.addMembers(members);
    } catch (e) {
      console.warn("Could not load members", e);
    }
    loading.setMembersLoading(false);

    const lastChannelId = Number(localStorage.getItem("currentChannelId") || 0);
    const serverChannels = allChannels.filter(
      (c) => c.serverId === targetServer.id
    );
    const currentChannel =
      serverChannels.find((c) => c.id === lastChannelId) ??
      serverChannels.find((c) => c.type === 1 /* Text */);

    if (currentChannel) {
      channelState.setCurrentChannel(currentChannel);
      loading.setMessagesLoading(true);
      try {
        const msgs = await getMessages(currentChannel.id, undefined, {
          headers,
        });
        messageState.addMessages(msgs);
      } catch (e) {
        console.warn("Could not load messages", e);
      }
      loading.setMessagesLoading(false);
    } else {
      loading.setMessagesLoading(false);
    }
  } else {
    loading.setChannelsLoading(false);
    loading.setMembersLoading(false);
    loading.setMessagesLoading(false);
  }

  try {
    const settings = await api("/users/@me/settings", { headers });
    setUserSettings(settings);
  } catch (e) {
    console.warn("Could not load user settings", e);
  }

  initSignalR({
    authState,
    serverState,
    channelState,
    messageState,
    userState,
    initialChannels: allChannels,
    initialServers: servers,
  });
}

/**
 * Call every render from the top-level component so SignalR handlers
 * always have the latest React state references.
 */
export function syncSignalRRefs(
  messageState: MessageState,
  channelState: ChannelState,
  serverState: ServerState,
  userState: UserState
) {
  updateSignalRRefs({ messageState, channelState, serverState, userState });
}