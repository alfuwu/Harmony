import AnnouncementChannel from "../../components/svgs/AnnouncementChannel";
import AnnouncementChannelLocked from "../../components/svgs/AnnouncementChannelLocked";
import ForumChannel from "../../components/svgs/ForumChannel";
import ForumChannelLocked from "../../components/svgs/ForumChannelLocked";
import RulesChannel from "../../components/svgs/RulesChannel";
import RulesChannelLocked from "../../components/svgs/RulesChannelLocked";
import TextChannel from "../../components/svgs/TextChannel";
import TextChannelLocked from "../../components/svgs/TextChannelLocked";
import VoiceChannel from "../../components/svgs/VoiceChannel";
import VoiceChannelLocked from "../../components/svgs/VoiceChannelLocked";
import VoidChannel from "../../components/svgs/VoidChannel";
import { AbstractChannel, ChannelType } from "./types";

export function getChannelIcon(channel: AbstractChannel | null, props: any = {}) {
    if (!channel)
        return <VoidChannel {...props} />;
    const p = isPrivate(channel);
    switch (channel.channelType) {
        default:
        case ChannelType.Text:
            if (p)
                return <TextChannelLocked {...props} />
            else
                return <TextChannel {...props} />
        case ChannelType.Voice:
            if (p)
                return <VoiceChannelLocked {...props} />
            else
                return <VoiceChannel {...props} />
        case ChannelType.Announcement:
            if (p)
                return <AnnouncementChannelLocked {...props} />
            else
                return <AnnouncementChannel {...props} />
        case ChannelType.Rules:
            if (p)
                return <RulesChannelLocked {...props} />
            else
                return <RulesChannel {...props} />
        case ChannelType.Thread:
        case ChannelType.DM:
        case ChannelType.GroupDM:
        case ChannelType.Category:
            return null;
        case ChannelType.Forum:
            if (p)
                return <ForumChannelLocked {...props} />
            else
                return <ForumChannel {...props} />
    }
}

export function isPrivate(channel: AbstractChannel) {
    return false;
}