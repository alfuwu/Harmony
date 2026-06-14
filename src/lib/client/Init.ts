import { api } from "../api/Http";
import { getMessages } from "../api/MessageApi";
import { getServerChannels, getServerMembers, getServers } from "../api/ServerApi";
import { getDmChannels } from "../api/DmApi";
import { initSignalR, updateSignalRRefs } from "../api/SignalrClient";
import { AuthState } from "../state/Auth";
import { ChannelState } from "../state/Channels";
import { MessageState } from "../state/Messages";
import { ServerState } from "../state/Servers";
import { UserState } from "../state/Users";
import { UserSettings } from "../utils/UserSettings";
import { useLoadingState } from "../state/Loading";
import { useCacheState, CacheKey } from "../state/Cache";

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
  const cache = useCacheState.getState();

  loading.setServersLoading(true);
  const servers = await getServers({ headers });
  serverState.addServers(servers);
  cache.markFresh(CacheKey.servers);
  loading.setServersLoading(false);

  try {
    const dms = await getDmChannels({ headers });
    channelState.addChannels(dms as any[]);
    cache.markFresh(CacheKey.dms);
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
        cache.markFresh(CacheKey.channels(server.id));
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
      cache.markFresh(CacheKey.members(targetServer.id));
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
      serverChannels.find((c) => c.type === 1);

    if (currentChannel) {
      channelState.setCurrentChannel(currentChannel);
      loading.setMessagesLoading(true);
      try {
        const msgs = await getMessages(currentChannel.id, undefined, undefined, { headers });
        messageState.addMessages(msgs);
        cache.markFresh(CacheKey.messages(currentChannel.id));
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

export function syncSignalRRefs(
  messageState: MessageState,
  channelState: ChannelState,
  serverState: ServerState,
  userState: UserState
) {
  updateSignalRRefs({ messageState, channelState, serverState, userState });
}