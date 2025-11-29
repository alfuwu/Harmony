import { ServerState } from "../state/Servers";
import { Member, User } from "./types";

const DEFAULT_AVATAR = "https://cdn.discordapp.com/avatars/1038466644353232967/2cf70b3cc2b0314758dd9f8155228c89.png?size=1024";

export function getAvatar(user: User, member: Member | undefined = undefined): string {
    return member?.avatar || user.avatar || DEFAULT_AVATAR;
}

export function getDisplayName(user: User, member: Member | undefined = undefined): string {
    return member?.nickname || user.displayName || user.username;
}

export function getNameFont(user: User, member: Member | undefined = undefined): string | null {
    const font = member?.nameFont || user.nameFont || null;
    if (font !== null)
        return font.startsWith("https://") ? `url(${font})` : font;
    return null;
}

export function getPronouns(user: User, member: Member | undefined = undefined): string | null {
    return member?.pronouns || user.pronouns || null;
}

export function getBio(user: User, member: Member | undefined = undefined): string | null {
    return member?.bio || user.bio || null;
}

export function getRoleColor(serverState: ServerState, user: User, member: Member | undefined = undefined, dms: boolean = false): string | null {
    if (dms && user.dmColor) {
        return "#" + user.dmColor.toString(16);
    } else if (member) {
        const s = serverState.servers.find(s => s.id === member.serverId);
        if (s) {
            const memberRoles = s.roles.filter(r => member.roles.includes(r.id));
            const coloredRoles = memberRoles.filter(r => r.color !== 0);
            if (coloredRoles.length > 0) {
                coloredRoles.sort((a, b) => b.position - a.position);
                return "#" + coloredRoles[0].color!.toString(16);
            }
        }
    }
    return null;
}