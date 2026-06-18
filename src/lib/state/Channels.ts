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
  get: (id: bigint) => AbstractChannel | undefined;
  getChannel: (id: bigint) => AbstractChannel | undefined;
  addChannel: (channel: AbstractChannel) => void;
  addChannels: (channels: AbstractChannel[]) => void;
  removeChannel: (id: bigint) => void;
  removeChannels: (ids: bigint[]) => void;
  getTyping: (id: bigint) => bigint[];
  startTyping: (event: Typing) => void;
  stopTyping: (event: Typing) => void;
  getChannelDraft: (channelId: bigint) => string;
  setChannelDraft: (channelId: bigint, draft: string) => void;
  getPendingReplies: (channelId: bigint) => Message[];
  addPendingReply: (channelId: bigint, message: Message) => void;
  removePendingReply: (channelId: bigint, messageId: bigint) => void;
  clearPendingReplies: (channelId: bigint) => void;
  getPendingAttachments: (channelId: bigint) => File[];
  addPendingAttachment: (channelId: bigint, file: File) => void;
  removePendingAttachment: (channelId: bigint, index: number) => void;
  clearPendingAttachments: (channelId: bigint) => void;
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

  getTyping: (id) => (get() as any)._typing.get(id) ?? [],

  startTyping: (event) =>
    set(state => {
      const typing: Map<bigint, bigint[]> = (state as any)._typing ?? {};
      const prev = typing.get(event.channelId) ?? [];
      if (prev.includes(event.userId))
        return state;
      typing.set(event.channelId, [...prev, event.userId]);
      return { _typing: typing } as any;
    }),

  stopTyping: (event) =>
    set(state => {
      const typing: Map<bigint, bigint[]> = (state as any)._typing ?? {};
      const prev = typing.get(event.channelId) ?? [];
      typing.set(event.channelId, prev.filter(id => id !== event.userId));
      return { _typing: typing } as any;
    }),

  getChannelDraft: (channelId) => ((get() as any)._drafts ?? {}).get(channelId) ?? "",

  setChannelDraft: (channelId, draft) =>
    set(state => {
      const drafts = (state as any)._drafts ?? {};
      drafts.set(channelId, draft);
      return { _drafts: drafts } as any;
    }),

  getPendingReplies: (channelId) => ((get() as any)._replies ?? {}).get(channelId) ?? [],

  addPendingReply: (channelId, message) =>
    set(state => {
      const replies: Map<bigint, Message[]> = (state as any)._replies ?? {};
      const existing = replies.get(channelId) ?? [];
      if (existing.length >= MAX_PENDING_REPLIES)
        return state;
      if (existing.some(m => m.id === message.id))
        return state;
      replies.set(channelId, [...existing, message]);
      return { _replies: replies } as any;
    }),

  removePendingReply: (channelId, messageId) =>
    set(state => {
      const replies: Map<bigint, Message[]> = (state as any)._replies ?? {};
      replies.set(channelId, (replies.get(channelId) ?? []).filter(m => m.id !== messageId));
      return { _replies: replies } as any;
    }),

  clearPendingReplies: (channelId) =>
    set(state => {
      const replies: Map<bigint, Message[]> = (state as any)._replies ?? {};
      replies.set(channelId, []);
      return { _replies: replies } as any;
    }),

  getPendingAttachments: (channelId) => ((get() as any)._attachments ?? {}).get(channelId) ?? [],

  addPendingAttachment: (channelId, file) =>
    set(state => {
      const attachments: Map<bigint, File[]> = (state as any)._attachments ?? {};
      const existing = attachments.get(channelId) ?? [];
      if (existing.length >= MAX_PENDING_ATTACHMENTS)
        return state;
      attachments.set(channelId, [...existing, file]);
      return { _attachments: attachments } as any;
    }),

  removePendingAttachment: (channelId, index) =>
    set(state => {
      const attachments: Map<bigint, File[]> = (state as any)._attachments ?? {};
      const next = [...(attachments.get(channelId) ?? [])];
      next.splice(index, 1);
      return { _attachments: attachments } as any;
    }),

  clearPendingAttachments: (channelId) =>
    set(state => {
      const attachments: Map<bigint, File[]> = (state as any)._attachments ?? {};
      attachments.set(channelId, []);
      return { _attachments: attachments } as any;
    }),

  _typing: new Map(),
  _drafts: new Map(),
  _replies: new Map(),
  _attachments: new Map()
} as ChannelState));

export const getCs = () => useChannelState.getState();