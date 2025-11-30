import React, { useContext, useState, createContext } from "react";
import { Server } from "../utils/types";

export interface ServerState {
  currentServer: Server | null;
  setCurrentServer: React.Dispatch<React.SetStateAction<Server | null>>;
  servers: Server[];
  setServers: React.Dispatch<React.SetStateAction<Server[]>>;
  get: (id: number) => Server | undefined;
  getServer: (id: number) => Server | undefined;
  addServer: (server: Server) => void;
  addServers: (servers: Server[]) => void;
  removeServer: (id: number) => void;
  removeServers: (ids: number[]) => void;
}

const ServerContext = createContext<ServerState | undefined>(undefined);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentServer, setCurrentServer] = useState<Server | null>(null);
  const [servers, setServers] = useState<Server[]>([]);

  const get = (id: number) =>
    servers.find(c => c.id === id);

  const addServer = (server: Server) => 
    setServers(prev => [prev.filter(c => c.id !== server.id), server].flat());

  const addServers = (newServers: Server[]) => {
    setServers(prev => {
      const newIds = new Set(newServers.map(c => c.id));
      return [...prev.filter(c => !newIds.has(c.id)), ...newServers];
    });
  };

  const removeServer = (id: number) =>
    setServers(prev => prev.filter(c => c.id !== id));

  const removeServers = (ids: number[]) =>
    setServers(prev => prev.filter(c => !ids.includes(c.id)));

  const value = {
    currentServer,
    setCurrentServer,
    servers,
    setServers,
    get,
    getServer: get,
    addServer,
    addServers,
    removeServer,
    removeServers,
  };

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
};

export const useServerState = (): ServerState => {
  const ctx = useContext(ServerContext);
  if (!ctx)
    throw new Error("useServerState must be used within a ServerProvider");
  return ctx;
};
