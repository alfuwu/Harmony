import { hostUrl } from "../../App";
import { getAs } from "../state/Auth";
import { getMs } from "../state/Messages";
import { getCs } from "../state/Channels";
import { getSs } from "../state/Servers";
import { getUs } from "../state/Users";
import { AbstractChannel, Server } from "../utils/Types";
import { useCacheState, CacheKey } from "../state/Cache";
import { isMentioned, sendDesktopNotification } from "../utils/Funcs";
import { getServerId } from "../utils/ChannelUtils";
import { useUnread } from "../state/Unread";
import { BigJSON } from "../utils/JSON";
import { transformRole } from "../api/ServerApi";

interface ServerFrame {
  op: string;
  d: unknown;
}

export type OnlineStatusWire = 0 | 1 | 2 | 3 | 4;

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function camelize(value: any): any {
  if (Array.isArray(value))
    return value.map(camelize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value))
      out[snakeToCamelKey(k)] = camelize(v);
    return out;
  }
  return value;
}

let socket: WebSocket | null = null;
let heartbeatHandle: ReturnType<typeof setInterval> | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manuallyClosed = false;
let subscribedChannels = new Set<bigint>();
const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const MAX_BACKOFF_MS = 30_000;

function wsUrl(): string {
  const base = hostUrl.replace(/^http/, "ws");
  const token = getAs().token ?? "";
  return `${base}/gateway?access_token=${encodeURIComponent(token)}`;
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatHandle = setInterval(() => send("HEARTBEAT"), 30_000);
}
function stopHeartbeat() {
  if (heartbeatHandle !== null) {
    clearInterval(heartbeatHandle);
    heartbeatHandle = null;
  }
}

function send(op: string, d?: unknown) {
  if (socket?.readyState !== WebSocket.OPEN)
    return;
  socket.send(BigJSON.stringify(d === undefined ? { op } : { op, d }));
}

export function isConnected(): boolean {
  return socket?.readyState === WebSocket.OPEN;
}

export function joinChannel(channelId: bigint) {
  subscribedChannels.add(channelId);
  send("SUBSCRIBE_CHANNEL", { channel_id: channelId });
}

export function leaveChannel(channelId: bigint) {
  subscribedChannels.delete(channelId);
  send("UNSUBSCRIBE_CHANNEL", { channel_id: channelId });
}

export function joinServer(_serverId: bigint) {}

export function setStatus(status: OnlineStatusWire) {
  send("SET_STATUS", { status });
}

export function startTyping(channelId: bigint) {
  send("START_TYPING", { channel_id: channelId });
}

export function stopTyping(channelId: bigint) {
  send("STOP_TYPING", { channel_id: channelId });
}

export function joinVoice(channelId: bigint, serverId: bigint) {
  send("JOIN_VOICE", { channel_id: channelId, server_id: serverId });
}

export function updateVoiceState(state: {
  selfMuted: boolean;
  selfDeafened: boolean;
  streaming: boolean;
  cameraOn: boolean;
}) {
  send("UPDATE_VOICE_STATE", {
    self_muted: state.selfMuted,
    self_deafened: state.selfDeafened,
    streaming: state.streaming,
    camera_on: state.cameraOn,
  });
}

export function leaveVoice() {
  send("LEAVE_VOICE");
}

export function sendStroke(channelId: bigint, stroke: unknown) {
  send("SEND_STROKE", { channel_id: channelId, stroke });
}

export function clearCanvas(channelId: bigint) {
  send("CLEAR_CANVAS", { channel_id: channelId });
}

function handleFrame(raw: string) {
  let frame: ServerFrame;
  try {
    frame = BigJSON.parse(raw);
  } catch {
    return;
  }
  const d: any = camelize(frame.d);

  switch (frame.op) {
    case "READY": {
      reconnectAttempt = 0;
      for (const channelId of subscribedChannels)
        send("SUBSCRIBE_CHANNEL", { channel_id: channelId });
      break;
    }
    case "HEARTBEAT_ACK":
      break;

    case "MESSAGE_CREATE": {
      getMs().addMessage({ ...d, sending: false });
      const cs = getCs();
      const uid = getAs().user?.id;
      const currentChannelId = cs.currentChannel?.id;
      if (d.channelId !== currentChannelId && uid != null) {
        const mention = isMentioned(d, uid, getServerId(d.channelId));
        useUnread.getState().receive(d.channelId, d.id, mention);
        const author = getUs().get(d.authorId);
        const authorName = author?.displayName ?? author?.username ?? "Someone";
        sendDesktopNotification(authorName, d.content ?? "", d.channelId, mention);
      }
      break;
    }
    case "MESSAGE_UPDATE":
      getMs().updateMessage(d);
      break;
    case "MESSAGE_DELETE":
      getMs().removeMessage(d.messageId);
      break;

    case "REACTION_ADD":
      getMs().addReaction({ messageId: d.messageId, userId: d.userId, emoji: d.emoji });
      break;
    case "REACTION_REMOVE":
      getMs().removeReaction({ messageId: d.messageId, userId: d.userId, emoji: d.emoji });
      break;

    case "USER_UPDATE":
      getUs().addUser(d);
      break;

    case "MEMBER_JOIN": {
      getUs().addMember(d);
      if (d.serverId)
        useCacheState.getState().invalidate(CacheKey.members(d.serverId));
      break;
    }
    case "MEMBER_LEAVE": {
      const serverId = getSs().currentServer?.id;
      if (serverId) {
        getUs().removeMember(d.userId, serverId);
        useCacheState.getState().invalidate(CacheKey.members(serverId));
      }
      break;
    }

    case "PRESENCE_UPDATE": {
      const us = getUs();
      const user = us.get(d.userId);
      if (user) {
        us.addUser({
          ...user,
          onlineStatus: d.onlineStatus,
          showStatusWhileOffline: d.showStatusWhileOffline ?? user.showStatusWhileOffline,
          status: d.statusText ?? user.status,
        });
      }
      break;
    }

    case "TYPING": {
      const key = `${d.channelId}:${d.userId}`;
      const existing = typingTimeouts.get(key);
      if (existing !== undefined)
        clearTimeout(existing);
      const cs = getCs();
      cs.startTyping(d);
      const handle = setTimeout(() => {
        cs.stopTyping(d);
        typingTimeouts.delete(key);
      }, 8000);
      typingTimeouts.set(key, handle);
      break;
    }
    case "STOP_TYPING":
      getCs().stopTyping(d);
      break;

    case "CHANNEL_CREATE": {
      getCs().addChannel(d);
      if (d.serverId) useCacheState.getState().invalidate(CacheKey.channels(d.serverId));
      break;
    }
    case "CHANNEL_DELETE": {
      const cs = getCs();
      const ch = cs.get(d.channelId);
      if (ch?.serverId)
        useCacheState.getState().invalidate(CacheKey.channels(ch.serverId));
      cs.removeChannel(d.channelId);
      if (cs.currentChannel?.id === d.channelId)
        cs.setCurrentChannel(null);
      break;
    }

    case "SERVER_DELETE": {
      const ss = getSs();
      ss.removeServer(d.serverId);
      useCacheState.getState().invalidate(CacheKey.servers);
      if (ss.currentServer?.id === d.serverId) {
        ss.setCurrentServer(null);
        getCs().setCurrentChannel(null);
      }
      break;
    }

    case "ROLE_UPDATE": {
      const ss = getSs();
      const server = ss.get(d.serverId);
      if (server) {
        const role = transformRole(d.role);
        const exists = server.roles.some(r => r.id === role.id);
        ss.addServer({
          ...server,
          roles: exists
            ? server.roles.map(r => r.id === role.id ? role : r)
            : [...server.roles, role],
        });
      }
      break;
    }
    case "ROLE_DELETE": {
      const ss = getSs();
      ss.servers.forEach((server) => {
        if (server.roles.some((r: any) => r.id === d.roleId))
          ss.addServer({ ...server, roles: server.roles.filter((r: any) => r.id !== d.roleId) });
      });
      break;
    }

    case "LEVEL_UP":
      // TODO: turn level ups into a custom message type and remove this gateway event
      console.info(`🎉 Level up! ${d.scope} level ${d.level}`);
      break;

    case "REL_NOTIFY":
      console.info("Relationship notification:", d);
      break;

    case "OWNER_VOTE":
    case "VOICE_STATE":
    case "DRAW_STROKE":
    case "DRAW_CLEAR":
      break;

    case "ERROR":
      console.error("Gateway error:", d);
      break;
  }
}

function scheduleReconnect() {
  if (manuallyClosed)
    return;
  const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_BACKOFF_MS);
  reconnectAttempt++;
  reconnectTimer = setTimeout(connect, delay);
}

function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (!getAs().token)
    return;

  socket = new WebSocket(wsUrl());

  socket.onopen = () => {
    console.info("Gateway connected.");
    startHeartbeat();
  };

  socket.onmessage = (ev) => handleFrame(ev.data);

  socket.onclose = () => {
    stopHeartbeat();
    typingTimeouts.forEach(clearTimeout);
    typingTimeouts.clear();
    if (!manuallyClosed) {
      console.warn("Gateway disconnected. Reconnecting...");
      useCacheState.getState().invalidatePrefix("");
      scheduleReconnect();
    }
  };

  socket.onerror = () => {
    socket?.close();
  };
}

export function initGateway({
  initialChannels = [],
  initialServers = [],
}: {
  initialChannels?: AbstractChannel[];
  initialServers?: Server[];
}) {
  reconnectAttempt = 0;
  subscribedChannels = new Set(initialChannels.map((c) => c.id));
  void initialServers;

  manuallyClosed = true;
  socket?.close();
  manuallyClosed = false;
  connect();
}

export function closeGateway() {
  manuallyClosed = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  stopHeartbeat();
  socket?.close();
  socket = null;
}