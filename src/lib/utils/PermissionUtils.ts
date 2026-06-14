import { Channel, Member, Server } from "./Types";

export const Permission = {
  ViewChannels:           1n << 0n,
  SendMessages:           1n << 1n,
  ManageMessages:         1n << 2n,
  ManageChannels:         1n << 3n,
  ManageRoles:            1n << 4n,
  KickMembers:            1n << 5n,
  BanMembers:             1n << 6n,
  MuteMembers:            1n << 7n,
  DeafenMembers:          1n << 8n,
  MoveMembers:            1n << 9n,
  ManageServer:           1n << 10n,
  Administrator:          1n << 11n,
  AttachFiles:            1n << 12n,
  EmbedLinks:             1n << 13n,
  AddReactions:           1n << 14n,
  UseExternalEmojis:      1n << 15n,
  MentionEveryone:        1n << 16n,
  ManageThreads:          1n << 17n,
  CreateInvites:          1n << 19n,
  Draw:                   1n << 21n,
  EditOtherMessages:      1n << 22n,
  ViewMessageHistory:     1n << 23n,
  PinMessages:            1n << 24n,
  CreateThreads:          1n << 25n,
  ManageQuests:           1n << 45n,
  ReviewAppeals:          1n << 46n,
} as const;

export function computePermissions(
  member: Member,
  server: Server,
  channel?: Channel | null
): bigint {
  if (server.ownerId === member.userId) return 0xFFFFFFFFFFFFFFFFn;

  const memberRoles = server.roles
    .filter(r => member.roles.includes(r.id))
    .sort((a, b) => b.position - a.position);

  let perms = 0n;
  for (const role of memberRoles) {
    perms |= BigInt(role.permissions);
  }

  if (perms & Permission.Administrator) return 0xFFFFFFFFFFFFFFFFn;

  if (channel) {
    const overrides: any[] = (channel as any).overrides ?? [];
    for (const role of [...memberRoles].reverse()) {
      const over = overrides.find((o: any) => o.roleId === role.id);
      if (!over) continue;
      if (over.hardDeny) { perms &= ~BigInt(over.deny); continue; }
      perms &= ~BigInt(over.deny);
      perms |= BigInt(over.allow);
    }
  }

  return perms;
}

export function hasPermission(
  member: Member | null | undefined,
  server: Server | null | undefined,
  permission: bigint,
  channel?: Channel | null
): boolean {
  if (!member || !server) return false;
  if (server.ownerId === member.userId) return true;
  const perms = computePermissions(member, server, channel);
  if (perms & Permission.Administrator) return true;
  return (perms & permission) !== 0n;
}

export const isOwner = (member: Member | null | undefined, server: Server | null | undefined) =>
  !!(member && server && server.ownerId === member.userId);

export const canManageChannels = (m: Member | null | undefined, s: Server | null | undefined) =>
  hasPermission(m, s, Permission.ManageChannels);

export const canManageMessages = (m: Member | null | undefined, s: Server | null | undefined, ch?: Channel | null) =>
  hasPermission(m, s, Permission.ManageMessages, ch);

export const canKickMembers = (m: Member | null | undefined, s: Server | null | undefined) =>
  hasPermission(m, s, Permission.KickMembers);

export const canBanMembers = (m: Member | null | undefined, s: Server | null | undefined) =>
  hasPermission(m, s, Permission.BanMembers);

export const canManageRoles = (m: Member | null | undefined, s: Server | null | undefined) =>
  hasPermission(m, s, Permission.ManageRoles);

export const canManageServer = (m: Member | null | undefined, s: Server | null | undefined) =>
  hasPermission(m, s, Permission.ManageServer);

export const canPinMessages = (m: Member | null | undefined, s: Server | null | undefined, ch?: Channel | null) =>
  hasPermission(m, s, Permission.PinMessages, ch);

export const canEditOthers = (m: Member | null | undefined, s: Server | null | undefined, ch?: Channel | null) =>
  hasPermission(m, s, Permission.EditOtherMessages, ch);

export const canCreateInvites = (m: Member | null | undefined, s: Server | null | undefined) =>
  hasPermission(m, s, Permission.CreateInvites);