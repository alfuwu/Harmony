import { Channel, Member, Role, RoleCategory, RoleDisplayType, Server, User } from "../utils/Types";
import { api } from "./Http";
import { useCacheState, CacheKey } from "../state/Cache";
import { useUserState } from "../state/Users";
import { useChannelState } from "../state/Channels";
import { BigJSON } from "../utils/JSON";

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

export function transformRole(raw: Role): Role {
  const flags = typeof raw.flags === 'bigint' ? raw.flags : BigInt(raw.flags ?? 0);
  const permissions = typeof raw.permissions === 'bigint'
    ? raw.permissions
    : BigInt(raw.permissions ?? 0);
  return {
    ...raw,
    id: typeof raw.id === 'bigint' ? raw.id : BigInt(raw.id),
    permissions,
    flags,
    displaysSeparately: (flags & 1n) !== 0n
  };
}

export async function getRoles(serverId: bigint, options: RequestInit = {}): Promise<{ roles: Role[]; categories: RoleCategory[] }> {
  const data = await api(`/servers/${serverId}/roles`, { ...options, method: "GET" });
  return {
    roles: (data.roles ?? []).map(transformRole),
    categories: data.categories ?? [],
  };
}

export async function getServerChannels(serverId: bigint, options: RequestInit = {}): Promise<Channel[]> {
  return api(`/servers/${serverId}/channels`, {
    ...options,
    method: "GET"
  });
}

export async function getServerMembers(serverId: bigint, options: RequestInit = {}): Promise<Member[]> {
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

  const { roles, categories } = await getRoles(server.id);
  server.roles = roles;
  server.roleCategories = categories;

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

export async function deleteServer(serverId: bigint, options: RequestInit = {}) {
  return api(`/servers/${serverId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function joinServer(serverId: bigint, options: RequestInit = {}) {
  return api(`/servers/${serverId}/join`, {
    ...options,
    method: "POST"
  });
}

export async function leaveServer(serverId: bigint, options: RequestInit = {}) {
  return api(`/servers/${serverId}/leave`, {
    ...options,
    method: "POST"
  });
}

export async function kickMember(serverId: bigint, userId: bigint, reason: string | undefined = undefined, options: RequestInit = {}) {
  return api(`/servers/${serverId}/kick`, {
    ...options,
    method: "POST",
    body: BigJSON.stringify({ userId: userId, reason })
  });
}

export async function banMember(serverId: bigint, userId: bigint, reason: string | undefined = undefined, options: RequestInit = {}) {
  return api(`/servers/${serverId}/ban`, {
    ...options,
    method: "POST",
    body: BigJSON.stringify({ userId: userId, reason })
  });
}

export async function ipBanMember(serverId: bigint, userId: bigint, reason: string | undefined = undefined, options: RequestInit = {}) {
  return api(`/servers/${serverId}/ip-ban`, {
    ...options,
    method: "POST",
    body: BigJSON.stringify({ userId: userId, reason })
  });
}

export async function unbanMember(serverId: bigint, user: User, options: RequestInit = {}) {
  return api(`/servers/${serverId}/bans/${user.id}`, {
    ...options,
    method: "DELETE"
  });
}

export async function getBans(serverId: bigint, options: RequestInit = {}) {
  return api(`/servers/${serverId}/bans`, {
    ...options,
    method: "GET"
  });
}

export async function createRole(serverId: bigint, name: string, description: string | undefined = undefined, icon: string | undefined = undefined, color: number | undefined = undefined, colors: number[] | undefined = undefined, displayType: RoleDisplayType = RoleDisplayType.Normal, categoryId: bigint | undefined = undefined, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles`, {
    ...options,
    method: "POST",
    body: BigJSON.stringify({ name, description, icon, color, colors, displayType, categoryId })
  });
}

export async function updateRole(serverId: bigint, role: Role, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/${role.id}`, {
    ...options,
    method: "PATCH",
    body: BigJSON.stringify(role)
  });
}

export async function deleteRole(serverId: bigint, roleId: bigint, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/${roleId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function assignRole(serverId: bigint, userId: bigint, roleId: bigint, options: RequestInit = {}) {
  return api(`/servers/${serverId}/members/${userId}/roles`, {
    ...options,
    method: "PATCH",
    body: BigJSON.stringify({ add: [roleId] })
  });
}

export async function removeRole(serverId: bigint, userId: bigint, roleId: bigint, options: RequestInit = {}) {
  return api(`/servers/${serverId}/members/${userId}/roles`, {
    ...options,
    method: "PATCH",
    body: BigJSON.stringify({ remove: [roleId] })
  });
}

export async function getRoleCategories(serverId: bigint, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/categories`, {
    ...options,
    method: "GET"
  });
}

export async function createRoleCategory(serverId: bigint, name: string, position: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/categories`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ name, position })
  });
}

export async function updateRoleCategory(serverId: bigint, categoryId: bigint, name: string, position: number, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/categories/${categoryId}`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify({ name, position })
  });
}

export async function deleteRoleCategory(serverId: bigint, categoryId: bigint, options: RequestInit = {}) {
  return api(`/servers/${serverId}/roles/categories/${categoryId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function updateRoleOverrides(serverId: bigint, channelId: bigint, roleId: bigint, allow: bigint, deny: bigint, hardDeny: boolean, options: RequestInit = {}) {
  return api(`/servers/${serverId}/channels/${channelId}/permissions/${roleId}`, {
    ...options,
    method: "PUT",
    body: BigJSON.stringify({ allow, deny, hardDeny })
  });
}

export async function deleteRoleOverrides(serverId: bigint, channelId: bigint, roleId: bigint, options: RequestInit = {}) {
  return api(`/servers/${serverId}/channels/${channelId}/permissions/${roleId}`, {
    ...options,
    method: "DELETE"
  });
}