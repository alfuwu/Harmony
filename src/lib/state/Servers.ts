import { create } from "zustand";
import type React from "react";
import { Server } from "../utils/Types";

export interface ServerState {
  currentServer: Server | null;
  setCurrentServer: React.Dispatch<React.SetStateAction<Server | null>>;
  servers: Server[];
  setServers: React.Dispatch<React.SetStateAction<Server[]>>;
  get: (id?: bigint | null) => Server | undefined;
  getServer: (id?: bigint | null) => Server | undefined;
  addServer: (server: Server) => void;
  addServers: (servers: Server[]) => void;
  removeServer: (id?: bigint | null) => void;
  removeServers: (ids: (bigint | null | undefined)[]) => void;
}

export const useServerState = create<ServerState>((set, get) => ({
  currentServer: null,
  servers: [],

  setCurrentServer: (value) =>
    set(state => ({
      currentServer: typeof value === "function" ? value(state.currentServer) : value,
    })),

  setServers: (value) =>
    set(state => ({
      servers: typeof value === "function" ? value(state.servers) : value,
    })),

  get: (id) => get().servers.find(s => s.id === id),
  getServer: (id) => get().servers.find(s => s.id === id),

  addServer: (server) =>
    set(state => ({
      servers: [...state.servers.filter(s => s.id !== server.id), server],
    })),

  addServers: (newServers) =>
    set(state => {
      const newIds = new Set(newServers.map(s => s.id));
      return { servers: [...state.servers.filter(s => !newIds.has(s.id)), ...newServers] };
    }),

  removeServer: (id) =>
    set(state => ({ servers: state.servers.filter(s => s.id !== id) })),

  removeServers: (ids) =>
    set(state => ({ servers: state.servers.filter(s => !ids.includes(s.id)) })),
}));

export const getSs = () => useServerState.getState();