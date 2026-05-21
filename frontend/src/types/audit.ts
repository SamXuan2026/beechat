export type AuditFilter = "all" | "message" | "file" | "member" | "login";

export interface AuditQuery {
  from: string;
  keyword: string;
  operator: string;
  to: string;
  type: AuditFilter;
}

export interface AuditLog {
  id: number;
  action: string;
  operator: string;
  targetId: string;
  createdAt: string | number;
}

export interface ChannelMember {
  id: number;
  name: string;
  role: "ADMIN" | "AUDITOR" | "CHANNEL_ADMIN" | "USER";
  avatarText: string;
  avatarColor: string;
}
