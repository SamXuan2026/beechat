import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { getAdminOverview, updateAdminChannel, updateAdminUser, updateNetworkPolicy, updateSecurityPolicy, updateUploadPolicy } from "../../../api/admin";
import type { AdminOverview, NetworkPolicy, SecurityPolicy, UploadPolicy } from "../../../types/admin";
import type { UserRole } from "../../../types/auth";
import type { Channel } from "../../../types/chat";

interface UseAdminWorkspaceOptions {
  currentUserRole: UserRole;
  refreshWorkspace: () => Promise<void>;
  setChannels: Dispatch<SetStateAction<Channel[]>>;
  token: string;
}

export function useAdminWorkspace({ currentUserRole, refreshWorkspace, setChannels, token }: UseAdminWorkspaceOptions) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [savingChannelId, setSavingChannelId] = useState<number | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [savingUploadPolicy, setSavingUploadPolicy] = useState(false);
  const [savingNetworkPolicy, setSavingNetworkPolicy] = useState(false);

  const refreshAdminOverview = useCallback(async (options: { silent?: boolean } = {}) => {
    if (currentUserRole !== "ADMIN") return;
    if (!options.silent) setAdminLoading(true);
    setAdminError(null);
    getAdminOverview(token)
      .then((overview) => setAdminOverview(overview))
      .catch((error) => setAdminError(error instanceof Error ? error.message : "管理数据加载失败"))
      .finally(() => {
        if (!options.silent) setAdminLoading(false);
      });
  }, [currentUserRole, token]);

  async function handleSaveAdminChannel(channelId: number, description: string, announcement: string) {
    if (savingChannelId) return;
    setSavingChannelId(channelId);
    setAdminError(null);
    try {
      const updated = await updateAdminChannel(token, channelId, description, announcement);
      setChannels((current) => current.map((channel) => (channel.id === updated.id ? { ...channel, ...updated } : channel)));
      setAdminOverview((current) =>
        current
          ? {
              ...current,
              channels: current.channels.map((channel) => (channel.id === updated.id ? { ...channel, ...updated } : channel))
            }
          : current
      );
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "频道保存失败");
    } finally {
      setSavingChannelId(null);
    }
  }

  async function handleSaveAdminUser(userId: number, role: UserRole, disabled: boolean) {
    if (savingUserId) return;
    setSavingUserId(userId);
    setAdminError(null);
    try {
      const overview = await updateAdminUser(token, userId, role, disabled);
      setAdminOverview(overview);
      await refreshWorkspace();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "用户权限保存失败");
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleSaveSecurityPolicy(policy: SecurityPolicy) {
    if (savingPolicy) return;
    setSavingPolicy(true);
    setAdminError(null);
    try {
      const overview = await updateSecurityPolicy(token, policy);
      setAdminOverview(overview);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "安全策略保存失败");
    } finally {
      setSavingPolicy(false);
    }
  }

  async function handleSaveUploadPolicy(policy: UploadPolicy) {
    if (savingUploadPolicy) return;
    setSavingUploadPolicy(true);
    setAdminError(null);
    try {
      const overview = await updateUploadPolicy(token, policy);
      setAdminOverview(overview);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "文件策略保存失败");
    } finally {
      setSavingUploadPolicy(false);
    }
  }

  async function handleSaveNetworkPolicy(policy: NetworkPolicy) {
    if (savingNetworkPolicy) return;
    setSavingNetworkPolicy(true);
    setAdminError(null);
    try {
      const overview = await updateNetworkPolicy(token, policy);
      setAdminOverview(overview);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "网络策略保存失败");
    } finally {
      setSavingNetworkPolicy(false);
    }
  }

  return {
    adminError,
    adminLoading,
    adminOpen,
    adminOverview,
    handleSaveAdminChannel,
    handleSaveAdminUser,
    handleSaveNetworkPolicy,
    handleSaveSecurityPolicy,
    handleSaveUploadPolicy,
    refreshAdminOverview,
    savingChannelId,
    savingNetworkPolicy,
    savingPolicy,
    savingUploadPolicy,
    savingUserId,
    setAdminOpen
  };
}
