export const sessionStorageKey = "beechat.session";

export function readStoredToken() {
  try {
    const stored = JSON.parse(localStorage.getItem(sessionStorageKey) || "null") as { token?: string } | null;
    return stored?.token || null;
  } catch {
    localStorage.removeItem(sessionStorageKey);
    return null;
  }
}

export function writeStoredToken(token: string) {
  localStorage.setItem(sessionStorageKey, JSON.stringify({ token }));
}

export function clearStoredToken() {
  localStorage.removeItem(sessionStorageKey);
}
