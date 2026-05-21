import type { ReactNode } from "react";
import { Avatar } from "../../../components/Avatar";
import type { User } from "../../../types/auth";
import type { Channel } from "../../../types/chat";
import type { SearchResult } from "../../../api/search";
import "./ChatSidebar.css";

interface ChatSidebarProps {
  activeChannel?: Channel;
  channels: Channel[];
  currentUser: User;
  directUnreadCounts: Record<string, number>;
  onAdminOpen: () => void;
  onChannelSelect: (channelId: number) => void;
  onDiscoverOpen: () => void;
  onLogout?: () => void;
  onSearchChange: (query: string) => void;
  onSearchResultSelect: (result: SearchResult) => void;
  onSettingsOpen: () => void;
  searchError: string | null;
  searchLoading: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  users: User[];
}

export function ChatSidebar({
  activeChannel,
  channels,
  currentUser,
  directUnreadCounts,
  onAdminOpen,
  onChannelSelect,
  onDiscoverOpen,
  onLogout,
  onSearchChange,
  onSearchResultSelect,
  onSettingsOpen,
  searchError,
  searchLoading,
  searchQuery,
  searchResults,
  users
}: ChatSidebarProps) {
  return (
    <aside className="chat-sidebar">
      <div className="brand-row">
        <span>B</span>
        <div>
          <strong>BeeChat</strong>
          <small>企业协作空间</small>
        </div>
      </div>
      <input
        aria-label="搜索"
        className="sidebar-search"
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="搜索频道、成员、消息"
        value={searchQuery}
      />
      {searchQuery.trim() ? (
        <section className="search-results" data-testid="search-results">
          <div className="search-results-header">
            <strong>搜索结果</strong>
            {!searchLoading && !searchError ? <span>{searchResults.length} 条</span> : null}
          </div>
          {searchLoading ? <span className="sidebar-state" role="status">搜索中...</span> : null}
          {searchError ? <span className="sidebar-state error" role="alert">{searchError}</span> : null}
          {!searchLoading && !searchError && !searchResults.length ? <span className="sidebar-state">暂无结果</span> : null}
          {searchResults.map((result) => (
            <button
              aria-label={`${searchResultTypeLabel(result)}：${result.title}`}
              data-search-type={result.messageType.toLowerCase()}
              data-testid={`search-result-${result.id}`}
              disabled={!result.channelId}
              key={result.id}
              onClick={() => onSearchResultSelect(result)}
              type="button"
            >
              <span className="search-result-title">
                <em>{result.title}</em>
                <b>{searchResultTypeLabel(result)}</b>
              </span>
              <small>{result.senderName}：{result.content}</small>
            </button>
          ))}
        </section>
      ) : null}
      <SidebarSection bodyClassName="channel-list" title="频道">
        {channels
          .filter((channel) => channel.joined)
          .map((channel) => (
            <button
              className={`sidebar-nav-item ${channel.id === activeChannel?.id ? "active" : ""}`}
              data-testid={`channel-${channel.name}`}
              key={channel.id}
              onClick={() => onChannelSelect(channel.id)}
              type="button"
            >
              <span># {channel.name}</span>
              {channel.mentionCount ? <b className="nav-badge mention-badge">@{channel.mentionCount}</b> : null}
              {!channel.mentionCount && channel.unreadCount ? <b className="nav-badge">{channel.unreadCount}</b> : null}
            </button>
          ))}
      </SidebarSection>
      <button className="discover-link" data-testid="discover-button" onClick={onDiscoverOpen} type="button">
        发现频道
      </button>
      {currentUser.role === "ADMIN" ? (
        <button className="discover-link" data-testid="admin-button" onClick={onAdminOpen} type="button">
          管理后台
        </button>
      ) : null}
      <SidebarSection title="私信">
        {users.slice(1).map((user) => (
          <button className="sidebar-nav-item dm-item" data-testid={`dm-${user.id}`} key={user.id} type="button">
            <span className="dm-presence">
              <i className={user.online ? "online" : ""} />
              <span>{user.name}</span>
            </span>
            {directUnreadCounts[String(user.id)] ? (
              <b className="nav-badge" data-testid={`dm-unread-${user.id}`}>{directUnreadCounts[String(user.id)]}</b>
            ) : null}
          </button>
        ))}
      </SidebarSection>
      <div className="sidebar-spacer" />
      <div className="current-user">
        <Avatar color={currentUser.avatarColor} text={currentUser.avatarText} />
        <div>
          <strong>{currentUser.name}</strong>
          <small>{currentUser.role === "AUDITOR" ? "审计员 · 加密会话" : currentUser.role === "CHANNEL_ADMIN" ? "频道管理员 · 加密会话" : "消息留痕 · 加密会话"}</small>
        </div>
        <button aria-label="打开设置" className="settings-button" onClick={onSettingsOpen} type="button">
          设置
        </button>
        {onLogout ? (
          <button aria-label="退出登录" className="logout-button" onClick={onLogout} type="button">
            退出
          </button>
        ) : null}
      </div>
    </aside>
  );
}

function searchResultTypeLabel(result: SearchResult) {
  if (result.messageType === "DIRECT") return "私信";
  if (result.messageType === "THREAD") return "线程";
  return "频道消息";
}

interface SidebarSectionProps {
  bodyClassName?: string;
  children: ReactNode;
  title: string;
}

function SidebarSection({ title, children, bodyClassName = "" }: SidebarSectionProps) {
  return (
    <section className="sidebar-section">
      <h2>{title}</h2>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
