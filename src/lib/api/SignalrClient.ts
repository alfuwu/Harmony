import * as signalR from "@microsoft/signalr";
import { AuthState } from "../state/Auth";
import { hostUrl } from "../../App";
import { MessageState } from "../state/Messages";
import { ChannelState } from "../state/Channels";
import { ServerState } from "../state/Servers";
import { UserState } from "../state/Users";
import { AbstractChannel, Presence, Server, VoiceState } from "../utils/Types";
import { useCacheState, CacheKey } from "../state/Cache";

export let connection: signalR.HubConnection | null = null;

let _messageState: MessageState;
let _channelState: ChannelState;
let _serverState: ServerState;
let _userState: UserState;
let _heartbeatHandle: ReturnType<typeof setInterval> | null = null;

export function updateSignalRRefs(params: {
  messageState: MessageState;
  channelState: ChannelState;
  serverState: ServerState;
  userState: UserState;
}) {
  _messageState = params.messageState;
  _channelState = params.channelState;
  _serverState = params.serverState;
  _userState = params.userState;
}

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
  authState,
  serverState,
  channelState,
  messageState,
  userState,
  initialChannels = [],
  initialServers = [],
}: {
  authState: AuthState;
  serverState: ServerState;
  channelState: ChannelState;
  messageState: MessageState;
  userState: UserState;
  initialChannels?: AbstractChannel[];
  initialServers?: Server[];
}) {
  _messageState = messageState;
  _channelState = channelState;
  _serverState = serverState;
  _userState = userState;

  if (connection) {
    stopHeartbeat();
    connection.stop();
    connection = null;
  }

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${hostUrl}/gateway`, {
      accessTokenFactory: () => authState.token || ""
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  connection.on("RecvMsg", (msg) => {
    _messageState.addMessage({ ...msg, sending: false });
  });

  connection.on("UpdMsg", (msg) => {
    _messageState.updateMessage(msg);
  });

  connection.on("DelMsg", (dto: { id: number; channelId: number }) => {
    _messageState.removeMessage(dto.id);
  });

  connection.on("PinMsg", (msg) => {
    _messageState.updateMessage(msg);
  });

  connection.on("AddReact", (payload: { messageId: number; channelId: number; userId: number; emoji: any }) => {
    _messageState.addReaction({ messageId: payload.messageId, userId: payload.userId, emoji: payload.emoji });
  });

  connection.on("RemReact", (payload: { messageId: number; channelId: number; userId: number; emoji: any }) => {
    _messageState.removeReaction({ messageId: payload.messageId, userId: payload.userId, emoji: payload.emoji });
  });

  connection.on("UpdUsr", (u) => {
    _userState.addUser(u);
  });

  connection.on("UpdMem", (m) => {
    _userState.addMember(m);
  });

  connection.on("MbrJoin", (member) => {
    _userState.addMember(member);
    if (member.serverId)
      useCacheState.getState().invalidate(CacheKey.members(member.serverId));
  });

  connection.on("MbrLeave", (dto: { id: number }) => {
    const serverId = _serverState.currentServer?.id;
    if (serverId) {
      _userState.removeMember(dto.id, serverId);
      useCacheState.getState().invalidate(CacheKey.members(serverId));
    }
  });

  connection.on("UpdStatus", (p: Presence) => {
    const user = _userState.get(p.userId);
    if (user) {
      _userState.addUser({
        ...user,
        onlineStatus: p.onlineStatus,
        showStatusWhileOffline: p.showStatusWhileOffline ?? user.showStatusWhileOffline,
        status: p.statusText ?? user.status
      });
    }
  });

  connection.on("Typing", (event) => {
    _channelState.startTyping(event);
    setTimeout(() => _channelState.stopTyping(event), 8000);
  });

  connection.on("StopTyping", (event) => {
    _channelState.stopTyping(event);
  });

  connection.on("NewChan", (channel) => {
    _channelState.addChannel(channel);
    if (channel.serverId)
      useCacheState.getState().invalidate(CacheKey.channels(channel.serverId));
  });

  connection.on("UpdChan", (channel) => {
    _channelState.addChannel(channel);
    if (channel.serverId)
      useCacheState.getState().invalidate(CacheKey.channels(channel.serverId));
  });

  connection.on("DelChan", (dto: { id: number }) => {
    const ch = _channelState.get(dto.id);
    if (ch?.serverId)
      useCacheState.getState().invalidate(CacheKey.channels(ch.serverId));
    _channelState.removeChannel(dto.id);
    if (_channelState.currentChannel?.id === dto.id)
      _channelState.setCurrentChannel(null);
  });

  connection.on("UpdServ", (server) => {
    _serverState.addServer(server);
    useCacheState.getState().invalidate(CacheKey.servers);
  });

  connection.on("DelSrv", (dto: { id: number }) => {
    _serverState.removeServer(dto.id);
    useCacheState.getState().invalidate(CacheKey.servers);
    if (_serverState.currentServer?.id === dto.id) {
      _serverState.setCurrentServer(null);
      _channelState.setCurrentChannel(null);
    }
  });

  connection.on("NewRole", (role) => {
    const server = _serverState.get(role.serverId);
    if (server)
      _serverState.addServer({ ...server, roles: [...server.roles.filter(r => r.id !== role.id), role] });
  });

  connection.on("UpdRole", (role) => {
    const server = _serverState.get(role.serverId);
    if (server)
      _serverState.addServer({ ...server, roles: server.roles.map(r => r.id === role.id ? role : r) });
  });

  connection.on("DelRole", (dto: { id: number }) => {
    _serverState.servers.forEach(server => {
      if (server.roles.some(r => r.id === dto.id))
        _serverState.addServer({ ...server, roles: server.roles.filter(r => r.id !== dto.id) });
    });
  });

  connection.on("LevelUp", (payload: { scope: string; level: number; serverId?: number }) => {
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
    const channels = _channelState.channels;
    const servers = _serverState.servers;
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