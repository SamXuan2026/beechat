import { FormEvent, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { Modal } from "../../../components/Modal";
import type { User } from "../../../types/auth";
import type { UserSettings } from "../../../types/settings";
import "./SettingsModal.css";

interface SettingsModalProps {
  currentUser: User;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onLogout?: () => void;
  onSave: (settings: UserSettings) => void;
  open: boolean;
  saving: boolean;
  settings: UserSettings | null;
}

export function SettingsModal({
  currentUser,
  error,
  loading,
  onClose,
  onLogout,
  onSave,
  open,
  saving,
  settings
}: SettingsModalProps) {
  const [draft, setDraft] = useState<UserSettings | null>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft) onSave(draft);
  }

  return (
    <Modal open={open} onClose={onClose} title="设置">
      {loading ? <EmptyState text="正在加载设置" /> : null}
      {error ? <div className="message-error">{error}</div> : null}
      {!loading && draft ? (
        <form className="settings-panel" data-testid="settings-panel" onSubmit={handleSubmit}>
          <section className="settings-profile">
            <div className="settings-avatar" style={{ background: currentUser.avatarColor }}>
              {currentUser.avatarText}
            </div>
            <div>
              <strong>{currentUser.account}</strong>
              <span>{roleLabel(currentUser.role)}</span>
            </div>
          </section>
          <label className="settings-field">
            <span>显示名称</span>
            <input
              data-testid="settings-display-name"
              maxLength={24}
              onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
              value={draft.displayName}
            />
          </label>
          <label className="settings-field">
            <span>个人简介</span>
            <textarea
              data-testid="settings-bio"
              maxLength={80}
              onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
              rows={3}
              value={draft.bio}
            />
          </label>
          <section className="settings-toggles">
            <SettingsToggle
              checked={draft.desktopNotify}
              label="桌面通知"
              onChange={(checked) => setDraft({ ...draft, desktopNotify: checked })}
            />
            <SettingsToggle
              checked={draft.emailDigest}
              label="每日摘要"
              onChange={(checked) => setDraft({ ...draft, emailDigest: checked })}
            />
            <SettingsToggle
              checked={draft.soundNotify}
              label="声音提醒"
              onChange={(checked) => setDraft({ ...draft, soundNotify: checked })}
            />
            <SettingsToggle
              checked={draft.compactMode}
              label="紧凑模式"
              onChange={(checked) => setDraft({ ...draft, compactMode: checked })}
            />
          </section>
          <section className="settings-shortcuts">
            <strong>快捷键</strong>
            <div><span>发送消息</span><kbd>Enter</kbd></div>
            <div><span>换行</span><kbd>Shift Enter</kbd></div>
            <div><span>打开线程</span><kbd>点击消息线程</kbd></div>
          </section>
          <footer className="settings-actions">
            {onLogout ? (
              <Button onClick={onLogout} type="button" variant="ghost">
                退出登录
              </Button>
            ) : null}
            <Button disabled={saving || !draft.displayName.trim()} type="submit">
              {saving ? "保存中" : "保存设置"}
            </Button>
          </footer>
        </form>
      ) : null}
    </Modal>
  );
}

function roleLabel(role: User["role"]) {
  if (role === "ADMIN") return "管理员";
  if (role === "AUDITOR") return "审计员";
  if (role === "CHANNEL_ADMIN") return "频道管理员";
  return "成员";
}

interface SettingsToggleProps {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

function SettingsToggle({ checked, label, onChange }: SettingsToggleProps) {
  return (
    <label className="settings-toggle">
      <span>{label}</span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}
