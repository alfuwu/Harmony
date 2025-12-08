import { ChannelState } from "../state/Channels";
import { UserState } from "../state/Users";
import { MessageState } from "../state/Messages";
import { Channel, Member, Server } from "../utils/types";
import { api } from "./http";
import { getMessages } from "./messageApi";

export async function createServer(name: string, description: string | undefined = undefined, tags: string[] | undefined = undefined, inviteUrls: string[] | undefined = undefined, options: RequestInit = {}) {
  return api(`/servers`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ name, description, tags, inviteUrls })
  });
}

export async function getServers(options: RequestInit = {}): Promise<Server[]> {
  return api(`/servers`, {
    ...options,
    method: "GET"
  });
}

export async function getServerChannels(serverId: number, options: RequestInit = {}): Promise<Channel[]> {
  return api(`/servers/${serverId}/channels`, {
    ...options,
    method: "GET"
  });
}

export async function getServerMembers(serverId: number, options: RequestInit = {}): Promise<Member[]> {
  return api(`/servers/${serverId}/members`, {
    ...options,
    method: "GET"
  });
}

export async function loadServer(server: Server, channelState: ChannelState, userState: UserState, messageState: MessageState, token: string): Promise<void> {
  if (server.loaded)
    return;

  server.loaded = true;

  const channels = await getServerChannels(server.id, { headers: { Authorization: `Bearer ${token}` } });
  channelState.addChannels(channels);
  
  const members = await getServerMembers(server.id, { headers: { Authorization: `Bearer ${token}` } });
  userState.addMembers(members);

  const messages = await getMessages(server.id, undefined, { headers: { Authorization: `Bearer ${token}` } });
  messageState.addMessages(messages);
}
