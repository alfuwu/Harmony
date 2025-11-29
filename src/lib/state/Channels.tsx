import React, { useContext, useState, createContext } from "react";
import { Channel } from "../utils/types";

export interface ChannelState {
  currentChannel: Channel | null;
  setCurrentChannel: React.Dispatch<React.SetStateAction<Channel | null>>;
  channels: Channel[];
  setChannels: React.Dispatch<React.SetStateAction<Channel[]>>;
}

const ChannelContext = createContext<ChannelState | undefined>(undefined);

export const ChannelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const value = { currentChannel, setCurrentChannel, channels, setChannels };
  return <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>;
};

export const useChannelState = (): ChannelState => {
  const ctx = useContext(ChannelContext);
  if (!ctx)
    throw new Error("useChannels must be used within a ChannelProvider");
  return ctx;
};
