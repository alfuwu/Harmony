import React, { useContext, useState, createContext } from "react";
import { Server } from "../utils/types";

interface ServerState {
  currentServer: Server | null;
  setCurrentServer: React.Dispatch<React.SetStateAction<Server | null>>;
  servers: Server[];
  setServers: React.Dispatch<React.SetStateAction<Server[]>>;
}

const ServerContext = createContext<ServerState | undefined>(undefined);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentServer, setCurrentServer] = useState<Server | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const value = { currentServer, setCurrentServer, servers, setServers };
  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
};

export const useServerState = (): ServerState => {
  const ctx = useContext(ServerContext);
  if (!ctx)
    throw new Error("useServers must be used within a ServerProvider");
  return ctx;
};
