import { Channel, Member, Role, RoleDisplayType, Server, User } from "../utils/Types";
import { api } from "./Http";
import { useCacheState, CacheKey } from "../state/Cache";
import { useUserState } from "../state/Users";
import { useChannelState } from "../state/Channels";

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

export async function loadServer(server: Server): Promise<void> {
  const { isStale, markFresh } = useCacheState.getState();

  const channelKey = CacheKey.channels(server.id);
  const memberKey = CacheKey.members(server.id);

  if (!isStale(channelKey) && !isStale(memberKey) && server.loaded)
    return;

  server.loaded = true;

  if (isStale(channelKey)) {
    const channels = await getServerChannels(server.id);
    useChannelState.getState().addChannels(channels);
    markFresh(channelKey);
  }

  if (isStale(memberKey)) {
    const members = await getServerMembers(server.id);
    useUserState.getState().addMembers(members);
    markFresh(memberKey);
  }
}

export async function deleteServer(serverId: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function joinServer(serverId: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/join`, {
    ...options,
    method: "POST"
  });
}

export async function leaveServer(serverId: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/leave`, {
    ...options,
    method: "POST"
  });
}

export async function kickMember(serverId: number, userId: number, reason: string | undefined = undefined, options: RequestInit = {}) {
  return api(`/servers/${serverId}/kick`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ userId: userId, reason })
  });
}

export async function banMember(serverId: number, userId: number, reason: string | undefined = undefined, options: RequestInit = {}) {
  return api(`/servers/${serverId}/ban`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ userId: userId, reason })
  });
}

export async function unbanMember(serverId: number, user: User, options: RequestInit = {}) {
  return api(`/servers/${serverId}/bans/${user.id}`, {
    ...options,
    method: "DELETE"
  });
}

export async function getBans(serverId: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/bans`, {
    ...options,
    method: "GET"
  });
}

export async function createRole(serverId: number, name: string, description: string | undefined = undefined, icon: string | undefined = undefined, color: number | undefined = undefined, colors: number[] | undefined = undefined, displayType: RoleDisplayType = RoleDisplayType.Normal, categoryId: number | undefined = undefined, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ name, description, icon, color, colors, displayType, categoryId })
  });
}

export async function updateRole(serverId: number, role: Role, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/${role.id}`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(role)
  });
}

export async function deleteRole(serverId: number, roleId: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/${roleId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function assignRole(serverId: number, userId: number, roleId: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/members/${userId}/roles/${roleId}`, {
    ...options,
    method: "PUT"
  });
}

export async function removeRole(serverId: number, userId: number, roleId: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/members/${userId}/roles/${roleId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function getRoleCategories(serverId: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/categories`, {
    ...options,
    method: "GET"
  });
}

export async function createRoleCategory(serverId: number, name: string, position: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/categories`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ name, position })
  });
}

export async function updateRoleCategory(serverId: number, categoryId: number, name: string, position: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/categories/${categoryId}`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify({ name, position })
  });
}

export async function deleteRoleCategory(serverId: number, categoryId: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/categories/${categoryId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function updateRoleOverrides(serverId: number, channelId: number, roleId: number, allow: number, deny: number, hardDeny: boolean, options: RequestInit = {}) {
  return api(`/servers/${serverId}/channels/${channelId}/permissions/${roleId}`, {
    ...options,
    method: "PUT",
    body: JSON.stringify({ allow, deny, hardDeny })
  });
}

export async function deleteRoleOverrides(serverId: number, channelId: number, roleId: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/channels/${channelId}/permissions/${roleId}`, {
    ...options,
    method: "DELETE"
  });
}