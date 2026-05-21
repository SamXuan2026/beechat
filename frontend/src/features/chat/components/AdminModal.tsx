import { FormEvent, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { Modal } from "../../../components/Modal";
import type { AdminOverview, AdminUser, NetworkPolicy, SecurityPolicy, UploadPolicy } from "../../../types/admin";
import type { UserRole } from "../../../types/auth";
import type { Channel } from "../../../types/chat";
import { formatTime } from "../../../utils/format";
import "./AdminModal.css";

interface AdminModalProps {
  error: string | null;
  exportUrl: string;
  loading: boolean;
  onChannelSave: (channelId: number, description: string, announcement: string) => void;
  onClose: () => void;
  onNetworkPolicySave: (policy: NetworkPolicy) => void;
  onPolicySave: (policy: SecurityPolicy) => void;
  onUploadPolicySave: (policy: UploadPolicy) => void;
  onUserSave: (userId: number, role: UserRole, disabled: boolean) => void;
  open: boolean;
  overview: AdminOverview | null;
  savingChannelId: number | null;
  savingNetworkPolicy: boolean;
  savingPolicy: boolean;
  savingUploadPolicy: boolean;
  savingUserId: number | null;
}

export function AdminModal({
  error,
  exportUrl,
  loading,
  onChannelSave,
  onClose,
  onNetworkPolicySave,
  onPolicySave,
  onUploadPolicySave,
  onUserSave,
  open,
  overview,
  savingChannelId,
  savingNetworkPolicy,
  savingPolicy,
  savingUploadPolicy,
  savingUserId
}: AdminModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="管理后台">
      {loading ? <EmptyState text="正在加载管理数据" /> : null}
      {error ? <div className="message-error">{error}</div> : null}
      {!loading && overview ? (
        <section className="admin-panel" data-testid="admin-panel">
          <div className="admin-hero">
            <div>
              <strong>企业管理控制台</strong>
              <span>集中维护成员、频道、安全策略和审计导出</span>
            </div>
            <a className="admin-export-link primary" data-testid="admin-audit-export" href={exportUrl}>导出审计 CSV</a>
          </div>
          <div className="admin-metrics">
            <Metric label="用户" value={overview.metrics.users} />
            <Metric label="频道" value={overview.metrics.channels} />
            <Metric label="消息" value={overview.metrics.messages} />
            <Metric label="审计" value={overview.metrics.audits} />
          </div>
          <section className="admin-section">
            <h3>用户管理</h3>
            <div className="admin-list">
              {overview.users.map((user) => (
                <UserAdminRow
                  key={user.id}
                  onSave={onUserSave}
                  saving={savingUserId === user.id}
                  user={user}
                />
              ))}
            </div>
          </section>
          <section className="admin-policy-layout" aria-label="策略配置">
            <SecurityPolicyForm
              onSave={onPolicySave}
              policy={overview.securityPolicy}
              saving={savingPolicy}
            />
            <UploadPolicyForm
              onSave={onUploadPolicySave}
              policy={overview.uploadPolicy}
              saving={savingUploadPolicy}
            />
            <NetworkPolicyForm
              onSave={onNetworkPolicySave}
              policy={overview.networkPolicy}
              saving={savingNetworkPolicy}
            />
          </section>
          <section className="admin-section">
            <h3>频道管理</h3>
            <div className="admin-list">
              {overview.channels.map((channel) => (
                <ChannelAdminRow
                  channel={channel}
                  key={channel.id}
                  onSave={onChannelSave}
                  saving={savingChannelId === channel.id}
                />
              ))}
            </div>
          </section>
          <section className="admin-section">
            <div className="admin-section-title">
              <h3>审计详情</h3>
              <span>最近 {overview.audits.length} 条</span>
            </div>
            <div className="admin-list">
              {overview.audits.map((audit) => (
                <article className="admin-row" data-testid="admin-audit-row" key={audit.id}>
                  <div>
                    <strong>{audit.action}</strong>
                    <small>{audit.operator} · {formatTime(audit.createdAt)}</small>
                  </div>
                  <span>{audit.targetId}</span>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}
    </Modal>
  );
}

interface UserAdminRowProps {
  onSave: (userId: number, role: UserRole, disabled: boolean) => void;
  saving: boolean;
  user: AdminUser;
}

function UserAdminRow({ onSave, saving, user }: UserAdminRowProps) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [disabled, setDisabled] = useState(user.disabled);

  useEffect(() => {
    setRole(user.role);
    setDisabled(user.disabled);
  }, [user.disabled, user.role]);

  return (
    <form className="admin-user-row" data-testid={`admin-user-row-${user.account}`} onSubmit={(event) => {
      event.preventDefault();
      onSave(user.id, role, disabled);
    }}>
      <div>
        <strong>{user.name}</strong>
        <small>
          {user.account} · {user.bio || "暂无简介"} · 失败 {user.failedAttempts} 次
        </small>
      </div>
      <select
        data-testid={`admin-user-role-${user.account}`}
        onChange={(event) => setRole(event.target.value as UserRole)}
        value={role}
      >
        <option value="ADMIN">管理员</option>
        <option value="AUDITOR">审计员</option>
        <option value="CHANNEL_ADMIN">频道管理员</option>
        <option value="USER">成员</option>
      </select>
      <label>
        <input checked={disabled} onChange={(event) => setDisabled(event.target.checked)} type="checkbox" />
        停用
      </label>
      <Button disabled={saving} data-testid={`admin-user-save-${user.account}`} type="submit">
        {saving ? "保存中" : "保存"}
      </Button>
    </form>
  );
}

interface SecurityPolicyFormProps {
  onSave: (policy: SecurityPolicy) => void;
  policy: SecurityPolicy;
  saving: boolean;
}

function SecurityPolicyForm({ onSave, policy, saving }: SecurityPolicyFormProps) {
  const [draft, setDraft] = useState(policy);

  useEffect(() => {
    setDraft(policy);
  }, [policy]);

  return (
    <form className="admin-section admin-policy" onSubmit={(event) => {
      event.preventDefault();
      onSave(draft);
    }}>
      <div className="admin-policy-heading">
        <h3>安全策略</h3>
        <span>登录与密码</span>
      </div>
      <div className="admin-policy-grid">
        <label>
          <span>失败锁定次数</span>
          <input
            data-testid="admin-policy-max-failures"
            max={10}
            min={3}
            onChange={(event) => setDraft({ ...draft, maxLoginFailures: Number(event.target.value) })}
            type="number"
            value={draft.maxLoginFailures}
          />
        </label>
        <label>
          <span>锁定分钟</span>
          <input
            max={1440}
            min={1}
            onChange={(event) => setDraft({ ...draft, lockMinutes: Number(event.target.value) })}
            type="number"
            value={draft.lockMinutes}
          />
        </label>
        <label>
          <span>最小密码长度</span>
          <input
            max={32}
            min={6}
            onChange={(event) => setDraft({ ...draft, minPasswordLength: Number(event.target.value) })}
            type="number"
            value={draft.minPasswordLength}
          />
        </label>
        <label className="admin-policy-check">
          <input
            checked={draft.requireNumber}
            onChange={(event) => setDraft({ ...draft, requireNumber: event.target.checked })}
            type="checkbox"
          />
          必须包含数字
        </label>
      </div>
      <Button disabled={saving} type="submit">
        {saving ? "保存中" : "保存安全策略"}
      </Button>
    </form>
  );
}

interface UploadPolicyFormProps {
  onSave: (policy: UploadPolicy) => void;
  policy: UploadPolicy;
  saving: boolean;
}

function UploadPolicyForm({ onSave, policy, saving }: UploadPolicyFormProps) {
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(policy.maxFileSizeMb);
  const [allowedExtensions, setAllowedExtensions] = useState(policy.allowedExtensions.join(", "));

  useEffect(() => {
    setMaxFileSizeMb(policy.maxFileSizeMb);
    setAllowedExtensions(policy.allowedExtensions.join(", "));
  }, [policy.allowedExtensions, policy.maxFileSizeMb]);

  return (
    <form className="admin-section admin-policy" onSubmit={(event) => {
      event.preventDefault();
      onSave({
        allowedExtensions: allowedExtensions.split(",").map((item) => item.trim()).filter(Boolean),
        maxFileSizeMb
      });
    }}>
      <div className="admin-policy-heading">
        <h3>文件策略</h3>
        <span>上传限制</span>
      </div>
      <div className="admin-policy-grid">
        <label>
          <span>最大文件 MB</span>
          <input
            data-testid="admin-upload-max-size"
            max={100}
            min={1}
            onChange={(event) => setMaxFileSizeMb(Number(event.target.value))}
            type="number"
            value={maxFileSizeMb}
          />
        </label>
        <label>
          <span>允许扩展名</span>
          <input
            data-testid="admin-upload-extensions"
            onChange={(event) => setAllowedExtensions(event.target.value)}
            placeholder=".txt, .pdf, .png"
            value={allowedExtensions}
          />
        </label>
      </div>
      <Button disabled={saving || !allowedExtensions.trim()} type="submit">
        {saving ? "保存中" : "保存文件策略"}
      </Button>
    </form>
  );
}

interface NetworkPolicyFormProps {
  onSave: (policy: NetworkPolicy) => void;
  policy: NetworkPolicy;
  saving: boolean;
}

function NetworkPolicyForm({ onSave, policy, saving }: NetworkPolicyFormProps) {
  const [enabled, setEnabled] = useState(policy.enabled);
  const [allowedIps, setAllowedIps] = useState(policy.allowedIps.join(", "));

  useEffect(() => {
    setEnabled(policy.enabled);
    setAllowedIps(policy.allowedIps.join(", "));
  }, [policy.allowedIps, policy.enabled]);

  return (
    <form className="admin-section admin-policy" onSubmit={(event) => {
      event.preventDefault();
      onSave({
        allowedIps: allowedIps.split(",").map((item) => item.trim()).filter(Boolean),
        enabled
      });
    }}>
      <div className="admin-policy-heading">
        <h3>网络策略</h3>
        <span>{enabled ? "白名单已开启" : "白名单未开启"}</span>
      </div>
      <div className="admin-policy-grid">
        <label className="admin-policy-check">
          <input
            checked={enabled}
            data-testid="admin-network-enabled"
            onChange={(event) => setEnabled(event.target.checked)}
            type="checkbox"
          />
          开启 IP 白名单
        </label>
        <label>
          <span>允许 IP</span>
          <input
            data-testid="admin-network-ips"
            onChange={(event) => setAllowedIps(event.target.value)}
            placeholder="127.0.0.1, 10.0.0.8"
            value={allowedIps}
          />
        </label>
      </div>
      <Button disabled={saving || !allowedIps.trim()} type="submit">
        {saving ? "保存中" : "保存网络策略"}
      </Button>
    </form>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

interface ChannelAdminRowProps {
  channel: Channel;
  onSave: (channelId: number, description: string, announcement: string) => void;
  saving: boolean;
}

function ChannelAdminRow({ channel, onSave, saving }: ChannelAdminRowProps) {
  const [description, setDescription] = useState(channel.description);
  const [announcement, setAnnouncement] = useState(channel.announcement || "");

  useEffect(() => {
    setDescription(channel.description);
    setAnnouncement(channel.announcement || "");
  }, [channel.announcement, channel.description]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(channel.id, description, announcement);
  }

  return (
    <form className="admin-channel-row" onSubmit={handleSubmit}>
      <div>
        <strong># {channel.name}</strong>
        <small>{channel.memberCount} 成员 · {channel.joined ? "已加入" : "未加入"}</small>
      </div>
      <input
        data-testid={`admin-channel-description-${channel.name}`}
        maxLength={80}
        onChange={(event) => setDescription(event.target.value)}
        value={description}
      />
      <input
        data-testid={`admin-channel-announcement-${channel.name}`}
        maxLength={160}
        onChange={(event) => setAnnouncement(event.target.value)}
        placeholder="频道公告"
        value={announcement}
      />
      <Button disabled={saving || !description.trim()} type="submit">
        {saving ? "保存中" : "保存"}
      </Button>
    </form>
  );
}
