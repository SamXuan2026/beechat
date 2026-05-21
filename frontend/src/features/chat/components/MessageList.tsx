import { Avatar } from "../../../components/Avatar";
import { EmptyState } from "../../../components/EmptyState";
import type { User } from "../../../types/auth";
import type { Message } from "../../../types/chat";
import { formatFileSize, formatTime } from "../../../utils/format";
import "./MessageList.css";

const reactionOptions = ["👍", "✅", "👀"];

function isImageFile(name: string) {
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

interface MessageListProps {
  currentUser: User;
  error: string | null;
  loading: boolean;
  messages: Message[];
  canPinMessages: boolean;
  highlightedMessageId: number | null;
  onFavoriteToggle: (message: Message) => void;
  onPinToggle: (message: Message) => void;
  onReactionToggle: (message: Message, emoji: string) => void;
  onRetry: () => void;
  onThreadOpen: (message: Message) => void;
}

export function MessageList({ canPinMessages, currentUser, error, highlightedMessageId, loading, messages, onFavoriteToggle, onPinToggle, onReactionToggle, onRetry, onThreadOpen }: MessageListProps) {
  const pinnedMessages = messages.filter((message) => message.pinned && !message.revoked);

  return (
    <section className="message-list">
      <div className="message-date">2026年5月8日</div>
      {pinnedMessages.length ? (
        <div className="pinned-summary" data-testid="pinned-summary">
          <strong>置顶消息</strong>
          <span>{pinnedMessages[0].content}</span>
        </div>
      ) : null}
      {loading ? <EmptyState text="正在加载频道消息" /> : null}
      {error ? (
        <div className="message-error" role="alert">
          <span>{error}</span>
          <button onClick={onRetry} type="button">重试</button>
        </div>
      ) : null}
      {!loading && !messages.length ? <EmptyState text="当前频道暂无消息" /> : null}
      {messages.map((message) => {
        const mine = message.senderId === currentUser.id;
        const favoriteUserIds = message.favoriteUserIds || [];
        const favorited = favoriteUserIds.includes(currentUser.id);
        const ownerLabel = mine ? "我" : message.senderName;
        return (
          <article
            className={`message-row ${mine ? "mine" : ""} ${message.id === highlightedMessageId ? "highlighted" : ""}`}
            aria-label={`${ownerLabel}发送的消息`}
            data-message-owner={mine ? "me" : "other"}
            data-testid="message-row"
            key={message.id}
          >
            {!mine ? <Avatar color={message.avatarColor} text={message.avatarText} /> : null}
            <div className="message-content">
              {!mine ? (
                <div className="message-meta">
                  <strong>{message.senderName}</strong>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
              ) : null}
              <div className="message-status-tags">
                {message.pinned ? <span className="message-pin-badge">置顶</span> : null}
                {favorited ? <span className="message-favorite-badge">已收藏</span> : null}
                {message.mentionUserIds?.includes(currentUser.id) ? <span className="message-mention-badge">@我</span> : null}
              </div>
              <p>{message.content}</p>
              {message.file ? (
                <a className={`file-card ${isImageFile(message.file.originalName) ? "image" : ""}`} href={message.file.path}>
                  {isImageFile(message.file.originalName) ? (
                    <img alt={message.file.originalName} src={message.file.path} />
                  ) : null}
                  <strong>{message.file.originalName}</strong>
                  <span>{formatFileSize(message.file.size)} · 点击查看</span>
                </a>
              ) : null}
              <div aria-label="消息操作" className="message-actions" role="group">
                <span>{message.deliveryStatus}</span>
                {message.messageType !== "DIRECT" ? (
                  <button
                    aria-label={`打开 ${ownerLabel} 的线程，${message.replyCount} 条回复`}
                    data-testid="thread-open-button"
                    onClick={() => onThreadOpen(message)}
                    title="打开线程"
                    type="button"
                  >
                    线程 {message.replyCount}
                  </button>
                ) : null}
                {!message.revoked ? (
                  <button
                    aria-label={favorited ? "取消收藏消息" : "收藏消息"}
                    data-testid={`favorite-message-${message.id}`}
                    onClick={() => onFavoriteToggle(message)}
                    title={favorited ? "取消收藏" : "收藏"}
                    type="button"
                  >
                    {favorited ? "取消收藏" : "收藏"}
                  </button>
                ) : null}
                {canPinMessages && !message.revoked && message.messageType !== "DIRECT" ? (
                  <button
                    aria-label={message.pinned ? "取消置顶消息" : "置顶消息"}
                    data-testid={`pin-message-${message.id}`}
                    onClick={() => onPinToggle(message)}
                    title={message.pinned ? "取消置顶" : "置顶"}
                    type="button"
                  >
                    {message.pinned ? "取消置顶" : "置顶"}
                  </button>
                ) : null}
              </div>
              {!message.revoked ? (
                <div aria-label="消息回应" className="message-reactions" role="group">
                  {reactionOptions.map((emoji) => {
                    const userIds = message.reactions?.[emoji] || [];
                    const reacted = userIds.includes(currentUser.id);
                    return (
                      <button
                        aria-label={`${reacted ? "取消" : "添加"} ${emoji} 回应，当前 ${userIds.length} 个`}
                        className={reacted ? "active" : ""}
                        data-testid={`reaction-${message.id}-${emoji}`}
                        key={emoji}
                        onClick={() => onReactionToggle(message, emoji)}
                        title={`${emoji} 回应`}
                        type="button"
                      >
                        {emoji} {userIds.length}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
      {messages.some((message) => message.sensitive) ? (
        <div className="warning-notice">当前频道存在敏感词命中记录，查看</div>
      ) : null}
    </section>
  );
}
