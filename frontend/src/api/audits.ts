import { apiRequest } from "./client";
import type { AuditFilter, AuditLog, AuditQuery } from "../types/audit";

export function listAudits(token: string, type: AuditFilter = "all") {
  return apiRequest<AuditLog[]>(`/api/audits?type=${encodeURIComponent(type)}`, { token });
}

export function searchAudits(token: string, query: AuditQuery) {
  const params = new URLSearchParams();
  params.set("type", query.type);
  if (query.operator.trim()) params.set("operator", query.operator.trim());
  if (query.keyword.trim()) params.set("q", query.keyword.trim());
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  return apiRequest<AuditLog[]>(`/api/audits?${params.toString()}`, { token });
}
