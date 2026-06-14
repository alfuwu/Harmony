import { create } from "zustand";

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  fetchedAt: number;
  ttl: number;
}

export const CacheKey = {
  servers: "servers",
  dms: "dms",
  channels: (serverId: number) => `channels:${serverId}`,
  members: (serverId: number) => `members:${serverId}`,
  messages: (channelId: number) => `messages:${channelId}`
} as const;

export interface CacheState {
  entries: Record<string, CacheEntry>;
  isStale: (key: string, ttl?: number) => boolean;
  markFresh: (key: string, ttl?: number) => void;
  invalidate: (key: string) => void;
  invalidatePrefix: (prefix: string) => void;
}

export const useCacheState = create<CacheState>((set, get) => ({
  entries: {},

  isStale: (key) => {
    const entry = get().entries[key];
    if (!entry)
      return true;
    return Date.now() - entry.fetchedAt > entry.ttl;
  },

  markFresh: (key, ttl = DEFAULT_TTL) =>
    set(state => ({
      entries: {
        ...state.entries,
        [key]: { fetchedAt: Date.now(), ttl }
      }
    })),

  invalidate: (key) =>
    set(state => {
      const next = { ...state.entries };
      delete next[key];
      return { entries: next };
    }),

  invalidatePrefix: (prefix) =>
    set(state => ({
      entries: Object.fromEntries(
        Object.entries(state.entries).filter(([k]) => !k.startsWith(prefix))
      )
    }))
}));