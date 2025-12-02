import AnnouncementChannel from "../../components/svgs/channels/AnnouncementChannel";
import AnnouncementChannelLocked from "../../components/svgs/channels/AnnouncementChannelLocked";
import ForumChannel from "../../components/svgs/channels/ForumChannel";
import ForumChannelLocked from "../../components/svgs/channels/ForumChannelLocked";
import RulesChannel from "../../components/svgs/channels/RulesChannel";
import RulesChannelLocked from "../../components/svgs/channels/RulesChannelLocked";
import TextChannel from "../../components/svgs/channels/TextChannel";
import TextChannelLocked from "../../components/svgs/channels/TextChannelLocked";
import VoiceChannel from "../../components/svgs/channels/VoiceChannel";
import VoiceChannelLocked from "../../components/svgs/channels/VoiceChannelLocked";
import VoidChannel from "../../components/svgs/channels/VoidChannel";
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