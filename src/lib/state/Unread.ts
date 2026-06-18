import { create } from 'zustand';
import { getLastMessage } from '../utils/ChannelUtils';
import { bigIntMax } from '../utils/BigIntUtils';
import { BigJSON } from '../utils/JSON';

const STORAGE_KEY = 'unreadLastRead';

function loadLastRead(): Map<bigint, bigint> {
  try {
    return new Map(BigJSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')) ?? new Map();
  } catch {
    return new Map();
  }
}

function saveLastRead(d: Map<bigint, bigint>) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      BigJSON.stringify(d)
    );
  } catch { }
}

interface UnreadStore {
  lastRead: Map<bigint, bigint>;
  mentions: Map<bigint, boolean>;
  markRead: (channelId: bigint, messageId: bigint) => void;
  receive: (channelId: bigint, messageId: bigint, isMention: boolean) => void;
  isUnread: (channelId: bigint, lastMessage: bigint | null | undefined) => boolean;
  hasMention: (channelId: bigint) => boolean;
  serverHasUnread: (channelIds: bigint[]) => boolean;
}

export const useUnread = create<UnreadStore>((set, get) => ({
  lastRead: loadLastRead(),
  mentions: new Map(),

  markRead: (channelId, messageId) =>
    set(s => {
      const lastRead = s.lastRead;
      lastRead.set(channelId, bigIntMax(lastRead.get(channelId) ?? 0n, messageId));
      const mentions = { ...s.mentions };
      mentions.delete(channelId);
      saveLastRead(lastRead);
      return { lastRead, mentions };
    }),

  receive: (channelId, messageId, isMention) =>
    set(s => {
      if ((s.lastRead.get(channelId) ?? 0) >= messageId)
        return {};
      const mentions = s.mentions;
      if (isMention) {
        mentions.set(channelId, true);
        return { mentions };
      }
      return {};
    }),

  isUnread: (channelId, lastMessage) => {
    if (lastMessage == null)
      return false;
    return (get().lastRead.get(channelId) ?? 0n) < lastMessage;
  },

  hasMention: (channelId) => get().mentions.get(channelId) ?? false,

  serverHasUnread: (channelIds) =>
    channelIds.some(id => {
      const last = getLastMessage(id);
      return last != null && (get().lastRead.get(id) ?? 0n) < last;
    })
}));
