import { create } from "zustand";
import type React from "react";
import { AbstractChannel, Message, Typing } from "../utils/Types";

const MAX_PENDING_REPLIES = 5;
const MAX_PENDING_ATTACHMENTS = 10;

export interface ChannelState {
  currentChannel: AbstractChannel | null;
  setCurrentChannel: React.Dispatch<React.SetStateAction<AbstractChannel | null>>;
  channels: AbstractChannel[];
  setChannels: React.Dispatch<React.SetStateAction<AbstractChannel[]>>;
  get: (id: number) => AbstractChannel | undefined;
  getChannel: (id: number) => AbstractChannel | undefined;
  addChannel: (channel: AbstractChannel) => void;
  addChannels: (channels: AbstractChannel[]) => void;
  removeChannel: (id: number) => void;
  removeChannels: (ids: number[]) => void;
  getTyping: (id: number) => number[];
  startTyping: (event: Typing) => void;
  stopTyping: (event: Typing) => void;
  getChannelDraft: (channelId: number) => string;
  setChannelDraft: (channelId: number, draft: string) => void;
  getPendingReplies: (channelId: number) => Message[];
  addPendingReply: (channelId: number, message: Message) => void;
  removePendingReply: (channelId: number, messageId: number) => void;
  clearPendingReplies: (channelId: number) => void;
  getPendingAttachments: (channelId: number) => File[];
  addPendingAttachment: (channelId: number, file: File) => void;
  removePendingAttachment: (channelId: number, index: number) => void;
  clearPendingAttachments: (channelId: number) => void;
}

export const useChannelState = create<ChannelState>((set, get) => ({
  currentChannel: null,
  channels: [],

  setCurrentChannel: (value) =>
    set(state => ({
      currentChannel: typeof value === "function" ? value(state.currentChannel) : value,
    })),

  setChannels: (value) =>
    set(state => ({
      channels: typeof value === "function" ? value(state.channels) : value,
    })),

  get: (id) => get().channels.find(c => c.id === id),
  getChannel: (id) => get().channels.find(c => c.id === id),

  addChannel: (channel) =>
    set(state => ({
      channels: [...state.channels.filter(c => c.id !== channel.id), channel],
    })),

  addChannels: (newChannels) =>
    set(state => {
      const newIds = new Set(newChannels.map(c => c.id));
      return { channels: [...state.channels.filter(c => !newIds.has(c.id)), ...newChannels] };
    }),

  removeChannel: (id) =>
    set(state => ({ channels: state.channels.filter(c => c.id !== id) })),

  removeChannels: (ids) =>
    set(state => ({ channels: state.channels.filter(c => !ids.includes(c.id)) })),

  getTyping: (id) => (get() as any)._typing[id] ?? [],

  startTyping: (event) =>
    set(state => {
      const typing: Record<number, number[]> = (state as any)._typing ?? {};
      const prev = typing[event.channelId] ?? [];
      if (prev.includes(event.userId)) return state;
      return { _typing: { ...typing, [event.channelId]: [...prev, event.userId] } } as any;
    }),

  stopTyping: (event) =>
    set(state => {
      const typing: Record<number, number[]> = (state as any)._typing ?? {};
      const prev = typing[event.channelId] ?? [];
      return { _typing: { ...typing, [event.channelId]: prev.filter(id => id !== event.userId) } } as any;
    }),

  getChannelDraft: (channelId) => ((get() as any)._drafts ?? {})[channelId] ?? "",

  setChannelDraft: (channelId, draft) =>
    set(state => ({
      _drafts: { ...((state as any)._drafts ?? {}), [channelId]: draft },
    } as any)),

  getPendingReplies: (channelId) => ((get() as any)._replies ?? {})[channelId] ?? [],

  addPendingReply: (channelId, message) =>
    set(state => {
      const replies: Record<number, Message[]> = (state as any)._replies ?? {};
      const existing = replies[channelId] ?? [];
      if (existing.length >= MAX_PENDING_REPLIES) return state;
      if (existing.some(m => m.id === message.id)) return state;
      return { _replies: { ...replies, [channelId]: [...existing, message] } } as any;
    }),

  removePendingReply: (channelId, messageId) =>
    set(state => {
      const replies: Record<number, Message[]> = (state as any)._replies ?? {};
      return {
        _replies: { ...replies, [channelId]: (replies[channelId] ?? []).filter(m => m.id !== messageId) },
      } as any;
    }),

  clearPendingReplies: (channelId) =>
    set(state => ({
      _replies: { ...((state as any)._replies ?? {}), [channelId]: [] },
    } as any)),

  getPendingAttachments: (channelId) => ((get() as any)._attachments ?? {})[channelId] ?? [],

  addPendingAttachment: (channelId, file) =>
    set(state => {
      const attachments: Record<number, File[]> = (state as any)._attachments ?? {};
      const existing = attachments[channelId] ?? [];
      if (existing.length >= MAX_PENDING_ATTACHMENTS) return state;
      return { _attachments: { ...attachments, [channelId]: [...existing, file] } } as any;
    }),

  removePendingAttachment: (channelId, index) =>
    set(state => {
      const attachments: Record<number, File[]> = (state as any)._attachments ?? {};
      const next = [...(attachments[channelId] ?? [])];
      next.splice(index, 1);
      return { _attachments: { ...attachments, [channelId]: next } } as any;
    }),

  clearPendingAttachments: (channelId) =>
    set(state => ({
      _attachments: { ...((state as any)._attachments ?? {}), [channelId]: [] },
    } as any)),

  _typing: {} as Record<number, number[]>,
  _drafts: {} as Record<number, string>,
  _replies: {} as Record<number, Message[]>,
  _attachments: {} as Record<number, File[]>,
} as ChannelState));

export const getCs = () => useChannelState.getState();