import type { Workspace } from "./chat";

export type UserRole = "ADMIN" | "AUDITOR" | "CHANNEL_ADMIN" | "USER";

export interface User {
  id: number;
  account: string;
  name: string;
  role: UserRole;
  avatarText: string;
  avatarColor: string;
  online: boolean;
}

export interface Session {
  token: string;
  user: User;
  workspace: Workspace;
}
