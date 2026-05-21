import type { FormEvent } from "react";
import { Avatar } from "../../../components/Avatar";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import type { ChannelMember } from "../../../types/audit";
import type { User } from "../../../types/auth";
import type { Channel } from "../../../types/chat";

interface MemberPanelProps {
  activeChannel?: Channel;
  currentUser: User;
  error: string | null;
  inviteCandidates: User[];
  inviteUserId: string;
  loading: boolean;
  memberActionLoading: boolean;
  members: ChannelMember[];
  onInviteMember: (event: FormEvent<HTMLFormElement>) => void;
  onInviteUserChange: (userId: string) => void;
  onMemberRemove: (member: ChannelMember) => void;
}

export function MemberPanel({
  activeChannel,
  currentUser,
  error,
  inviteCandidates,
  inviteUserId,
  loading,
  memberActionLoading,
  members,
  onInviteMember,
  onInviteUserChange,
  onMemberRemove
}: MemberPanelProps) {
  const canManageMembers = currentUser.role === "ADMIN" || currentUser.role === "CHANNEL_ADMIN";

  return (
    <section className="member-panel" data-testid="member-panel">
      <div className="panel-section-header">
        <div>
          <strong># {activeChannel?.name || "general"}</strong>
          <span>{activeChannel?.memberCount || members.length} 位成员</span>
        </div>
        <small>{canManageMembers ? "可管理成员" : "只读成员列表"}</small>
      </div>
      {canManageMembers ? (
        <form className="member-invite" onSubmit={onInviteMember}>
          <select
            data-testid="member-invite-select"
            onChange={(event) => onInviteUserChange(event.target.value)}
            value={inviteUserId}
          >
            <option value="">选择成员</option>
            {inviteCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
          <Button disabled={!inviteUserId || memberActionLoading} type="submit">
            邀请
          </Button>
        </form>
      ) : null}
      {loading ? <EmptyState text="正在加载成员" /> : null}
      {error ? <div className="message-error">{error}</div> : null}
      {!loading && !members.length ? <EmptyState text="暂无频道成员" /> : null}
      <div className="member-list">
        {members.map((member) => (
          <article className="member-row" data-testid="member-row" key={member.id}>
            <Avatar color={member.avatarColor} text={member.avatarText} />
            <div>
              <strong>{member.name}</strong>
              <small>{roleLabel(member.role)}</small>
            </div>
            {canManageMembers && member.id !== currentUser.id ? (
              <button
                data-testid={`remove-member-${member.id}`}
                disabled={memberActionLoading}
                onClick={() => onMemberRemove(member)}
                type="button"
              >
                移除
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function roleLabel(role: ChannelMember["role"]) {
  if (role === "ADMIN") return "管理员";
  if (role === "AUDITOR") return "审计员";
  if (role === "CHANNEL_ADMIN") return "频道管理员";
  return "成员";
}
