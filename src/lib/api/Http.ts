import { hostUrl } from "../../App";
import { getAs } from "../state/Auth";

export async function api(path: string, options: RequestInit = {}) {
  return binapi(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers }});
}

export async function binapi(path: string, options: RequestInit = {}) {
  const res = await raw(path, options);
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    if (json && json.error)
      throw new Error(json.error);
    throw new Error(await res.text());
  }
  if (res.status !== 204)
    return res.json();
}

export async function raw(path: string, options: RequestInit = {}, retry: number = 0) {
  const token = getAs().token;

  const headers: Record<string, any> = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const res = await fetch(hostUrl + "/api" + path, {
    ...options,
    headers
  });

  if (res.status === 429) { // rate limited, wait and then retry
    await new Promise(res => setTimeout(res, 1000));
    return raw(path, options, retry++);
  }
  return res;
}