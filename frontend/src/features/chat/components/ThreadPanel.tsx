import type { FormEvent } from "react";
import { Avatar } from "../../../components/Avatar";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import type { Message } from "../../../types/chat";
import { formatTime } from "../../../utils/format";

interface ThreadPanelProps {
  activeThread: Message | null;
  composerValue: string;
  error: string | null;
  loading: boolean;
  messages: Message[];
  onComposerChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  sending: boolean;
}

export function ThreadPanel({
  activeThread,
  composerValue,
  error,
  loading,
  messages,
  onComposerChange,
  onSubmit,
  sending
}: ThreadPanelProps) {
  if (!activeThread) return <EmptyState text="选择一条消息查看线程" />;

  return (
    <section className="thread-panel" data-testid="thread-detail-panel">
      <div className="panel-section-header">
        <div>
          <strong>线程回复</strong>
          <span>{messages.length} 条回复</span>
        </div>
        <small>{loading ? "加载中" : "实时同步"}</small>
      </div>
      <div className="thread-root">
        <strong>{activeThread.senderName}</strong>
        <small>{formatTime(activeThread.createdAt)}</small>
        <p>{activeThread.content}</p>
      </div>
      <div className="thread-audit">此线程包含客户信息时，转发前需完成脱敏检查。</div>
      <section className="thread-message-list">
        {loading ? <EmptyState text="正在加载线程回复" /> : null}
        {error ? <div className="message-error">{error}</div> : null}
        {!loading && !messages.length ? <EmptyState text="暂无线程回复" /> : null}
        {messages.map((message) => (
          <article className="thread-message" key={message.id}>
            <Avatar color={message.avatarColor} text={message.avatarText} />
            <div>
              <div className="message-meta">
                <strong>{message.senderName}</strong>
                <span>{formatTime(message.createdAt)}</span>
              </div>
              <p>{message.content}</p>
            </div>
          </article>
        ))}
      </section>
      <form className="thread-composer" onSubmit={onSubmit}>
        <input
          data-testid="thread-input"
          onChange={(event) => onComposerChange(event.target.value)}
          placeholder="回复线程..."
          value={composerValue}
        />
        <Button disabled={sending || !composerValue.trim()} type="submit">
          {sending ? "发送中" : "回复"}
        </Button>
      </form>
    </section>
  );
}
