import { api } from "./http";

export async function login(username: string, password: string) {
  return api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export async function registerUser(email: string, password: string, username: string) {
  return api("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username })
  });
}
