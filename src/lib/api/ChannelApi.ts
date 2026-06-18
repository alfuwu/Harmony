import { BigJSON } from "../utils/JSON";
import { Channel, ChannelType, Message } from "../utils/Types";
import { api } from "./Http";

export async function createChannel(
  serverId: bigint,
  name: string,
  type: ChannelType,
  description?: string | null,
  parentId?: bigint | null,
  options: RequestInit = {}
): Promise<Channel> {
  return api(`/servers/${serverId}/channels`, {
    ...options,
    method: "POST",
    body: BigJSON.stringify({ name, type, description, parentId })
  });
}

export async function deleteChannel(
  serverId: bigint,
  channelId: bigint,
  options: RequestInit = {}
): Promise<void> {
  return api(`/servers/${serverId}/channels/${channelId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function updateChannelOverride(
  serverId: bigint,
  channelId: bigint,
  roleId: bigint,
  allow: bigint,
  deny: bigint,
  hardDeny: boolean,
  options: RequestInit = {}
): Promise<void> {
  return api(`/servers/${serverId}/roles/${roleId}/overrides/${channelId}`, {
    ...options,
    method: "PUT",
    body: BigJSON.stringify({ roleId, allow, deny, hardDeny })
  });
}

export async function searchMessages(
  channelId: bigint,
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
  channelId: bigint,
  messageId: bigint,
  options: RequestInit = {}
): Promise<void> {
  return api(`/channels/${channelId}/receipts`, {
    ...options,
    method: "POST",
    body: BigJSON.stringify({ messageId })
  });
}