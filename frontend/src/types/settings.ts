import type { User } from "./auth";
import type { Workspace } from "./chat";

export interface UserSettings {
  bio: string;
  compactMode: boolean;
  desktopNotify: boolean;
  displayName: string;
  emailDigest: boolean;
  soundNotify: boolean;
}

export interface SettingsUpdateResult {
  settings: UserSettings;
  user: User;
  workspace: Workspace;
}
