import { Emoji, Message } from "../utils/types";
import { api } from "./http";

export async function sendMessage(channelId: number, content: string, nonce: number, options: RequestInit = {}): Promise<Message> {
  return {
    ...await api(`/channels/${channelId}/messages`, {
      ...options,
      method: "POST",
      body: JSON.stringify({
        content,
        nonce,
        mentions: [...content.matchAll(/<@(-?\d+)>/g)].map(m => Number(m[1])),
        mentionsRoles: [...content.matchAll(/<@&(-?\d+)>/g)].map(m => Number(m[1])),
        mentionsEveryone: content.includes("@everyone") || content.includes("@here"),
      }),
    }),
    sending: false,
  };
}

export async function getMessages(channelId: number, before: number = -1, options: RequestInit = {}): Promise<Message[]> {
  return api(`/channels/${channelId}/messages?before=${before}`, {
    ...options,
    method: "GET",
  });
}

export async function deleteMessage(channelId: number, messageId: number, options: RequestInit = {}): Promise<void> {
  return api(`/channels/${channelId}/messages/${messageId}`, {
    ...options,
    method: "DELETE",
  });
}

export async function editMessage(channelId: number, messageId: number, newContent: string, options: RequestInit = {}): Promise<Message> {
  return api(`/channels/${channelId}/messages/${messageId}`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify({ content: newContent }),
  });
}

export async function pinMessage(channelId: number, messageId: number, options: RequestInit = {}): Promise<Message> {
  return api(`/channels/${channelId}/messages/${messageId}/pin`, {
    ...options,
    method: "POST",
  });
}

export async function react(channelId: number, messageId: number, emoji: Omit<Emoji, "id"> & { id?: number | null }, options: RequestInit = {}): Promise<void> {
  return api(`/channels/${channelId}/messages/${messageId}/reactions`, {
    ...options,
    method: "PUT",
    body: JSON.stringify(emoji),
  });
}

export async function unreact(channelId: number, messageId: number, emoji: Omit<Emoji, "id"> & { id?: number | null }, options: RequestInit = {}): Promise<void> {
  return api(`/channels/${channelId}/messages/${messageId}/reactions`, {
    ...options,
    method: "DELETE",
    body: JSON.stringify(emoji),
  });
}

export async function uploadAttachment(file: File, options: RequestInit = {}): Promise<{ id: number; name: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return api(`/attachments`, { ...options, method: "POST", body: formData });
}