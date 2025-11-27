import { createSignal } from "solid-js";
import { Member } from "../utils/types";

const [members, setMembers] = createSignal<Member[]>([]);

export const memberState = { members, setMembers };
