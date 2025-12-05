import { hostUrl } from "../../App";
import { ServerState } from "../state/Servers";
import { Member, Role, User } from "./types";

const DEFAULT_AVATAR = "https://cdn.discordapp.com/avatars/1038466644353232967/2cf70b3cc2b0314758dd9f8155228c89.png?size=1024";

export function getAvatar(user: User | null, member: Member | undefined = undefined): string {
    return member?.avatar ? `${hostUrl}/api/users/${user!.id}/${member.serverId}/avatar/${member.avatar}` : user?.avatar ? `${hostUrl}/api/users/${user.id}/avatar/${user.avatar}` : DEFAULT_AVATAR;
}

export function getBanner(user: User | null, member: Member | undefined = undefined): string | undefined {
    return member?.banner ? `${hostUrl}/api/users/${user!.id}/${member.serverId}/banner/${member.banner}` : user?.banner ? `${hostUrl}/api/users/${user.id}/banner/${user.banner}` : undefined;
}

export function getDisplayName(user: User | null | undefined, member: Member | undefined = undefined): string {
    return member?.nickname || user?.displayName || user?.username || "Unknown User";
}

export function getNameFont(user: User | null | undefined, member: Member | undefined = undefined): string | undefined {
    const font = member?.nameFont || user?.nameFont || undefined;
    if (font !== undefined)
        return font.includes('-') ? `url(${font})` : font;
    return undefined;
}

export function getPronouns(user: User, member: Member | undefined = undefined): string | undefined {
    return member?.pronouns || user.pronouns || undefined;
}

export function getBio(user: User, member: Member | undefined = undefined): string | undefined {
    return member?.bio || user.bio || undefined;
}

export function getDisplayRole(serverState: ServerState, member: Member, requireColor: boolean = false): Role | undefined {
    const s = serverState.get(member.serverId);
    if (s) {
        const memberRoles = s.roles.filter(r => member.roles.includes(r.id) && (!requireColor || r.color !== 0));
        return memberRoles.sort((a, b) => b.position - a.position)[0];
    }
    return undefined;
}

export function getRoleColor(serverState: ServerState, user: User, member: Member | undefined = undefined, dms: boolean = false): string | undefined {
    if (dms && user.dmColor)
        return "#" + user.dmColor.toString(16).padStart(6, "0");
    else if (member) {
        const r = getDisplayRole(serverState, member, true);
        if (r)
            return "#" + r.color!.toString(16).padStart(6, "0");
    }
    return undefined;
}