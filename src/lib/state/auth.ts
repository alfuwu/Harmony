import { createSignal } from "solid-js";

const [user, setUser] = createSignal(null);
const [token, setToken] = createSignal<string | null>(null);

export const authState = { user, setUser, token, setToken };
