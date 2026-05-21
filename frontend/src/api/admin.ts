import { apiRequest } from "./client";
import type { AdminOverview, NetworkPolicy, SecurityPolicy, UploadPolicy } from "../types/admin";
import type { UserRole } from "../types/auth";
import type { Channel } from "../types/chat";

export function getAdminOverview(token: string) {
  return apiRequest<AdminOverview>("/api/admin/overview", { token });
}

export function updateAdminChannel(token: string, channelId: number, description: string, announcement = "") {
  return apiRequest<Channel>(`/api/admin/channels/${channelId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({ announcement, description })
  });
}

export function updateAdminUser(token: string, userId: number, role: UserRole, disabled: boolean) {
  return apiRequest<AdminOverview>(`/api/admin/users/${userId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({ role, disabled })
  });
}

export function updateSecurityPolicy(token: string, policy: SecurityPolicy) {
  return apiRequest<AdminOverview>("/api/admin/security-policy", {
    method: "PUT",
    token,
    body: JSON.stringify(policy)
  });
}

export function updateUploadPolicy(token: string, policy: UploadPolicy) {
  return apiRequest<AdminOverview>("/api/admin/upload-policy", {
    method: "PUT",
    token,
    body: JSON.stringify(policy)
  });
}

export function updateNetworkPolicy(token: string, policy: NetworkPolicy) {
  return apiRequest<AdminOverview>("/api/admin/network-policy", {
    method: "PUT",
    token,
    body: JSON.stringify(policy)
  });
}
