import { apiRequest } from "./client";
import type { Channel, Workspace } from "../types/chat";

export function getWorkspace(token: string) {
  return apiRequest<Workspace>("/api/workspace", { token });
}

export function createChannel(token: string, name: string, description: string) {
  return apiRequest<Channel>("/api/channels", {
    method: "POST",
    token,
    body: JSON.stringify({ name, description })
  });
}

export function joinChannel(token: string, channelId: number) {
  return apiRequest<Channel>(`/api/channels/${channelId}/join`, {
    method: "POST",
    token,
    body: "{}"
  });
}
