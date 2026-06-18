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
import { getCs } from "../state/Channels";
import { getMs } from "../state/Messages";
import { AbstractChannel, ChannelType } from "./Types";

export function getChannelIcon(channel: AbstractChannel | null, props: React.SVGAttributes<SVGElement> = {}) {
  if (!channel)
    return <VoidChannel {...props} />;
  const p = isPrivate(channel);
  switch (channel.type) {
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
  return channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM;
}

export function getServerId(channelId: bigint): bigint | undefined {
  return getCs().channels.find(c => c.id === channelId)?.serverId;
}

export function getChannelIds(serverId: bigint): bigint[] {
  return getCs().channels.filter(c => c.serverId === serverId).map(c => c.id);
}

export function getLastMessage(channelId: bigint): bigint | undefined {
  return getMs().messages
    .filter((m) => m.channelId === channelId)
    .sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0]?.id;
}