// lib/state/messages.ts
import { createSignal } from "solid-js";
import { Message } from "../utils/types";

const [messages, setMessages] = createSignal<Message[]>([]);

export const messageState = { messages, setMessages };
