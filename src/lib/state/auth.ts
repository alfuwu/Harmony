import { createSignal } from "solid-js";
import { User } from "../utils/types";

const [user, setUser] = createSignal<User | null>(null);
const [token, setToken] = createSignal<string | null>(null);

export const authState = { user, setUser, token, setToken };
