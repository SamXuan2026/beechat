import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { createChannel, joinChannel } from "../../../api/channels";
import type { Channel } from "../../../types/chat";

interface UseDiscoverChannelsOptions {
  setActiveChannelId: (channelId: number) => void;
  setChannels: Dispatch<SetStateAction<Channel[]>>;
  token: string;
}

export function useDiscoverChannels({ setActiveChannelId, setChannels, token }: UseDiscoverChannelsOptions) {
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [channelActionError, setChannelActionError] = useState<string | null>(null);
  const [channelActionLoading, setChannelActionLoading] = useState(false);

  async function handleJoinChannel(channel: Channel) {
    if (channelActionLoading) return;
    setChannelActionLoading(true);
    setChannelActionError(null);
    try {
      const joined = await joinChannel(token, channel.id);
      setChannels((current) => current.map((item) => (item.id === joined.id ? { ...item, ...joined } : item)));
      setActiveChannelId(joined.id);
      setDiscoverOpen(false);
    } catch (error) {
      setChannelActionError(error instanceof Error ? error.message : "加入频道失败");
    } finally {
      setChannelActionLoading(false);
    }
  }

  async function handleCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!channelName.trim() || channelActionLoading) return;
    setChannelActionLoading(true);
    setChannelActionError(null);
    try {
      const created = await createChannel(token, channelName, channelDescription || "企业内部协作频道");
      setChannels((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setActiveChannelId(created.id);
      setChannelName("");
      setChannelDescription("");
      setDiscoverOpen(false);
    } catch (error) {
      setChannelActionError(error instanceof Error ? error.message : "创建频道失败");
    } finally {
      setChannelActionLoading(false);
    }
  }

  return {
    channelActionError,
    channelActionLoading,
    channelDescription,
    channelName,
    discoverOpen,
    handleCreateChannel,
    handleJoinChannel,
    setChannelDescription,
    setChannelName,
    setDiscoverOpen
  };
}
