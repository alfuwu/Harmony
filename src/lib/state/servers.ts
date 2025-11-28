import { createSignal } from "solid-js";
import { Server } from "../utils/types";

const [currentServer, setCurrentServer] = createSignal<Server | null>(null);
const [servers, setServers] = createSignal<Server[]>([]);

export const serverState = { currentServer, setCurrentServer, servers, setServers };
