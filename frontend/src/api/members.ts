import { apiRequest } from "./client";
import type { ChannelMember } from "../types/audit";
import type { Channel } from "../types/chat";

export function listChannelMembers(token: string, channelId: number) {
  return apiRequest<ChannelMember[]>(`/api/channels/${channelId}/members`, { token });
}

export function inviteChannelMember(token: string, channelId: number, userId: number) {
  return apiRequest<Channel>(`/api/channels/${channelId}/members`, {
    method: "POST",
    token,
    body: JSON.stringify({ userId })
  });
}

export function removeChannelMember(token: string, channelId: number, userId: number) {
  return apiRequest<Channel>(`/api/channels/${channelId}/members/${userId}`, {
    method: "DELETE",
    token
  });
}
