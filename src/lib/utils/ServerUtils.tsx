import { hostUrl } from "../../App";
import { Emoji, Server } from "./types";

const DEFAULT_ICON = "https://cdn.discordapp.com/emojis/1327190606535069726.png";

export function getIcon(server: Server | null): string {
    return server?.icon ? `${hostUrl}/api/servers/${server.id}/icon/${server.icon}` : DEFAULT_ICON;
}

export function getBanner(server: Server | null): string | undefined {
    return server?.banner ? `${hostUrl}/api/servers/${server.id}/banner/${server.banner}` : undefined;
}

export function getEmojiUrl(emoji: Emoji): string {
    return DEFAULT_ICON; // todo: add emojis endpoints
}