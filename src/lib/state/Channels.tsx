import React, { useContext, useState, createContext } from "react";
import { AbstractChannel, Message, Typing } from "../utils/types";

const MAX_PENDING_REPLIES = 5;

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
  getTyping: (id: number) => number[] | undefined;
  startTyping: (event: Typing) => void;
  stopTyping: (event: Typing) => void;
  getChannelDraft: (channelId: number) => string;
  setChannelDraft: (channelId: number, draft: string) => void;
  getPendingReplies: (channelId: number) => Message[];
  addPendingReply: (channelId: number, message: Message) => void;
  removePendingReply: (channelId: number, messageId: number) => void;
  clearPendingReplies: (channelId: number) => void;
}

const ChannelContext = createContext<ChannelState | undefined>(undefined);

export const ChannelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentChannel, setCurrentChannel] = useState<AbstractChannel | null>(null);
  const [channels, setChannels] = useState<AbstractChannel[]>([]);
  const [typing, setTyping] = useState<Record<number, number[]>>({});
  const [channelDrafts, setChannelDrafts] = useState<Record<number, string>>({});
  const [pendingReplies, setPendingReplies] = useState<Record<number, Message[]>>({});

  const get = (id: number) => channels.find(c => c.id === id);

  const addChannel = (channel: AbstractChannel) =>
    setChannels(prev => [prev.filter(c => c.id !== channel.id), channel].flat());

  const addChannels = (newChannels: AbstractChannel[]) => {
    setChannels(prev => {
      const newIds = new Set(newChannels.map(c => c.id));
      return [...prev.filter(c => !newIds.has(c.id)), ...newChannels];
    });
  };

  const removeChannel = (id: number) =>
    setChannels(prev => prev.filter(c => c.id !== id));

  const removeChannels = (ids: number[]) =>
    setChannels(prev => prev.filter(c => !ids.includes(c.id)));

  const getTyping = (id: number) => typing[id] || [];

  const startTyping = (event: Typing) => {
    setTyping(prev => {
      const prevTyping = prev[event.channelId] || [];
      return { ...prev, [event.channelId]: [...prevTyping, event.userId] };
    });
  };

  const stopTyping = (event: Typing) => {
    setTyping(prev => {
      const prevTyping = prev[event.channelId] || [];
      return { ...prev, [event.channelId]: prevTyping.filter(id => id !== event.userId) };
    });
  };

  const getChannelDraft = (channelId: number): string =>
    channelDrafts[channelId] ?? "";

  const setChannelDraft = (channelId: number, draft: string) =>
    setChannelDrafts(prev => ({ ...prev, [channelId]: draft }));

  const getPendingReplies = (channelId: number): Message[] =>
    pendingReplies[channelId] ?? [];

  const addPendingReply = (channelId: number, message: Message) =>
    setPendingReplies(prev => {
      const existing = prev[channelId] ?? [];
      if (existing.length >= MAX_PENDING_REPLIES) return prev;
      if (existing.some(m => m.id === message.id)) return prev;
      return { ...prev, [channelId]: [...existing, message] };
    });

  const removePendingReply = (channelId: number, messageId: number) =>
    setPendingReplies(prev => {
      const existing = prev[channelId] ?? [];
      return { ...prev, [channelId]: existing.filter(m => m.id !== messageId) };
    });

  const clearPendingReplies = (channelId: number) =>
    setPendingReplies(prev => ({ ...prev, [channelId]: [] }));

  const value: ChannelState = {
    currentChannel,
    setCurrentChannel,
    channels,
    setChannels,
    get,
    getChannel: get,
    addChannel,
    addChannels,
    removeChannel,
    removeChannels,
    getTyping,
    startTyping,
    stopTyping,
    getChannelDraft,
    setChannelDraft,
    getPendingReplies,
    addPendingReply,
    removePendingReply,
    clearPendingReplies,
  };

  return <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>;
};

export const useChannelState = (): ChannelState => {
  const ctx = useContext(ChannelContext);
  if (!ctx)
    throw new Error("useChannelState must be used within a ChannelProvider");
  return ctx;
};