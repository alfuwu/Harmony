import { hostUrl } from "../../App";
import { useAuthState } from "../state/Auth";
import { BigJSON } from "../utils/JSON";
import { Emoji, Message } from "../utils/Types";
import { api, binapi, raw } from "./Http";

export async function sendMessage(
  channelId: bigint,
  content: string,
  nonce: bigint,
  references: bigint[],
  attachmentIds: bigint[],
  options: RequestInit = {}
): Promise<Message> {
  return {
    ...await api(`/channels/${channelId}/messages`, {
      ...options,
      method: "POST",
      body: BigJSON.stringify({
        content,
        nonce,
        mentions: [...content.matchAll(/<@(-?\d+)>/g)].map(m => BigInt(m[1])),
        mentionsRoles: [...content.matchAll(/<@&(-?\d+)>/g)].map(m => BigInt(m[1])),
        mentionsEveryone: content.includes("@everyone") || content.includes("@here"),
        references,
        ...(attachmentIds.length > 0 ? { attachments: attachmentIds } : {}),
      }),
    }),
    sending: false
  };
}

export async function getMessages(channelId: bigint, before: bigint = -1n, amount?: number, options: RequestInit = {}): Promise<Message[]> {
  return api(`/channels/${channelId}/messages` + (before && before > -1 ? `?before=${before}` : '') + (amount && amount !== 50 ? `&limit=${amount}` : ''), {
    ...options,
    method: "GET"
  });
}

export async function deleteMessage(channelId: bigint, messageId: bigint, options: RequestInit = {}): Promise<void> {
  return api(`/channels/${channelId}/messages/${messageId}`, {
    ...options,
    method: "DELETE"
  });
}

export async function editMessage(channelId: bigint, messageId: bigint, newContent: string, options: RequestInit = {}): Promise<Message> {
  return api(`/channels/${channelId}/messages/${messageId}`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify({ content: newContent })
  });
}

export async function pinMessage(channelId: bigint, messageId: bigint, options: RequestInit = {}): Promise<Message> {
  return api(`/channels/${channelId}/messages/${messageId}/pin`, {
    ...options,
    method: "POST"
  });
}

export async function react(channelId: bigint, messageId: bigint, emoji: Omit<Emoji, "id"> & { id?: bigint | null }, options: RequestInit = {}): Promise<void> {
  return api(`/channels/${channelId}/messages/${messageId}/reactions`, {
    ...options,
    method: "PUT",
    body: BigJSON.stringify(emoji)
  });
}

export async function unreact(channelId: bigint, messageId: bigint, emoji: Omit<Emoji, "id"> & { id?: bigint | null }, options: RequestInit = {}): Promise<void> {
  return api(`/channels/${channelId}/messages/${messageId}/reactions`, {
    ...options,
    method: "DELETE",
    body: BigJSON.stringify(emoji)
  });
}

export async function getAttachment(fileName: string, options: RequestInit = {}): Promise<Blob> {
  return (await raw(`/attachments/${fileName}`, { ...options, method: "GET" })).blob();
}

export async function uploadAttachment(
  file: File,
  onProgress?: (percent: number) => void,
  options: RequestInit = {}
): Promise<{ id: bigint; fileName: string }> {
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
    xhr.setRequestHeader("Authorization", `Bearer ${useAuthState.getState().token}`);

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
