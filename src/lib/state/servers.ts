import { createSignal } from "solid-js";

const [servers, setServers] = createSignal([]);

export const serverState = { servers, setServers };
