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

  const [servers, dmsResult, settings] = await Promise.all([
    getServers(),
    getDmChannels().catch(() => ({ channels: [], categories: [] })),
    api("/users/@me/settings").catch(() => null),
  ]);

  if (settings)
    setUserSettings(settings);
  cs.addChannels(dmsResult.channels as any[]);
  cs.setDmCategories(dmsResult.categories);
  cache.markFresh(CacheKey.dms);

  const rolesResults = await Promise.all(
    servers.map(s => getRoles(s.id).then(r => ({ serverId: s.id, ...r })).catch(() => ({ serverId: s.id, roles: [], categories: [] })))
  );
  for (const { serverId, roles, categories } of rolesResults) {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      server.roles = roles;
      server.roleCategories = categories;
    }
  }
  ss.addServers(servers);
  cache.markFresh(CacheKey.servers);
  loading.setServersLoading(false);

  if (servers.length === 0) {
    loading.setChannelsLoading(false);
    loading.setMembersLoading(false);
    loading.setMessagesLoading(false);
    initGateway({ initialChannels: [], initialServers: [] });
    return;
  }

  const lastServerId = BigInt(localStorage.getItem("currentServerId") || servers[0].id);
  const targetServer = servers.find(s => s.id === lastServerId) ?? servers[0];
  ss.setCurrentServer(targetServer);
  loading.setChannelsLoading(true);
  loading.setMembersLoading(true);

  const [channelResults, members] = await Promise.all([
    Promise.all(
      servers.map(s =>
        getServerChannels(s.id)
          .then(chs => {
            cache.markFresh(CacheKey.channels(s.id));
            return chs;
          }).catch(() => [])
      )
    ),
    getServerMembers(targetServer.id)
      .then(m => {
        cache.markFresh(CacheKey.members(targetServer.id));
        return m;
      }).catch(() => []),
  ]);

  const allChannels = channelResults.flat();
  cs.addChannels(allChannels);
  loading.setChannelsLoading(false);
  us.addMembers(members);
  loading.setMembersLoading(false);

  const lastChannelId = BigInt(localStorage.getItem("currentChannelId") || 0);
  const serverChannels = allChannels.filter(c => c.serverId === targetServer.id);
  const currentChannel =
    serverChannels.find(c => c.id === lastChannelId) ?? serverChannels.find(c => c.type === 1);

  if (currentChannel) {
    cs.setCurrentChannel(currentChannel);
    loading.setMessagesLoading(true);
    try {
      const msgs = await getMessages(currentChannel.id);
      ms.addMessages(msgs);
      cache.markFresh(CacheKey.messages(currentChannel.id));
    } catch {}
    loading.setMessagesLoading(false);
  } else {
    loading.setMessagesLoading(false);
  }

  initGateway({
    initialChannels: allChannels,
    initialServers: servers
  });
}