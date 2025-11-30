import { Message } from "../utils/types";
import { api } from "./http";

export async function sendMessage(channelId: number, content: string, nonce: number, options: RequestInit = {}): Promise<Message> {
  return {...await api(`/channels/${channelId}/messages`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ content, nonce })
  }), sending: false };
}

export async function getMessages(channelId: number, before: number = -1, options: RequestInit = {}): Promise<Message[]> {
  return api(`/channels/${channelId}/messages?before=${before}`, {
    ...options,
    method: "GET"
  });
}
