import { apiRequest } from "./client";

export interface SearchResult {
  channelId?: number | null;
  content: string;
  createdAt: string;
  id: number;
  messageType: "CHANNEL" | "THREAD" | "DIRECT";
  peerId?: number | null;
  senderName: string;
  title: string;
}

export function searchMessages(token: string, keyword: string) {
  const query = new URLSearchParams({ q: keyword });
  return apiRequest<SearchResult[]>(`/api/search?${query.toString()}`, { token });
}
