import { apiRequest } from "./client";
import type { Session } from "../types/auth";

export function login(account: string, password: string) {
  return apiRequest<Session>("/api/login", {
    method: "POST",
    body: JSON.stringify({ account, password })
  });
}

export function restoreSession(token: string) {
  return apiRequest<Session>("/api/session", { token });
}

export function logout(token: string) {
  return apiRequest<{ loggedOut: boolean }>("/api/logout", {
    method: "POST",
    token,
    body: "{}"
  });
}
