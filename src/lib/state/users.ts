import { createSignal } from "solid-js";
import { User } from "../utils/types";

const [users, setUsers] = createSignal<User[]>([]);

export const userState = { users, setUsers };
