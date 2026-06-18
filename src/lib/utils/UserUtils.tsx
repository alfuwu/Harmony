import { hostUrl } from "../../App";
import { getSs } from "../state/Servers";
import { Member, Message, Role, User } from "./Types";

const DEFAULT_AVATAR = "https://cdn.discordapp.com/avatars/1038466644353232967/2cf70b3cc2b0314758dd9f8155228c89.png?size=1024";

export function getAvatar(user: User | null | undefined, member: Member | undefined = undefined): string {
    return member?.avatar ? `${hostUrl}/api/users/${user!.id}/${member.serverId}/avatar/${member.avatar}` : user?.avatar ? `${hostUrl}/api/users/${user.id}/avatar/${user.avatar}` : DEFAULT_AVATAR;
}

export function getBanner(user: User | null | undefined, member: Member | undefined = undefined): string | undefined {
    return member?.banner ? `${hostUrl}/api/users/${user!.id}/${member.serverId}/banner/${member.banner}` : user?.banner ? `${hostUrl}/api/users/${user.id}/banner/${user.banner}` : undefined;
}

export function getDisplayName(user: User | null | undefined, member: Member | undefined = undefined): string {
    return user?.nick || member?.nickname || user?.displayName || user?.username || "Unknown User";
}

export function getHandle(user: User | null | undefined): string {
    if (!user)
        return "unknown";
    if (!user.discriminator)
        return user.username;
    return `${user.username}#${String(user.discriminator).padStart(4, "0")}`;
}

export function getHandleOrNull(user: User | null | undefined): string | null {
    if (!user)
        return null;
    if (!user.discriminator)
        return user.username;
    return `${user.username}#${String(user.discriminator).padStart(4, "0")}`;
}

export function isCustomFont(font: string): boolean {
    return !!font.match(/[a-f0-9]{32}/);
}

export function getNameFont(user: User | null | undefined, member: Member | undefined = undefined): [string | undefined, boolean] {
    const font = member?.nameFont || user?.nameFont || undefined;
    if (font !== undefined)
        return isCustomFont(font) ? [`${hostUrl}/api/users/${user!.id}/${member?.nameFont ? `${member?.serverId}/` : ''}font/${font}`, true] : [font, false];
    return [undefined, false];
}

export function getPronouns(user: User, member: Member | undefined = undefined): string | undefined {
    return member?.pronouns || user.pronouns || undefined;
}

export function getBio(user: User, member: Member | undefined = undefined): string | undefined {
    return member?.bio || user.bio || undefined;
}

export function getDisplayRole(member: Member, requireColor: boolean = false): Role | undefined {
    const s = getSs().get(member.serverId);
    if (s) {
        const memberRoles = s.roles.filter(r => member.roles.includes(r.id) && (!requireColor || r.color !== 0));
        return memberRoles.sort((a, b) => b.position - a.position)[0];
    }
    return undefined;
}

export function mentionedIn(message: Message, user: User, member: Member | undefined = undefined): boolean {
    if (message.mentions && message.mentions.includes(user.id))
        return true;
    if (member && message.mentionRoles && member.roles.some(r => message.mentionRoles!.includes(r)))
        return true;
    return message.mentionsEveryone || false;
}