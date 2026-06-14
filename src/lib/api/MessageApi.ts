import { hostUrl } from "../../App";
import { Emoji, Message } from "../utils/Types";
import { api, binapi, raw } from "./Http";

export async function sendMessage(
  channelId: number,
  content: string,
  nonce: number,
  references: number[],
  attachmentIds: number[],
  options: RequestInit = {}
): Promise<Message> {
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
        references,
        ...(attachmentIds.length > 0 ? { attachments: attachmentIds } : {}),
      }),
    }),
    sending: false,
  };
}

export async function getMessages(channelId: number, before: number = -1, amount?: number, options: RequestInit = {}): Promise<Message[]> {
  return api(`/channels/${channelId}/messages?before=${before}` + (amount && amount !== 50 ? `&limit=${amount}` : ''), {
    ...options,
    method: "GET"
  });
}

export async function deleteMessage(channelId: number, messageId: number, options: RequestInit = {}): Promise<void> {
  return api(`/channels/${channelId}/messages/${messageId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function editMessage(channelId: number, messageId: number, newContent: string, options: RequestInit = {}): Promise<Message> {
  return api(`/channels/${channelId}/messages/${messageId}`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify({ content: newContent })
  });
}

export async function pinMessage(channelId: number, messageId: number, options: RequestInit = {}): Promise<Message> {
  return api(`/channels/${channelId}/messages/${messageId}/pin`, {
    ...options,
    method: "POST"
  });
}

export async function react(channelId: number, messageId: number, emoji: Omit<Emoji, "id"> & { id?: number | null }, options: RequestInit = {}): Promise<void> {
  return api(`/channels/${channelId}/messages/${messageId}/reactions`, {
    ...options,
    method: "PUT",
    body: JSON.stringify(emoji)
  });
}

export async function unreact(channelId: number, messageId: number, emoji: Omit<Emoji, "id"> & { id?: number | null }, options: RequestInit = {}): Promise<void> {
  return api(`/channels/${channelId}/messages/${messageId}/reactions`, {
    ...options,
    method: "DELETE",
    body: JSON.stringify(emoji)
  });
}

export async function getAttachment(fileName: string, options: RequestInit = {}): Promise<Blob> {
  return (await raw(`/attachments/${fileName}`, { ...options, method: "GET" })).blob();
}

export async function uploadAttachment(
  file: File,
  options: RequestInit = {},
  onProgress?: (percent: number) => void
): Promise<{ id: number; fileName: string }> {
  if (!onProgress) {
    const formData = new FormData();
    formData.append("file", file);
    return binapi(`/attachments`, { ...options, method: "POST", body: formData });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.open("POST", `${hostUrl}/api/attachments`);

    new Headers(options.headers).forEach((value, key) => xhr.setRequestHeader(key, value));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(formData);
  });
}
