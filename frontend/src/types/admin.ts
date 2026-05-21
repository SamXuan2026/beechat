import type { AuditLog } from "./audit";
import type { User } from "./auth";
import type { Channel } from "./chat";

export interface AdminUser extends User {
  bio: string;
  disabled: boolean;
  failedAttempts: number;
  lockedUntil: number;
}

export interface SecurityPolicy {
  lockMinutes: number;
  maxLoginFailures: number;
  minPasswordLength: number;
  requireNumber: boolean;
}

export interface UploadPolicy {
  allowedExtensions: string[];
  maxFileSizeMb: number;
}

export interface NetworkPolicy {
  allowedIps: string[];
  enabled: boolean;
}

export interface AdminOverview {
  audits: AuditLog[];
  channels: Channel[];
  metrics: {
    audits: number;
    channels: number;
    messages: number;
    users: number;
  };
  networkPolicy: NetworkPolicy;
  securityPolicy: SecurityPolicy;
  uploadPolicy: UploadPolicy;
  users: AdminUser[];
}
