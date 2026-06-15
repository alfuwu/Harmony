import * as signalR from "@microsoft/signalr";
import { hostUrl } from "../../App";
import { getAs } from "../state/Auth";
import { getMs } from "../state/Messages";
import { getCs } from "../state/Channels";
import { getSs } from "../state/Servers";
import { getUs } from "../state/Users";
import { AbstractChannel, Presence, Server, VoiceState } from "../utils/Types";
import { useCacheState, CacheKey } from "../state/Cache";
import { isMentioned, sendDesktopNotification } from "../utils/Funcs";
import { getServerId } from "../utils/ChannelUtils";
import { useUnread } from "../state/Unread";

export let connection: signalR.HubConnection | null = null;

let _heartbeatHandle: ReturnType<typeof setInterval> | null = null;
const _typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function startHeartbeat() {
  stopHeartbeat();
  _heartbeatHandle = setInterval(() => {
    connection?.invoke("Heartbeat").catch(() => {});
  }, 30_000);
}

function stopHeartbeat() {
  if (_heartbeatHandle !== null) {
    clearInterval(_heartbeatHandle);
    _heartbeatHandle = null;
  }
}

export function initSignalR({
  initialChannels = [],
  initialServers = []
}: {
  initialChannels?: AbstractChannel[];
  initialServers?: Server[];
}) {
  if (connection) {
    stopHeartbeat();
    connection.stop();
    connection = null;
  }

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${hostUrl}/gateway`, {
      accessTokenFactory: () => getAs().token || ""
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  connection.on("RecvMsg", (msg) => {
    getMs().addMessage({ ...msg, sending: false });

    const cs = getCs();
    const uid = getAs().user?.id;
    const currentChannelId = cs.currentChannel?.id;
    if (msg.channelId !== currentChannelId && uid != null) {
      const mention = isMentioned(msg, uid, getServerId(msg.channelId));
      useUnread.getState().receive(msg.channelId, msg.id, mention);

      const author = getUs().get(msg.authorId);
      const authorName = author?.displayName ?? author?.username ?? 'Someone';
      sendDesktopNotification(authorName, msg.content ?? '', msg.channelId, mention);
    }
  });

  connection.on("UpdMsg", (msg) => {
    getMs().updateMessage(msg);
  });

  connection.on("DelMsg", (dto: { id: number; channelId: number }) => {
    getMs().removeMessage(dto.id);
  });

  // TODO: make payload only a message id + channel id, also make unpinning function
  connection.on("PinMsg", (msg) => {
    getMs().updateMessage(msg);
  });

  connection.on("AddReact", (payload: { messageId: number; channelId: number; userId: number; emoji: any }) => {
    getMs().addReaction({ messageId: payload.messageId, userId: payload.userId, emoji: payload.emoji });
  });

  connection.on("RemReact", (payload: { messageId: number; channelId: number; userId: number; emoji: any }) => {
    getMs().removeReaction({ messageId: payload.messageId, userId: payload.userId, emoji: payload.emoji });
  });

  connection.on("UpdUsr", (u) => {
    getUs().addUser(u);
  });

  connection.on("UpdMem", (m) => {
    getUs().addMember(m);
  });

  connection.on("MbrJoin", (member) => {
    getUs().addMember(member);
    if (member.serverId)
      useCacheState.getState().invalidate(CacheKey.members(member.serverId));
  });

  connection.on("MbrLeave", (dto: { id: number }) => {
    const serverId = getSs().currentServer?.id;
    if (serverId) {
      getUs().removeMember(dto.id, serverId);
      useCacheState.getState().invalidate(CacheKey.members(serverId));
    }
  });

  connection.on("UpdStatus", (p: Presence) => {
    const us = getUs();
    const user = us.get(p.userId);
    if (user) {
      us.addUser({
        ...user,
        onlineStatus: p.onlineStatus,
        showStatusWhileOffline: p.showStatusWhileOffline ?? user.showStatusWhileOffline,
        status: p.statusText ?? user.status
      });
    }
  });

  connection.on("Typing", (event) => {
    const key = `${event.channelId}:${event.userId}`;

    const existing = _typingTimeouts.get(key);
    if (existing !== undefined)
      clearTimeout(existing);

    const cs = getCs();
    cs.startTyping(event);

    const handle = setTimeout(() => {
      cs.stopTyping(event);
      _typingTimeouts.delete(key);
    }, 8000);

    _typingTimeouts.set(key, handle);
  });

  connection.on("StopTyping", (event) => getCs().stopTyping(event));

  connection.on("NewChan", (channel) => {
    getCs().addChannel(channel);
    if (channel.serverId)
      useCacheState.getState().invalidate(CacheKey.channels(channel.serverId));
  });

  connection.on("UpdChan", (channel) => {
    getCs().addChannel(channel);
    if (channel.serverId)
      useCacheState.getState().invalidate(CacheKey.channels(channel.serverId));
  });

  connection.on("DelChan", (dto: { id: number }) => {
    const cs = getCs();
    const ch = cs.get(dto.id);
    if (ch?.serverId)
      useCacheState.getState().invalidate(CacheKey.channels(ch.serverId));
    cs.removeChannel(dto.id);
    if (cs.currentChannel?.id === dto.id)
      cs.setCurrentChannel(null);
  });

  connection.on("UpdServ", (server) => {
    getSs().addServer(server);
    useCacheState.getState().invalidate(CacheKey.servers);
  });

  connection.on("DelSrv", (dto: { id: number }) => {
    const ss = getSs();
    ss.removeServer(dto.id);
    useCacheState.getState().invalidate(CacheKey.servers);
    if (ss.currentServer?.id === dto.id) {
      ss.setCurrentServer(null);
      getCs().setCurrentChannel(null);
    }
  });

  connection.on("NewRole", (role) => {
    const ss = getSs();
    const server = ss.get(role.serverId);
    if (server)
      ss.addServer({ ...server, roles: [...server.roles.filter(r => r.id !== role.id), role] });
  });

  connection.on("UpdRole", (role) => {
    const ss = getSs();
    const server = ss.get(role.serverId);
    if (server)
      ss.addServer({ ...server, roles: server.roles.map(r => r.id === role.id ? role : r) });
  });

  connection.on("DelRole", (dto: { id: number }) => {
    const ss = getSs();
    ss.servers.forEach(server => {
      if (server.roles.some(r => r.id === dto.id))
        ss.addServer({ ...server, roles: server.roles.filter(r => r.id !== dto.id) });
    });
  });

  connection.on("LevelUp", (payload: { scope: string; level: number; serverId?: number }) => {
    // TODO: turn into a custom message type
    console.info(`🎉 Level up! ${payload.scope} level ${payload.level}`);
  });

  connection.on("RelNotify", (dto: { userId: number; type: number }) => {
    console.info("Relationship notification:", dto);
  });

  connection.on("OwnerVote", (_vote) => {});
  connection.on("VoiceState", (_vs: VoiceState) => {});
  connection.on("DrawStroke", (_) => {});
  connection.on("DrawClear", (_) => {});

  connection.onclose(() => {
    stopHeartbeat();
    _typingTimeouts.forEach(clearTimeout);
    _typingTimeouts.clear();
  });

  connection.start()
    .then(async () => {
      console.info("SignalR connected.");
      startHeartbeat();
      await Promise.all([
        ...initialChannels.map(c => connection!.invoke("JoinChannel", c.id).catch(() => {})),
        ...initialServers.map(s => connection!.invoke("JoinServer", s.id).catch(() => {})),
      ]);
    })
    .catch((err: Error) => console.error("SignalR connection failed:", err));

  connection.onreconnected(async () => {
    console.info("SignalR reconnected. Rejoining groups.");
    startHeartbeat();
    useCacheState.getState().invalidatePrefix("");
    const channels = getCs().channels;
    const servers = getSs().servers;
    await Promise.all([
      ...channels.map(c => connection!.invoke("JoinChannel", c.id).catch(() => {})),
      ...servers.map(s => connection!.invoke("JoinServer", s.id).catch(() => {})),
    ]);
  });
}

export function joinChannel(channelId: number) {
  connection?.invoke("JoinChannel", channelId).catch(() => {});
}

export function joinServer(serverId: number) {
  connection?.invoke("JoinServer", serverId).catch(() => {});
}