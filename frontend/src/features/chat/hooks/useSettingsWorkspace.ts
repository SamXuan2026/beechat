import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getSettings, updateSettings } from "../../../api/settings";
import type { User } from "../../../types/auth";
import type { Channel, Workspace } from "../../../types/chat";
import type { UserSettings } from "../../../types/settings";

interface UseSettingsWorkspaceOptions {
  setChannels: Dispatch<SetStateAction<Channel[]>>;
  setCurrentUser: Dispatch<SetStateAction<User>>;
  setDirectUnreadCounts: Dispatch<SetStateAction<Record<string, number>>>;
  setWorkspaceUsers: Dispatch<SetStateAction<User[]>>;
  token: string;
}

export function useSettingsWorkspace({ setChannels, setCurrentUser, setDirectUnreadCounts, setWorkspaceUsers, token }: UseSettingsWorkspaceOptions) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsOpen || settings) return;
    setSettingsLoading(true);
    setSettingsError(null);
    getSettings(token)
      .then((nextSettings) => setSettings(nextSettings))
      .catch((error) => setSettingsError(error instanceof Error ? error.message : "设置加载失败"))
      .finally(() => setSettingsLoading(false));
  }, [settings, settingsOpen, token]);

  async function handleSaveSettings(nextSettings: UserSettings) {
    if (settingsSaving) return;
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const result: { settings: UserSettings; user: User; workspace: Workspace } = await updateSettings(token, nextSettings);
      setSettings(result.settings);
      setCurrentUser(result.user);
      setWorkspaceUsers(result.workspace.users);
      setChannels(result.workspace.channels);
      setDirectUnreadCounts(result.workspace.directUnreadCounts);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "设置保存失败");
    } finally {
      setSettingsSaving(false);
    }
  }

  return {
    handleSaveSettings,
    setSettingsOpen,
    settings,
    settingsError,
    settingsLoading,
    settingsOpen,
    settingsSaving
  };
}
