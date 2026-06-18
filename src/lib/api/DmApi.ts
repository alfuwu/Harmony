import { BigJSON } from "../utils/JSON";
import { ChannelType, DmChannel, GroupDmChannel } from "../utils/Types";
import { api } from "./Http";

export async function getDmChannels(options: RequestInit = {}): Promise<(DmChannel | GroupDmChannel)[]> {
  return api(`/dms`, { ...options, method: "GET" });
}

export async function createDm(userId: bigint, options: RequestInit = {}): Promise<DmChannel> {
  return api(`/dms`, {
    ...options,
    method: "POST",
    body: BigJSON.stringify({ others: [userId], type: ChannelType.DM })
  });
}

export async function createGroupDm(userIds: bigint[], options: RequestInit = {}): Promise<GroupDmChannel> {
  return api(`/dms`, {
    ...options,
    method: "POST",
    body: BigJSON.stringify({ others: userIds, type: ChannelType.GroupDM })
  });
}

export async function deleteDmChannel(channelId: bigint, isGdm: boolean = false, options: RequestInit = {}): Promise<void> {
  return api(`/dms/${channelId}?isGdm=${isGdm}`, { ...options, method: "DELETE" });
}