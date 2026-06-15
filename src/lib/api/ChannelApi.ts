import { Channel, ChannelType, Message } from "../utils/Types";
import { api } from "./Http";

export async function createChannel(
  serverId: number,
  name: string,
  type: ChannelType,
  description?: string | null,
  parentId?: number | null,
  options: RequestInit = {}
): Promise<Channel> {
  return api(`/servers/${serverId}/channels`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ name, type, description, parentId })
  });
}

export async function deleteChannel(
  serverId: number,
  channelId: number,
  options: RequestInit = {}
): Promise<void> {
  return api(`/servers/${serverId}/channels/${channelId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function updateChannelOverride(
  serverId: number,
  channelId: number,
  roleId: number,
  allow: number,
  deny: number,
  hardDeny: boolean,
  options: RequestInit = {}
): Promise<void> {
  return api(`/servers/${serverId}/roles/${roleId}/overrides/${channelId}`, {
    ...options,
    method: "PUT",
    body: JSON.stringify({ roleId, allow, deny, hardDeny })
  });
}

export async function searchMessages(
  channelId: number,
  query: string,
  page: number = 0,
  options: RequestInit = {}
): Promise<Message[]> {
  return api(`/channels/${channelId}/search?q=${encodeURIComponent(query)}&page=${page}`, {
    ...options,
    method: "GET"
  });
}

export async function markRead(
  channelId: number,
  messageId: number,
  options: RequestInit = {}
): Promise<void> {
  return api(`/channels/${channelId}/receipts`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ messageId })
  });
}