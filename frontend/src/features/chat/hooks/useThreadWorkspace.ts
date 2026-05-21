import { useCallback, useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { listChannelMessages, sendChannelMessage } from "../../../api/messages";
import type { User } from "../../../types/auth";
import type { Channel, Message } from "../../../types/chat";

interface UseThreadWorkspaceOptions {
  activeChannel?: Channel;
  currentUser: User;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  token: string;
  upsertById: <T extends { id: number }>(items: T[], nextItem: T) => T[];
}

export function useThreadWorkspace({ activeChannel, currentUser, setMessages, token, upsertById }: UseThreadWorkspaceOptions) {
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [threadComposerValue, setThreadComposerValue] = useState("");
  const [threadSending, setThreadSending] = useState(false);

  const refreshThreadMessages = useCallback(async (
    channel: Channel | undefined,
    thread: Message | null,
    options: { silent?: boolean } = {}
  ) => {
    if (!channel || !thread) {
      setThreadMessages([]);
      setThreadError(null);
      return;
    }

    if (!options.silent) setThreadLoading(true);
    setThreadError(null);
    listChannelMessages(token, channel.id, 30, null, thread.id)
      .then((page) => setThreadMessages(page.items))
      .catch((error) => setThreadError(error instanceof Error ? error.message : "线程加载失败"))
      .finally(() => {
        if (!options.silent) setThreadLoading(false);
      });
  }, [token]);

  useEffect(() => {
    refreshThreadMessages(activeChannel, activeThread);
  }, [activeChannel, activeThread, refreshThreadMessages]);

  async function handleThreadSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeChannel || !activeThread || !threadComposerValue.trim() || threadSending) return;
    setThreadSending(true);
    setThreadError(null);
    try {
      const message = await sendChannelMessage(
        token,
        activeChannel.id,
        currentUser.id,
        threadComposerValue,
        activeThread.id
      );
      setThreadMessages((current) => upsertById(current, message));
      setMessages((current) =>
        current.map((item) =>
          item.id === activeThread.id ? { ...item, replyCount: item.replyCount + 1 } : item
        )
      );
      setActiveThread((current) =>
        current && current.id === activeThread.id ? { ...current, replyCount: current.replyCount + 1 } : current
      );
      setThreadComposerValue("");
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : "线程回复发送失败");
    } finally {
      setThreadSending(false);
    }
  }

  return {
    activeThread,
    handleThreadSend,
    refreshThreadMessages,
    setActiveThread,
    setThreadComposerValue,
    setThreadMessages,
    threadComposerValue,
    threadError,
    threadLoading,
    threadMessages,
    threadSending
  };
}
