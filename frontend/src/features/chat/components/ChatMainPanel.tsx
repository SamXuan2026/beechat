import type { FormEvent, RefObject } from "react";
import { Badge } from "../../../components/Badge";
import type { User } from "../../../types/auth";
import type { Channel, Message } from "../../../types/chat";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";
import "./ChatMainPanel.css";

interface ChatMainPanelProps {
  activeChannel?: Channel;
  canManageActiveChannel: boolean;
  composerError: string | null;
  currentUser: User;
  draftSaved: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  highlightedMessageId: number | null;
  memberCount: number;
  mentionCandidates: User[];
  messages: Message[];
  messagesError: string | null;
  messagesLoading: boolean;
  onComposerChange: (value: string) => void;
  onFavoriteToggle: (message: Message) => void;
  onFileSelected: (file: File | undefined) => void;
  onMentionInsert: (name: string) => void;
  onPinToggle: (message: Message) => void;
  onReactionToggle: (message: Message, emoji: string) => void;
  onRetryMessages: () => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  onThreadOpen: (message: Message) => void;
  sending: boolean;
  uploading: boolean;
  value: string;
}

export function ChatMainPanel({
  activeChannel,
  canManageActiveChannel,
  composerError,
  currentUser,
  draftSaved,
  fileInputRef,
  highlightedMessageId,
  memberCount,
  mentionCandidates,
  messages,
  messagesError,
  messagesLoading,
  onComposerChange,
  onFavoriteToggle,
  onFileSelected,
  onMentionInsert,
  onPinToggle,
  onReactionToggle,
  onRetryMessages,
  onSend,
  onThreadOpen,
  sending,
  uploading,
  value
}: ChatMainPanelProps) {
  const pinnedMessages = messages.filter((message) => message.pinned && !message.revoked);

  return (
    <main className="chat-main">
      <header className="chat-topbar">
        <div className="chat-topbar-title">
          <span className="channel-icon">#</span>
          <div>
            <strong>{activeChannel?.name || "general"}</strong>
            <small>{memberCount} 成员 · 当前频道 · 实时协作</small>
          </div>
        </div>
        <div className="topbar-tags" aria-label="频道安全状态">
          <Badge tone="success">内网审计</Badge>
          <Badge tone="success">消息留痕</Badge>
          <Badge tone="success">文件脱敏</Badge>
        </div>
      </header>
      <section className="channel-notices" aria-label="频道提示" data-testid="channel-info-bar">
        <div className="secure-notice">
          <strong>安全协作</strong>
          <span>消息留痕、文件脱敏与敏感词提醒已开启</span>
        </div>
        {activeChannel?.announcement ? (
          <div className="channel-announcement" data-testid="channel-announcement">
            <strong>频道公告</strong>
            <span>{activeChannel.announcement}</span>
          </div>
        ) : null}
        {pinnedMessages.length ? (
          <div className="channel-announcement pinned-notice">
            <strong>置顶摘要</strong>
            <span>{pinnedMessages[0].content}</span>
          </div>
        ) : null}
      </section>
      <MessageList
        canPinMessages={canManageActiveChannel}
        currentUser={currentUser}
        error={messagesError}
        highlightedMessageId={highlightedMessageId}
        loading={messagesLoading}
        messages={messages}
        onFavoriteToggle={onFavoriteToggle}
        onPinToggle={onPinToggle}
        onReactionToggle={onReactionToggle}
        onRetry={onRetryMessages}
        onThreadOpen={onThreadOpen}
      />
      <MessageComposer
        activeChannel={activeChannel}
        error={composerError}
        draftSaved={draftSaved}
        fileInputRef={fileInputRef}
        mentionCandidates={mentionCandidates}
        onFileSelected={onFileSelected}
        onMentionInsert={onMentionInsert}
        onSubmit={onSend}
        onValueChange={onComposerChange}
        sending={sending}
        uploading={uploading}
        value={value}
      />
    </main>
  );
}
