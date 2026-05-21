import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchAudits } from "../../api/audits";
import { getWorkspace } from "../../api/channels";
import { listChannelFiles, uploadChannelFile } from "../../api/files";
import { inviteChannelMember, listChannelMembers, removeChannelMember } from "../../api/members";
import { favoriteMessage, listChannelMessages, pinMessage, reactToMessage, sendChannelMessage } from "../../api/messages";
import type { AuditLog, AuditQuery, ChannelMember } from "../../types/audit";
import type { User } from "../../types/auth";
import type { Channel, Message, RealtimeEvent, Workspace } from "../../types/chat";
import { ChatSidebar } from "./components/ChatSidebar";
import { AdminModal } from "./components/AdminModal";
import { ChatMainPanel } from "./components/ChatMainPanel";
import { DiscoverChannelsModal } from "./components/DiscoverChannelsModal";
import { RightPanel, type RightPanelTab } from "./components/RightPanel";
import { SettingsModal } from "./components/SettingsModal";
import { useAdminWorkspace } from "./hooks/useAdminWorkspace";
import { useDiscoverChannels } from "./hooks/useDiscoverChannels";
import { useDraftComposer } from "./hooks/useDraftComposer";
import { useSettingsWorkspace } from "./hooks/useSettingsWorkspace";
import { useThreadWorkspace } from "./hooks/useThreadWorkspace";
import { useWorkspaceSearch } from "./hooks/useWorkspaceSearch";
import { useRealtime } from "./useRealtime";
import "./ChatWorkspace.css";

interface ChatWorkspaceProps {
  onLogout?: () => void;
  token: string;
  user: User;
  workspace: Workspace;
}

function upsertById<T extends { id: number }>(items: T[], nextItem: T) {
  return items.some((item) => item.id === nextItem.id)
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [...items, nextItem];
}

export function ChatWorkspace({ onLogout, token, user, workspace }: ChatWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentUser, setCurrentUser] = useState<User>(user);
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>(workspace.users);
  const [channels, setChannels] = useState<Channel[]>(workspace.channels);
  const [directUnreadCounts, setDirectUnreadCounts] = useState<Record<string, number>>(workspace.directUnreadCounts);
  const [activeChannelId, setActiveChannelId] = useState(workspace.channels[0]?.id ?? 0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activePanel, setActivePanel] = useState<RightPanelTab>("线程");
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [channelFiles, setChannelFiles] = useState<Message[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [inviteUserId, setInviteUserId] = useState("");
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [auditQuery, setAuditQuery] = useState<AuditQuery>({ from: "", keyword: "", operator: "", to: "", type: "all" });
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [auditsError, setAuditsError] = useState<string | null>(null);
  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) || channels[0],
    [activeChannelId, channels]
  );
  const discoverChannels = channels.filter((channel) => !channel.joined);
  const inviteCandidates = workspaceUsers.filter(
    (item) => item.id !== currentUser.id && !members.some((member) => member.id === item.id)
  );
  const memberCount = activeChannel?.memberCount || workspaceUsers.length;
  const mentionCandidates = workspaceUsers.filter((item) => item.id !== currentUser.id);
  const canManageActiveChannel = Boolean(
    activeChannel && (currentUser.role === "ADMIN" || currentUser.role === "CHANNEL_ADMIN")
  );

  const { clearDraft, composerValue, draftSaved, handleComposerChange, handleMentionInsert } = useDraftComposer({ activeChannel, currentUser });
  const { handleSearchResultSelect, searchError, searchLoading, searchQuery, searchResults, setSearchQuery } = useWorkspaceSearch({ setActiveChannelId, setHighlightedMessageId, token });
  const { activeThread, handleThreadSend, setActiveThread, setThreadComposerValue, setThreadMessages, threadComposerValue, threadError, threadLoading, threadMessages, threadSending } = useThreadWorkspace({ activeChannel, currentUser, setMessages, token, upsertById });

  const refreshWorkspace = useCallback(async () => {
    const nextWorkspace = await getWorkspace(token);
    setChannels(nextWorkspace.channels);
    setWorkspaceUsers(nextWorkspace.users);
    setDirectUnreadCounts(nextWorkspace.directUnreadCounts);
  }, [token]);

  const { channelActionError, channelActionLoading, channelDescription, channelName, discoverOpen, handleCreateChannel, handleJoinChannel, setChannelDescription, setChannelName, setDiscoverOpen } = useDiscoverChannels({ setActiveChannelId, setChannels, token });
  const { handleSaveSettings, setSettingsOpen, settings, settingsError, settingsLoading, settingsOpen, settingsSaving } = useSettingsWorkspace({ setChannels, setCurrentUser, setDirectUnreadCounts, setWorkspaceUsers, token });
  const { adminError, adminLoading, adminOpen, adminOverview, handleSaveAdminChannel, handleSaveAdminUser, handleSaveNetworkPolicy, handleSaveSecurityPolicy, handleSaveUploadPolicy, refreshAdminOverview, savingChannelId, savingNetworkPolicy, savingPolicy, savingUploadPolicy, savingUserId, setAdminOpen } = useAdminWorkspace({
    currentUserRole: currentUser.role,
    refreshWorkspace,
    setChannels,
    token
  });

  const refreshMessages = useCallback(async (channel: Channel | undefined, options: { resetThread?: boolean; silent?: boolean } = {}) => {
    if (!channel) return;
    if (!options.silent) setMessagesLoading(true);
    setMessagesError(null);
    listChannelMessages(token, channel.id)
      .then((page) => {
        setMessages(page.items);
        if (options.resetThread) setActiveThread(null);
      })
      .catch((error) => setMessagesError(error instanceof Error ? error.message : "消息加载失败"))
      .finally(() => {
        if (!options.silent) setMessagesLoading(false);
      });
  }, [token]);

  const refreshMembers = useCallback(async (channel: Channel | undefined, options: { silent?: boolean } = {}) => {
    if (!channel) return;
    if (!options.silent) setMembersLoading(true);
    setMembersError(null);
    listChannelMembers(token, channel.id)
      .then((items) => {
        setMembers(items);
        setInviteUserId("");
      })
      .catch((error) => setMembersError(error instanceof Error ? error.message : "成员加载失败"))
      .finally(() => {
        if (!options.silent) setMembersLoading(false);
      });
  }, [token]);

  const refreshChannelFiles = useCallback(async (channel: Channel | undefined, options: { silent?: boolean } = {}) => {
    if (!channel) return;
    if (!options.silent) setFilesLoading(true);
    setFilesError(null);
    listChannelFiles(token, channel.id)
      .then((items) => setChannelFiles(items))
      .catch((error) => setFilesError(error instanceof Error ? error.message : "文件加载失败"))
      .finally(() => {
        if (!options.silent) setFilesLoading(false);
      });
  }, [token]);

  const refreshAudits = useCallback(async (query: AuditQuery, options: { silent?: boolean } = {}) => {
    if (!options.silent) setAuditsLoading(true);
    setAuditsError(null);
    searchAudits(token, query)
      .then((items) => setAudits(items))
      .catch((error) => setAuditsError(error instanceof Error ? error.message : "审计加载失败"))
      .finally(() => {
        if (!options.silent) setAuditsLoading(false);
      });
  }, [token]);

  useEffect(() => {
    refreshMessages(activeChannel, { resetThread: true });
  }, [activeChannel, refreshMessages]);

  useEffect(() => {
    if (activePanel !== "成员") return;
    refreshMembers(activeChannel);
  }, [activeChannel, activePanel, refreshMembers]);

  useEffect(() => {
    if (activePanel !== "文件") return;
    refreshChannelFiles(activeChannel);
  }, [activeChannel, activePanel, refreshChannelFiles]);

  useEffect(() => {
    if (activePanel !== "审计") return;
    refreshAudits(auditQuery);
  }, [activePanel, auditQuery, refreshAudits]);

  useEffect(() => {
    if (!adminOpen) return;
    refreshAdminOverview();
  }, [adminOpen, refreshAdminOverview]);

  const handleRealtimeEvent = useCallback((realtimeEvent: RealtimeEvent) => {
    const message = realtimeEvent.payload?.message;

    if (message && ["message:channel", "file:uploaded"].includes(realtimeEvent.event)) {
      if (message.channelId === activeChannel?.id && !message.parentId) {
        setMessages((current) => upsertById(current, message));
        if (message.file) setChannelFiles((current) => upsertById(current, message));
      }
    }

    if (message && realtimeEvent.event === "message:thread") {
      if (message.channelId === activeChannel?.id && message.parentId === activeThread?.id) {
        setThreadMessages((current) => upsertById(current, message));
      }
      if (message.parentId && message.senderId !== currentUser.id) {
        setMessages((current) =>
          current.map((item) =>
            item.id === message.parentId ? { ...item, replyCount: item.replyCount + 1 } : item
          )
        );
        setActiveThread((current) =>
          current && current.id === message.parentId
            ? { ...current, replyCount: current.replyCount + 1 }
            : current
        );
      }
    }

    if (message && ["message:edited", "message:favorite", "message:pinned", "message:reaction", "message:revoked"].includes(realtimeEvent.event)) {
      setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
      setThreadMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
      setActiveThread((current) => (current && current.id === message.id ? message : current));
    }

    if (["members:changed", "channel:created", "channel:updated"].includes(realtimeEvent.event)) {
      refreshWorkspace().catch(() => undefined);
      if (activePanel === "成员") refreshMembers(activeChannel, { silent: true }).catch(() => undefined);
    }

    if (realtimeEvent.event === "presence:updated" && realtimeEvent.payload?.users) {
      setWorkspaceUsers(realtimeEvent.payload.users);
      const self = realtimeEvent.payload.users.find((item) => item.id === currentUser.id);
      if (self) setCurrentUser(self);
    }

    if (activePanel === "审计") refreshAudits(auditQuery, { silent: true }).catch(() => undefined);
    if (adminOpen) refreshAdminOverview({ silent: true }).catch(() => undefined);
  }, [activeChannel, activePanel, activeThread, adminOpen, auditQuery, currentUser.id, refreshAdminOverview, refreshAudits, refreshMembers, refreshWorkspace]);

  useRealtime({
    enabled: Boolean(token),
    onEvent: handleRealtimeEvent,
    token
  });

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeChannel || !composerValue.trim() || sending) return;
    setSending(true);
    setComposerError(null);
    try {
      const message = await sendChannelMessage(token, activeChannel.id, currentUser.id, composerValue);
      setMessages((current) => upsertById(current, message));
      clearDraft();
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "消息发送失败");
    } finally {
      setSending(false);
    }
  }

  function handleChannelSelect(channelId: number) {
    setActiveChannelId(channelId);
    setHighlightedMessageId(null);
  }

  async function handleFileSelected(file: File | undefined) {
    if (!activeChannel || !file || uploading) return;
    setUploading(true);
    setComposerError(null);
    try {
      const message = await uploadChannelFile(token, activeChannel.id, file);
      setMessages((current) => upsertById(current, message));
      if (message.file) setChannelFiles((current) => upsertById(current, message));
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "文件上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleInviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeChannel || !inviteUserId || memberActionLoading) return;
    setMemberActionLoading(true);
    setMembersError(null);
    try {
      const updatedChannel = await inviteChannelMember(token, activeChannel.id, Number(inviteUserId));
      setChannels((current) =>
        current.map((item) => (item.id === updatedChannel.id ? { ...item, ...updatedChannel } : item))
      );
      const items = await listChannelMembers(token, activeChannel.id);
      setMembers(items);
      setInviteUserId("");
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : "邀请成员失败");
    } finally {
      setMemberActionLoading(false);
    }
  }

  async function handleRemoveMember(member: ChannelMember) {
    if (!activeChannel || memberActionLoading) return;
    setMemberActionLoading(true);
    setMembersError(null);
    try {
      const updatedChannel = await removeChannelMember(token, activeChannel.id, member.id);
      setChannels((current) =>
        current.map((item) => (item.id === updatedChannel.id ? { ...item, ...updatedChannel } : item))
      );
      setMembers((current) => current.filter((item) => item.id !== member.id));
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : "移除成员失败");
    } finally {
      setMemberActionLoading(false);
    }
  }

  async function handlePinToggle(message: Message) {
    if (!canManageActiveChannel) return;
    setMessagesError(null);
    try {
      const updated = await pinMessage(token, message.id, !message.pinned);
      setMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setActiveThread((current) => (current && current.id === updated.id ? updated : current));
    } catch (error) {
      setMessagesError(error instanceof Error ? error.message : "置顶消息失败");
    }
  }

  async function handleFavoriteToggle(message: Message) {
    setMessagesError(null);
    try {
      const favoriteUserIds = message.favoriteUserIds || [];
      const updated = await favoriteMessage(token, message.id, !favoriteUserIds.includes(currentUser.id));
      setMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setThreadMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setActiveThread((current) => (current && current.id === updated.id ? updated : current));
    } catch (error) {
      setMessagesError(error instanceof Error ? error.message : "收藏消息失败");
    }
  }

  async function handleReactionToggle(message: Message, emoji: string) {
    setMessagesError(null);
    try {
      const userIds = message.reactions?.[emoji] || [];
      const updated = await reactToMessage(token, message.id, emoji, !userIds.includes(currentUser.id));
      setMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setThreadMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setActiveThread((current) => (current && current.id === updated.id ? updated : current));
    } catch (error) {
      setMessagesError(error instanceof Error ? error.message : "回应消息失败");
    }
  }

  return (
    <section className="chat-workspace">
      <ChatSidebar
        activeChannel={activeChannel}
        channels={channels}
        currentUser={currentUser}
        directUnreadCounts={directUnreadCounts}
        onAdminOpen={() => setAdminOpen(true)}
        onChannelSelect={handleChannelSelect}
        onDiscoverOpen={() => setDiscoverOpen(true)}
        onLogout={onLogout}
        onSearchChange={setSearchQuery}
        onSearchResultSelect={handleSearchResultSelect}
        onSettingsOpen={() => setSettingsOpen(true)}
        searchError={searchError}
        searchLoading={searchLoading}
        searchQuery={searchQuery}
        searchResults={searchResults}
        users={workspaceUsers}
      />
      <ChatMainPanel
        activeChannel={activeChannel}
        canManageActiveChannel={canManageActiveChannel}
        currentUser={currentUser}
        composerError={composerError}
        draftSaved={draftSaved}
        fileInputRef={fileInputRef}
        highlightedMessageId={highlightedMessageId}
        memberCount={memberCount}
        mentionCandidates={mentionCandidates}
        messages={messages}
        messagesError={messagesError}
        messagesLoading={messagesLoading}
        onComposerChange={handleComposerChange}
        onFavoriteToggle={handleFavoriteToggle}
        onFileSelected={handleFileSelected}
        onMentionInsert={handleMentionInsert}
        onPinToggle={handlePinToggle}
        onReactionToggle={handleReactionToggle}
        onRetryMessages={() => refreshMessages(activeChannel)}
        onSend={handleSend}
        onThreadOpen={setActiveThread}
        sending={sending}
        uploading={uploading}
        value={composerValue}
      />
      <RightPanel
        activeChannel={activeChannel}
        activePanel={activePanel}
        activeThread={activeThread}
        auditQuery={auditQuery}
        audits={audits}
        auditsError={auditsError}
        auditsLoading={auditsLoading}
        currentUser={currentUser}
        files={channelFiles}
        filesError={filesError}
        filesLoading={filesLoading}
        inviteCandidates={inviteCandidates}
        inviteUserId={inviteUserId}
        memberActionLoading={memberActionLoading}
        members={members}
        membersError={membersError}
        membersLoading={membersLoading}
        onAuditQueryChange={setAuditQuery}
        onInviteMember={handleInviteMember}
        onInviteUserChange={setInviteUserId}
        onMemberRemove={handleRemoveMember}
        onPanelChange={setActivePanel}
        onThreadClose={() => setActiveThread(null)}
        onThreadReplyChange={setThreadComposerValue}
        onThreadReplySubmit={handleThreadSend}
        threadComposerValue={threadComposerValue}
        threadError={threadError}
        threadLoading={threadLoading}
        threadMessages={threadMessages}
        threadSending={threadSending}
      />
      <DiscoverChannelsModal
        actionError={channelActionError}
        actionLoading={channelActionLoading}
        channelDescription={channelDescription}
        channelName={channelName}
        channels={discoverChannels}
        onChannelDescriptionChange={setChannelDescription}
        onChannelNameChange={setChannelName}
        onClose={() => setDiscoverOpen(false)}
        onCreateChannel={handleCreateChannel}
        onJoinChannel={handleJoinChannel}
        open={discoverOpen}
      />
      <SettingsModal
        currentUser={currentUser}
        error={settingsError}
        loading={settingsLoading}
        onClose={() => setSettingsOpen(false)}
        onLogout={onLogout}
        onSave={handleSaveSettings}
        open={settingsOpen}
        saving={settingsSaving}
        settings={settings}
      />
      <AdminModal
        error={adminError}
        exportUrl={`/api/admin/audits/export?token=${encodeURIComponent(token)}`}
        loading={adminLoading}
        onChannelSave={handleSaveAdminChannel}
        onClose={() => setAdminOpen(false)}
        onNetworkPolicySave={handleSaveNetworkPolicy}
        onPolicySave={handleSaveSecurityPolicy}
        onUploadPolicySave={handleSaveUploadPolicy}
        onUserSave={handleSaveAdminUser}
        open={adminOpen}
        overview={adminOverview}
        savingChannelId={savingChannelId}
        savingNetworkPolicy={savingNetworkPolicy}
        savingPolicy={savingPolicy}
        savingUploadPolicy={savingUploadPolicy}
        savingUserId={savingUserId}
      />
    </section>
  );
}
