import { api } from "../api/Http";
import { getMessages } from "../api/MessageApi";
import { getRoles, getServerChannels, getServerMembers, getServers } from "../api/ServerApi";
import { getDmChannels } from "../api/DmApi";
import { useAuthState } from "../state/Auth";
import { useChannelState } from "../state/Channels";
import { useMessageState } from "../state/Messages";
import { useServerState } from "../state/Servers";
import { useUserState } from "../state/Users";
import { useLoadingState } from "../state/Loading";
import { useCacheState, CacheKey } from "../state/Cache";
import { getAllNicknames } from "../api/SocialApi";
import { useNicknames } from "../state/Nicknames";
import { initGateway } from "./GatewayClient";

export async function initializeClient() {
  const { setUserSettings } = useAuthState.getState();

  const ss = useServerState.getState();
  const cs = useChannelState.getState();
  const us = useUserState.getState();
  const ms = useMessageState.getState();

  const loading = useLoadingState.getState();
  const cache = useCacheState.getState();

  loading.setServersLoading(true);
  const servers = await getServers();
  for (const server of servers)
    server.roles = await getRoles(server.id);
  ss.addServers(servers);
  cache.markFresh(CacheKey.servers);
  loading.setServersLoading(false);

  try {
    const dms = await getDmChannels();
    cs.addChannels(dms as any[]);
    cache.markFresh(CacheKey.dms);
  } catch (e) {
    console.warn("Could not fetch DM channels", e);
  }

  const allChannels: any[] = [];

  if (servers.length > 0) {
    const lastServerId = BigInt(
      localStorage.getItem("currentServerId") || servers[0].id
    );
    const targetServer =
      servers.find((s) => s.id === lastServerId) ?? servers[0];
    ss.setCurrentServer(targetServer);

    loading.setChannelsLoading(true);
    for (const server of servers) {
      try {
        const channels = await getServerChannels(server.id);
        allChannels.push(...channels);
        cache.markFresh(CacheKey.channels(server.id));
      } catch (e) {
        console.warn(`Could not load channels for server ${server.id}`, e);
      }
    }
    cs.addChannels(allChannels);
    loading.setChannelsLoading(false);

    loading.setMembersLoading(true);
    try {
      const members = await getServerMembers(targetServer.id);
      us.addMembers(members);
      cache.markFresh(CacheKey.members(targetServer.id));
    } catch (e) {
      console.warn("Could not load members", e);
    }
    loading.setMembersLoading(false);

    const lastChannelId = BigInt(localStorage.getItem("currentChannelId") || 0);
    const serverChannels = allChannels.filter(
      (c) => c.serverId === targetServer.id
    );
    const currentChannel =
      serverChannels.find((c) => c.id === lastChannelId) ??
      serverChannels.find((c) => c.type === 1);

    if (currentChannel) {
      cs.setCurrentChannel(currentChannel);
      loading.setMessagesLoading(true);
      try {
        const msgs = await getMessages(currentChannel.id);
        ms.addMessages(msgs);
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
    const settings = await api("/users/@me/settings");
    setUserSettings(settings);
  } catch (e) {
    console.warn("Could not load user settings", e);
  }

  try {
    const nicknames = await getAllNicknames();
    useNicknames.getState().init(
      nicknames.map(n => ({ subjectId: n.subjectId, nickname: n.nickname }))
    );
  } catch (e) {
    console.warn("Could not load nicknames", e);
  }

  initGateway({
    initialChannels: allChannels,
    initialServers: servers
  });
}