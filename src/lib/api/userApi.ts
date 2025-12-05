import { Server } from "../utils/types";
import { UserSettings } from "../utils/userSettings";
import { api, binapi } from "./http";

export async function changeAvatar(file: File, options: RequestInit = {}): Promise<{ avatar: string }> {
  const formData = new FormData();
  formData.append("file", file);

  return binapi(`/users/@me/avatar`, {
    ...options,
    method: "POST",
    body: formData
  });
}
export async function changeBanner(file: File, options: RequestInit = {}): Promise<{ banner: string }> {
  const formData = new FormData();
  formData.append("file", file);

  return binapi(`/users/@me/banner`, {
    ...options,
    method: "POST",
    body: formData
  });
}

export async function deleteAvatar(options: RequestInit = {}): Promise<{ avatar: string | null }> {
  return api(`/users/@me/avatar`, {
    ...options,
    method: "DELETE"
  });
}
export async function deleteBanner(options: RequestInit = {}): Promise<{ banner: string | null }> {
  return api(`/users/@me/banner`, {
    ...options,
    method: "DELETE"
  });
}

export async function updateSettings(settings: UserSettings, options: RequestInit = {}): Promise<void> {
  await api(`/users/@me/settings`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(settings)
  });
}

export async function updateProfile(user: { displayName?: string | null, nickname?: string | null, pronouns?: string | null, status?: string | null, bio?: string | null }, server?: Server, options: RequestInit = {}) {
  await api(`/users/@me/profile${server ? `/${server.id}` : ''}`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(user)
  })
}

export async function updateMe(user: { email?: string | null, phoneNumber?: string | null, username?: string | null, password?: string | null }, options: RequestInit = {}) {
  await api(`/users/@me`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(user)
  })
}