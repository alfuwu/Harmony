import React, { useContext, useState, createContext } from "react";
import { Channel } from "../utils/types";

export interface ChannelState {
  currentChannel: Channel | null;
  setCurrentChannel: React.Dispatch<React.SetStateAction<Channel | null>>;
  channels: Channel[];
  setChannels: React.Dispatch<React.SetStateAction<Channel[]>>;
  get: (id: number) => Channel | undefined;
  getChannel: (id: number) => Channel | undefined;
  addChannel: (channel: Channel) => void;
  addChannels: (channels: Channel[]) => void;
  removeChannel: (id: number) => void;
  removeChannels: (ids: number[]) => void;
}

const ChannelContext = createContext<ChannelState | undefined>(undefined);

export const ChannelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);

  const get = (id: number) =>
    channels.find(c => c.id === id);

  const addChannel = (channel: Channel) => 
    setChannels(prev => [prev.filter(c => c.id !== channel.id), channel].flat());

  const addChannels = (newChannels: Channel[]) => {
    setChannels(prev => {
      const newIds = new Set(newChannels.map(c => c.id));
      return [...prev.filter(c => !newIds.has(c.id)), ...newChannels];
    });
  };

  const removeChannel = (id: number) =>
    setChannels(prev => prev.filter(c => c.id !== id));

  const removeChannels = (ids: number[]) =>
    setChannels(prev => prev.filter(c => !ids.includes(c.id)));

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
  };

  return <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>;
};

export const useChannelState = (): ChannelState => {
  const ctx = useContext(ChannelContext);
  if (!ctx)
    throw new Error("useChannelState must be used within a ChannelProvider");
  return ctx;
};
