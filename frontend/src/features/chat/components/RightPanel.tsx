import type { FormEvent } from "react";
import { PanelTabs } from "../../../components/PanelTabs";
import type { AuditLog, AuditQuery, ChannelMember } from "../../../types/audit";
import type { User } from "../../../types/auth";
import type { Channel, Message } from "../../../types/chat";
import { AuditPanel } from "./AuditPanel";
import { FilePanel } from "./FilePanel";
import { MemberPanel } from "./MemberPanel";
import "./RightPanel.css";
import { ThreadPanel } from "./ThreadPanel";

export type RightPanelTab = "线程" | "文件" | "审计" | "成员";

interface RightPanelProps {
  activeChannel?: Channel;
  activePanel: RightPanelTab;
  activeThread: Message | null;
  auditQuery: AuditQuery;
  audits: AuditLog[];
  auditsError: string | null;
  auditsLoading: boolean;
  currentUser: User;
  files: Message[];
  filesError: string | null;
  filesLoading: boolean;
  inviteCandidates: User[];
  inviteUserId: string;
  memberActionLoading: boolean;
  members: ChannelMember[];
  membersError: string | null;
  membersLoading: boolean;
  onAuditQueryChange: (query: AuditQuery) => void;
  onInviteMember: (event: FormEvent<HTMLFormElement>) => void;
  onInviteUserChange: (userId: string) => void;
  onMemberRemove: (member: ChannelMember) => void;
  onPanelChange: (tab: RightPanelTab) => void;
  onThreadClose: () => void;
  onThreadReplyChange: (value: string) => void;
  onThreadReplySubmit: (event: FormEvent<HTMLFormElement>) => void;
  threadComposerValue: string;
  threadError: string | null;
  threadLoading: boolean;
  threadMessages: Message[];
  threadSending: boolean;
}

export function RightPanel({
  activeChannel,
  activePanel,
  activeThread,
  auditQuery,
  audits,
  auditsError,
  auditsLoading,
  currentUser,
  files,
  filesError,
  filesLoading,
  inviteCandidates,
  inviteUserId,
  memberActionLoading,
  members,
  membersError,
  membersLoading,
  onAuditQueryChange,
  onInviteMember,
  onInviteUserChange,
  onMemberRemove,
  onPanelChange,
  onThreadClose,
  onThreadReplyChange,
  onThreadReplySubmit,
  threadComposerValue,
  threadError,
  threadLoading,
  threadMessages,
  threadSending
}: RightPanelProps) {
  const tabs = currentUser.role === "ADMIN" || currentUser.role === "AUDITOR" ? ["线程", "文件", "审计", "成员"] : ["线程", "文件", "成员"];

  return (
    <aside className="right-panel" data-testid="thread-panel">
      <header>
        <PanelTabs active={activePanel} onChange={(tab) => onPanelChange(tab as RightPanelTab)} tabs={tabs} />
        <button onClick={onThreadClose} type="button">
          关闭
        </button>
      </header>
      <div className="right-panel-content" data-testid="right-panel-content">
        {activePanel === "线程" ? (
          <ThreadPanel
            activeThread={activeThread}
            composerValue={threadComposerValue}
            error={threadError}
            loading={threadLoading}
            messages={threadMessages}
            onComposerChange={onThreadReplyChange}
            onSubmit={onThreadReplySubmit}
            sending={threadSending}
          />
        ) : null}
        {activePanel === "成员" ? (
          <MemberPanel
            activeChannel={activeChannel}
            currentUser={currentUser}
            error={membersError}
            inviteCandidates={inviteCandidates}
            inviteUserId={inviteUserId}
            loading={membersLoading}
            memberActionLoading={memberActionLoading}
            members={members}
            onInviteMember={onInviteMember}
            onInviteUserChange={onInviteUserChange}
            onMemberRemove={onMemberRemove}
          />
        ) : null}
        {activePanel === "文件" ? (
          <FilePanel
            error={filesError}
            files={files}
            loading={filesLoading}
          />
        ) : null}
        {activePanel === "审计" ? (
          <AuditPanel
            auditQuery={auditQuery}
            audits={audits}
            error={auditsError}
            loading={auditsLoading}
            onAuditQueryChange={onAuditQueryChange}
          />
        ) : null}
      </div>
    </aside>
  );
}
