import type { FormEvent } from "react";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import type { User } from "../../../types/auth";
import type { Channel } from "../../../types/chat";
import "./MessageComposer.css";

interface MessageComposerProps {
  activeChannel?: Channel;
  error: string | null;
  fileInputRef: {
    current: HTMLInputElement | null;
  };
  onFileSelected: (file: File | undefined) => void;
  onMentionInsert: (name: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onValueChange: (value: string) => void;
  mentionCandidates: User[];
  draftSaved: boolean;
  sending: boolean;
  uploading: boolean;
  value: string;
}

export function MessageComposer({
  activeChannel,
  error,
  fileInputRef,
  draftSaved,
  mentionCandidates,
  onFileSelected,
  onMentionInsert,
  onSubmit,
  onValueChange,
  sending,
  uploading,
  value
}: MessageComposerProps) {
  const disabled = sending || uploading || !value.trim();
  const composerState = sending ? "sending" : uploading ? "uploading" : value.trim() ? "ready" : "empty";
  const statusText = sending ? "正在发送" : uploading ? "附件上传中" : value.trim() ? "准备发送" : draftSaved ? "草稿已保存" : "输入消息后发送";

  return (
    <form
      aria-busy={sending || uploading}
      className="composer-preview"
      data-state={composerState}
      data-testid="composer-preview"
      onSubmit={onSubmit}
    >
      {error ? (
        <div className="composer-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="composer-tools">
        <span className="composer-tools-label">格式</span>
        <button aria-label="粗体" className="composer-tool-button" title="粗体" type="button">B</button>
        <button aria-label="斜体" className="composer-tool-button" title="斜体" type="button">I</button>
        <button aria-label="插入链接" className="composer-tool-button" title="插入链接" type="button">↗</button>
        <button aria-label="插入代码" className="composer-tool-button" title="插入代码" type="button">/</button>
        <button
          aria-label={uploading ? "附件上传中" : "上传附件"}
          className="composer-tool-button"
          data-testid="composer-upload-button"
          disabled={uploading || sending}
          onClick={() => fileInputRef.current?.click()}
          title={uploading ? "附件上传中" : "上传附件"}
          type="button"
        >
          {uploading ? "..." : "+"}
        </button>
        <input
          ref={(node) => {
            fileInputRef.current = node;
          }}
          data-testid="file-input"
          hidden
          onChange={(event) => onFileSelected(event.target.files?.[0])}
          type="file"
        />
      </div>
      <div className="composer-body">
        <input
          aria-label="消息内容"
          disabled={sending || uploading}
          data-testid="message-input"
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={`给 #${activeChannel?.name || "general"} 发送消息...`}
          value={value}
        />
        <Button aria-disabled={disabled} disabled={disabled} type="submit">
          {sending ? "发送中" : "发送"}
        </Button>
      </div>
      <div aria-live="polite" className="composer-status" data-testid="composer-status">
        {mentionCandidates.length ? (
          <div className="mention-tools">
            {mentionCandidates.slice(0, 4).map((user) => (
              <button
                aria-label={`插入 @${user.name}`}
                key={user.id}
                onClick={() => onMentionInsert(user.name)}
                type="button"
              >
                @{user.name}
              </button>
            ))}
          </div>
        ) : null}
        <span className="composer-state-text">{statusText}</span>
        <div className="composer-badges">
          <Badge tone="success">加密</Badge>
          {uploading ? <Badge tone="warning">上传中</Badge> : null}
          {!value.trim() ? <Badge tone="warning">待输入</Badge> : null}
          {draftSaved ? <Badge tone="warning">草稿已保存</Badge> : null}
        </div>
      </div>
    </form>
  );
}
