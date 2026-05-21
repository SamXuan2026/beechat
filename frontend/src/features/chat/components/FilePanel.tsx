import { EmptyState } from "../../../components/EmptyState";
import type { Message } from "../../../types/chat";
import { formatFileSize, formatTime } from "../../../utils/format";

interface FilePanelProps {
  error: string | null;
  files: Message[];
  loading: boolean;
}

function isImageFile(name: string) {
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

export function FilePanel({ error, files, loading }: FilePanelProps) {
  return (
    <section className="file-panel" data-testid="file-panel">
      <div className="panel-section-header">
        <div>
          <strong>频道文件</strong>
          <span>{files.length} 个文件</span>
        </div>
        <small>{loading ? "加载中" : "按最近消息排序"}</small>
      </div>
      {loading ? <EmptyState text="正在加载频道文件" /> : null}
      {error ? <div className="message-error">{error}</div> : null}
      {!loading && !error && !files.length ? <EmptyState text="当前频道暂无文件" /> : null}
      {!loading && !error
        ? files.map((message) => {
            if (!message.file) return null;
            const image = isImageFile(message.file.originalName);
            return (
              <a className="file-panel-item" href={message.file.path} key={message.id}>
                {image ? (
                  <img alt={message.file.originalName} src={message.file.path} />
                ) : (
                  <span className="file-panel-icon">文</span>
                )}
                <div>
                  <strong>{message.file.originalName}</strong>
                  <small>
                    {formatFileSize(message.file.size)} · {message.senderName} · {formatTime(message.createdAt)}
                  </small>
                </div>
              </a>
            );
          })
        : null}
    </section>
  );
}
