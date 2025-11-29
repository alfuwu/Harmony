export async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, any> = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  //const token = useAuthState().token;
  //if (token)
  //  headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch("https://localhost:7217/api" + path, {
    ...options,
    headers
  });

  if (!res.ok)
    throw new Error(await res.text());
  return res.json();
}
