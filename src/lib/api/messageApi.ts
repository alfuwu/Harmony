import { Message } from "../utils/types";
import { api } from "./http";

export async function sendMessage(channelId: number, content: string) {
  return api(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content })
  });
}

export async function registerUser(channelId: number, before: number = -1): Promise<Message[]> {
  return api(`/channels/${channelId}/messages?before=${before}`, {
    method: "GET"
  });
}
