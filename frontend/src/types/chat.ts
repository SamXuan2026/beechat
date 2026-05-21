import type { User } from "./auth";

export interface Channel {
  id: number;
  name: string;
  description: string;
  announcement: string;
  joined: boolean;
  memberCount: number;
  unreadCount: number;
  mentionCount: number;
}

export interface Workspace {
  name: string;
  securityMode: string;
  users: User[];
  channels: Channel[];
  directUnreadCounts: Record<string, number>;
}

export interface MessageFile {
  originalName: string;
  storedName?: string;
  size: number;
  path: string;
}

export interface Message {
  id: number;
  channelId?: number;
  parentId?: number | null;
  messageType?: "CHANNEL" | "THREAD" | "DIRECT";
  receiverId?: number | null;
  senderId: number;
  senderName: string;
  avatarText: string;
  avatarColor: string;
  content: string;
  createdAt: string | number;
  edited: boolean;
  pinned: boolean;
  favoriteUserIds: number[];
  reactions: Record<string, number[]>;
  mentionUserIds: number[];
  revoked: boolean;
  sensitive: boolean;
  deliveryStatus: string;
  replyCount: number;
  file?: MessageFile;
}

export interface RealtimeEvent {
  event:
    | "connected"
    | "message:channel"
    | "message:thread"
    | "message:direct"
    | "message:edited"
    | "message:favorite"
    | "message:pinned"
    | "message:reaction"
    | "message:revoked"
    | "file:uploaded"
    | "members:changed"
    | "presence:updated"
    | "channel:created"
    | "channel:updated";
  payload?: {
    channel?: Channel;
    channelId?: number;
    message?: Message;
    users?: User[];
    userId?: number;
  };
  time?: string;
}
