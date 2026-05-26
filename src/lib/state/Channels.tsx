import React, { useContext, useState, createContext } from "react";
import { AbstractChannel, Typing } from "../utils/types";

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
}

const ChannelContext = createContext<ChannelState | undefined>(undefined);

export const ChannelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentChannel, setCurrentChannel] = useState<AbstractChannel | null>(null);
  const [channels, setChannels] = useState<AbstractChannel[]>([]);
  const [typing, setTyping] = useState<Record<number, number[]>>({});

  const get = (id: number) =>
    channels.find(c => c.id === id);

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
    console.log("START TYPING: ", event);
    setTyping(prev => {
      const prevTyping = prev[event.channelId] || [];
      return {
        ...prev,
        [event.channelId]: [...prevTyping, event.userId]
      };
    });
  };

  const stopTyping = (event: Typing) => {
    setTyping(prev => {
      const prevTyping = prev[event.channelId] || [];
      return {
        ...prev,
        [event.channelId]: prevTyping.filter(id => id !== event.userId)
      };
    });
  };

  const value = {
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
    stopTyping
  };

  return <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>;
};

export const useChannelState = (): ChannelState => {
  const ctx = useContext(ChannelContext);
  if (!ctx)
    throw new Error("useChannelState must be used within a ChannelProvider");
  return ctx;
};
