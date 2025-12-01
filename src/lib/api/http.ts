import { hostUrl } from "../../App";

export async function api(path: string, options: RequestInit = {}, retry: number = 0) {
  const headers: Record<string, any> = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const res = await fetch(hostUrl + "/api" + path, {
    ...options,
    headers
  });

  if (res.status === 429) { // rate limited, wait and then retry
    await new Promise(res => setTimeout(res, 1000));
    return api(path, options, retry++);
  } else if (!res.ok) {
    const json = await res.json().catch(() => null);
    if (json && json.error)
      throw new Error(json.error);
    throw new Error(await res.text());
  }
  return res.json();
}
