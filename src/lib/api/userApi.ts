import { Server } from "../utils/types";
import { UserSettings } from "../utils/userSettings";
import { api } from "./http";

export async function changeAvatar(file: File, options: RequestInit = {}): Promise<{ avatar: string }> {
  const formData = new FormData();
  formData.append(file.name, file);

  return api(`/users/@me/avatar`, {
    ...options,
    method: "POST",
    body: formData
  });
}

export async function changeBanner(file: File, options: RequestInit = {}): Promise<{ avatar: string }> {
  const formData = new FormData();
  formData.append(file.name, file);

  return api(`/users/@me/banner`, {
    ...options,
    method: "POST",
    body: formData
  });
}

export async function updateSettings(settings: UserSettings, options: RequestInit = {}): Promise<void> {
  await api(`/users/@me/settings`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(settings)
  });
}

export async function updateProfile(user: { displayName?: string, nickname?: string, pronouns?: string, status?: string, bio?: string }, server?: Server, options: RequestInit = {}) {
  await api(`/users/@me/profile${server ? `/${server.id}` : ''}`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(user)
  })
}

export async function updateMe(user: { email?: string, phoneNumber?: string, username?: string, password?: string }, options: RequestInit = {}) {
  await api(`/users/@me`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(user)
  })
}