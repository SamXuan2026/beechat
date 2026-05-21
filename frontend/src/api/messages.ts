import { apiRequest } from "./client";
import type { PageResult } from "../types/api";
import type { Message } from "../types/chat";

export function listChannelMessages(
  token: string,
  channelId: number,
  pageSize = 30,
  beforeId?: number | null,
  parentId?: number | null
) {
  const query = new URLSearchParams({ pageSize: String(pageSize) });
  if (beforeId) query.set("beforeId", String(beforeId));
  if (parentId) query.set("parentId", String(parentId));
  return apiRequest<PageResult<Message>>(`/api/channels/${channelId}/messages?${query.toString()}`, { token });
}

export function sendChannelMessage(token: string, channelId: number, senderId: number, content: string, parentId?: number | null) {
  return apiRequest<Message>("/api/messages", {
    method: "POST",
    token,
    body: JSON.stringify({ channelId, senderId, content, parentId })
  });
}

export function updateMessage(token: string, messageId: number, content: string) {
  return apiRequest<Message>(`/api/messages/${messageId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({ content })
  });
}

export function revokeMessage(token: string, messageId: number) {
  return apiRequest<Message>(`/api/messages/${messageId}/revoke`, {
    method: "POST",
    token,
    body: "{}"
  });
}

export function pinMessage(token: string, messageId: number, pinned: boolean) {
  return apiRequest<Message>(`/api/messages/${messageId}/pin`, {
    method: "POST",
    token,
    body: JSON.stringify({ pinned })
  });
}

export function favoriteMessage(token: string, messageId: number, favorited: boolean) {
  return apiRequest<Message>(`/api/messages/${messageId}/favorite`, {
    method: "POST",
    token,
    body: JSON.stringify({ favorited })
  });
}

export function reactToMessage(token: string, messageId: number, emoji: string, reacted: boolean) {
  return apiRequest<Message>(`/api/messages/${messageId}/reactions`, {
    method: "POST",
    token,
    body: JSON.stringify({ emoji, reacted })
  });
}
