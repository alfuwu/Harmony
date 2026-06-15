import { create } from 'zustand';
import { getLastMessage } from '../utils/ChannelUtils';

const STORAGE_KEY = 'unreadLastRead';

function loadLastRead(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {}; }
  catch { return {}; }
}

function saveLastRead(d: Record<number, number>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
  catch {}
}

interface UnreadStore {
  lastRead: Record<number, number>;
  mentions: Record<number, boolean>;
  markRead: (channelId: number, messageId: number) => void;
  receive: (channelId: number, messageId: number, isMention: boolean) => void;
  isUnread: (channelId: number, lastMessage: number | null | undefined) => boolean;
  hasMention: (channelId: number) => boolean;
  serverHasUnread: (channelIds: number[]) => boolean;
}

export const useUnread = create<UnreadStore>((set, get) => ({
  lastRead: loadLastRead(),
  mentions: {},

  markRead: (channelId, messageId) =>
    set(s => {
      const lastRead = {
        ...s.lastRead,
        [channelId]: Math.max(s.lastRead[channelId] ?? 0, messageId)
      };
      const mentions = { ...s.mentions };
      delete mentions[channelId];
      saveLastRead(lastRead);
      return { lastRead, mentions };
    }),

  receive: (channelId, messageId, isMention) =>
    set(s => {
      if ((s.lastRead[channelId] ?? 0) >= messageId)
        return {};
      return isMention
        ? { mentions: { ...s.mentions, [channelId]: true } }
        : {};
    }),

  isUnread: (channelId, lastMessage) => {
    if (lastMessage == null)
      return false;
    return (get().lastRead[channelId] ?? 0) < lastMessage;
  },

  hasMention: (channelId) => get().mentions[channelId] ?? false,

  serverHasUnread: (channelIds) =>
    channelIds.some(id => {
      const last = getLastMessage(id);
      return last != null && (get().lastRead[id] ?? 0) < last;
    })
}));
