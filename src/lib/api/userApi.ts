import { UserSettings } from "../utils/userSettings";
import { api } from "./http";

export async function registerUser(email: string, password: string, username: string, options: RequestInit = {}): Promise<{ token: string }> {
  return api("/auth/register", {
    ...options,
    method: "POST",
    body: JSON.stringify({ email, password, username })
  });
}

export async function login(username: string, password: string, options: RequestInit = {}): Promise<{ token: string }> {
  return api("/auth/login", {
    ...options,
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export async function changeAvatar(file: File, options: RequestInit = {}): Promise<{ avatar: string }> {
  const formData = new FormData();
  formData.append(file.name, file);

  return api(`/@me/avatar`, {
    ...options,
    method: "POST",
    body: formData
  });
}

export async function changeBanner(file: File, options: RequestInit = {}): Promise<{ avatar: string }> {
  const formData = new FormData();
  formData.append(file.name, file);

  return api(`/@me/banner`, {
    ...options,
    method: "POST",
    body: formData
  });
}

export async function updateSettings(settings: UserSettings, options: RequestInit = {}): Promise<void> {
  await api(`/@me/settings`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(settings)
  });
}