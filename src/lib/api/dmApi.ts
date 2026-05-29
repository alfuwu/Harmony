import { ChannelType, DmChannel, GroupDmChannel } from "../utils/types";
import { api } from "./http";

export async function getDmChannels(options: RequestInit = {}): Promise<(DmChannel | GroupDmChannel)[]> {
  return api(`/dms`, { ...options, method: "GET" });
}

export async function createDm(userId: number, options: RequestInit = {}): Promise<DmChannel> {
  return api(`/dms`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ others: [userId], type: ChannelType.DM })
  });
}

export async function createGroupDm(userIds: number[], options: RequestInit = {}): Promise<GroupDmChannel> {
  return api(`/dms`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ others: userIds, type: ChannelType.GroupDM })
  });
}

export async function deleteDmChannel(channelId: number, isGdm: boolean = false, options: RequestInit = {}): Promise<void> {
  return api(`/dms/${channelId}?isGdm=${isGdm}`, { ...options, method: "DELETE" });
}