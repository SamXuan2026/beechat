import { apiRequest } from "./client";
import type { SettingsUpdateResult, UserSettings } from "../types/settings";

export function getSettings(token: string) {
  return apiRequest<UserSettings>("/api/settings", { token });
}

export function updateSettings(token: string, settings: UserSettings) {
  return apiRequest<SettingsUpdateResult>("/api/settings", {
    method: "PUT",
    token,
    body: JSON.stringify(settings)
  });
}
