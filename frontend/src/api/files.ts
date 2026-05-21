import { apiRequest } from "./client";
import type { Message } from "../types/chat";

export function uploadChannelFile(token: string, channelId: number, file: File) {
  const formData = new FormData();
  formData.append("channelId", String(channelId));
  formData.append("file", file);
  return apiRequest<Message>("/api/files", {
    method: "POST",
    token,
    body: formData
  });
}

export function listChannelFiles(token: string, channelId: number) {
  return apiRequest<Message[]>(`/api/channels/${channelId}/files`, { token });
}
