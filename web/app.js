const SESSION_KEY = "beechat.session";

const state = {
  workspace: null,
  user: null,
  token: null,
  viewMode: "channel",
  activeChannelId: 1,
  activeDmUserId: null,
  messages: [],
  messagePage: { hasMore: false, nextBeforeId: null, loadingOlder: false },
  threadRoot: null,
  threadMessages: [],
  threadPage: { hasMore: false, nextBeforeId: null, loadingOlder: false },
  searchTimer: null,
  sidePanel: "thread",
  editingMessageId: null,
  audits: [],
  members: [],
  auditFilter: "all",
  discoverKeyword: "",
  realtimeSocket: null,
  realtimeTimer: null,
  realtimeRefreshTimer: null
};

const MESSAGE_PAGE_SIZE = 30;

const dom = {
  app: document.querySelector("#app"),
  loginScreen: document.querySelector("#loginScreen"),
  loginForm: document.querySelector("#loginForm"),
  loginAccount: document.querySelector("#loginAccount"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  searchInput: document.querySelector("#searchInput"),
  searchResults: document.querySelector("#searchResults"),
  securityMode: document.querySelector("#securityMode"),
  channelList: document.querySelector("#channelList"),
  dmList: document.querySelector("#dmList"),
  currentAvatar: document.querySelector("#currentAvatar"),
  currentName: document.querySelector("#currentName"),
  channelTitle: document.querySelector("#channelTitle"),
  channelDesc: document.querySelector("#channelDesc"),
  messages: document.querySelector("#messages"),
  messageInput: document.querySelector("#messageInput"),
  sendBtn: document.querySelector("#sendBtn"),
  fileBtn: document.querySelector("#fileBtn"),
  fileInput: document.querySelector("#fileInput"),
  notice: document.querySelector("#notice"),
  closeThreadBtn: document.querySelector("#closeThreadBtn"),
  threadTabBtn: document.querySelector("#threadTabBtn"),
  auditTabBtn: document.querySelector("#auditTabBtn"),
  memberTabBtn: document.querySelector("#memberTabBtn"),
  threadContent: document.querySelector("#threadContent"),
  auditContent: document.querySelector("#auditContent"),
  memberContent: document.querySelector("#memberContent"),
  channelName: document.querySelector("#channelName"),
  createChannelBtn: document.querySelector("#createChannelBtn"),
  discoverBtn: document.querySelector("#discoverBtn"),
  discoverScrim: document.querySelector("#discoverScrim"),
  discoverPanel: document.querySelector("#discoverPanel"),
  closeDiscoverBtn: document.querySelector("#closeDiscoverBtn"),
  discoverSearch: document.querySelector("#discoverSearch"),
  discoverList: document.querySelector("#discoverList"),
  logoutBtn: document.querySelector("#logoutBtn")
};

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(path, {
    ...options,
    headers
  });
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.message || "请求失败");
  }
  return payload.data;
}

function showNotice(text) {
  dom.notice.textContent = text;
  dom.notice.classList.remove("hidden");
}

function showLoginError(text) {
  dom.loginError.textContent = text;
  dom.loginError.classList.remove("hidden");
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function activeChannel() {
  return state.workspace.channels.find((item) => item.id === state.activeChannelId) || state.workspace.channels[0];
}

function activeDmUser() {
  return state.workspace.users.find((item) => item.id === state.activeDmUserId);
}

function normalizeMessagePage(data) {
  if (Array.isArray(data)) {
    return {
      items: data,
      hasMore: false,
      nextBeforeId: data.length ? data[0].id : null,
      pageSize: data.length
    };
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    hasMore: Boolean(data.hasMore),
    nextBeforeId: data.nextBeforeId ?? null,
    pageSize: data.pageSize ?? MESSAGE_PAGE_SIZE
  };
}

async function applySession(session) {
  state.token = session.token;
  state.workspace = session.workspace;
  state.user = session.user;
  state.viewMode = "channel";
  state.activeChannelId = session.workspace.channels[0].id;
  state.activeDmUserId = null;
  await loadMessages();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token: session.token }));
  dom.loginScreen.classList.add("hidden");
  dom.app.classList.remove("hidden");
  connectRealtime();
  render();
}

async function login(account, password) {
  const session = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ account, password })
  });
  await applySession(session);
}

async function restoreSession() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
  if (!stored || !stored.token) return;
  state.token = stored.token;
  try {
    const session = await request("/api/session");
    await applySession(session);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    state.token = null;
  }
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  disconnectRealtime();
  state.workspace = null;
  state.user = null;
  state.token = null;
  state.messages = [];
  state.messagePage = { hasMore: false, nextBeforeId: null, loadingOlder: false };
  state.threadRoot = null;
  state.threadMessages = [];
  state.threadPage = { hasMore: false, nextBeforeId: null, loadingOlder: false };
  state.audits = [];
  state.members = [];
  state.editingMessageId = null;
  state.viewMode = "channel";
  state.activeDmUserId = null;
  dom.searchInput.value = "";
  closeDiscover();
  hideSearchResults();
  dom.app.classList.add("hidden");
  dom.loginScreen.classList.remove("hidden");
  dom.loginPassword.value = "";
}

async function refreshWorkspace() {
  state.workspace = await request("/api/workspace");
  renderSidebar();
  renderHeader();
}

async function loadMessages(options = {}) {
  const older = Boolean(options.older);
  const beforeId = older ? state.messagePage.nextBeforeId : null;
  const query = new URLSearchParams({ pageSize: String(MESSAGE_PAGE_SIZE) });
  if (beforeId) query.set("beforeId", String(beforeId));
  const previousScrollHeight = older ? dom.messages.scrollHeight : 0;
  if (state.viewMode === "direct") {
    const page = normalizeMessagePage(await request(`/api/direct/${state.activeDmUserId}/messages?${query.toString()}`));
    state.messages = older ? [...page.items, ...state.messages] : page.items;
    state.messagePage = { ...state.messagePage, hasMore: page.hasMore, nextBeforeId: page.nextBeforeId, loadingOlder: false };
    if (state.workspace?.directUnreadCounts) {
      state.workspace.directUnreadCounts[String(state.activeDmUserId)] = 0;
    }
    if (older) {
      renderMessages({ preserveScrollHeight: previousScrollHeight });
    }
    return;
  }
  const page = normalizeMessagePage(await request(`/api/channels/${state.activeChannelId}/messages?${query.toString()}`));
  state.messages = older ? [...page.items, ...state.messages] : page.items;
  state.messagePage = { ...state.messagePage, hasMore: page.hasMore, nextBeforeId: page.nextBeforeId, loadingOlder: false };
  const channel = state.workspace?.channels.find((item) => item.id === state.activeChannelId);
  if (channel) channel.unreadCount = 0;
  if (older) {
    renderMessages({ preserveScrollHeight: previousScrollHeight });
  }
}

async function loadOlderMessages() {
  if (!state.messagePage.hasMore || state.messagePage.loadingOlder) return;
  state.messagePage.loadingOlder = true;
  renderMessages({ keepPosition: true });
  try {
    await loadMessages({ older: true });
  } catch (error) {
    state.messagePage.loadingOlder = false;
    showNotice(error.message);
    renderMessages({ keepPosition: true });
  }
}

async function refreshCurrentView() {
  await refreshWorkspace();
  await loadMessages();
  renderMessages();
  if (state.sidePanel === "audit") await refreshAudits();
  if (state.sidePanel === "members") await refreshMembers();
}

function scheduleRealtimeRefresh() {
  clearTimeout(state.realtimeRefreshTimer);
  state.realtimeRefreshTimer = setTimeout(() => {
    refreshCurrentView().catch((error) => showNotice(error.message));
  }, 120);
}

function realtimeUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/realtime?token=${encodeURIComponent(state.token)}`;
}

function connectRealtime() {
  disconnectRealtime();
  if (!state.token || !window.WebSocket) return;
  const socket = new WebSocket(realtimeUrl());
  state.realtimeSocket = socket;
  socket.addEventListener("message", (event) => {
    let payload = null;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (payload.event === "connected") return;
    scheduleRealtimeRefresh();
  });
  socket.addEventListener("close", () => {
    if (!state.token) return;
    state.realtimeTimer = setTimeout(connectRealtime, 1500);
  });
  socket.addEventListener("error", () => socket.close());
}

function disconnectRealtime() {
  clearTimeout(state.realtimeTimer);
  clearTimeout(state.realtimeRefreshTimer);
  if (state.realtimeSocket) {
    state.realtimeSocket.onclose = null;
    state.realtimeSocket.close();
  }
  state.realtimeSocket = null;
}

async function openThread(message) {
  if (state.viewMode === "direct") return;
  state.threadRoot = message;
  const query = new URLSearchParams({ parentId: String(message.id), pageSize: String(MESSAGE_PAGE_SIZE) });
  const page = normalizeMessagePage(await request(`/api/channels/${message.channelId}/messages?${query.toString()}`));
  state.threadMessages = page.items;
  state.threadPage = { hasMore: page.hasMore, nextBeforeId: page.nextBeforeId, loadingOlder: false };
  renderThread();
}

async function loadOlderThreadMessages() {
  if (!state.threadRoot || !state.threadPage.hasMore || state.threadPage.loadingOlder) return;
  state.threadPage.loadingOlder = true;
  renderThread();
  try {
    const query = new URLSearchParams({
      parentId: String(state.threadRoot.id),
      pageSize: String(MESSAGE_PAGE_SIZE),
      beforeId: String(state.threadPage.nextBeforeId)
    });
    const page = normalizeMessagePage(await request(`/api/channels/${state.threadRoot.channelId}/messages?${query.toString()}`));
    state.threadMessages = [...page.items, ...state.threadMessages];
    state.threadPage = { hasMore: page.hasMore, nextBeforeId: page.nextBeforeId, loadingOlder: false };
    renderThread();
  } catch (error) {
    state.threadPage.loadingOlder = false;
    showNotice(error.message);
    renderThread();
  }
}

async function sendMessage(parentId = null) {
  const input = parentId ? document.querySelector("#threadInput") : dom.messageInput;
  const content = input.value.trim();
  if (!content) return;
  const message = state.viewMode === "direct"
    ? await request("/api/direct/messages", {
      method: "POST",
      body: JSON.stringify({
        receiverId: state.activeDmUserId,
        content
      })
    })
    : await request("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        channelId: state.activeChannelId,
        parentId,
        senderId: state.user.id,
        content
      })
    });
  input.value = "";
  if (parentId && state.viewMode === "channel") {
    state.threadMessages.push(message);
    const root = state.messages.find((item) => item.id === parentId);
    if (root) root.replyCount += 1;
    renderThread();
  } else {
    state.messages.push(message);
    renderMessages();
  }
  showNotice(message.sensitive ? "检测到敏感词，已写入审计并提示脱敏。" : "消息已发送并完成留痕。");
  refreshAudits();
}

async function uploadFile(file) {
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  if (state.viewMode === "direct") {
    formData.append("receiverId", String(state.activeDmUserId));
  } else {
    formData.append("channelId", String(state.activeChannelId));
  }
  const message = await request("/api/files", {
    method: "POST",
    body: formData,
    headers: {}
  });
  state.messages.push(message);
  renderMessages();
  showNotice("文件已上传并写入审计。");
  refreshAudits();
}

async function revokeMessage(messageId) {
  const updated = await request(`/api/messages/${messageId}/revoke`, { method: "POST", body: "{}" });
  state.messages = state.messages.map((item) => (item.id === updated.id ? updated : item));
  if (state.threadRoot && state.threadRoot.id === updated.id) {
    state.threadRoot = updated;
    renderThread();
  }
  renderMessages();
  showNotice("消息已撤回并写入审计。");
  refreshAudits();
}

function startEditMessage(messageId) {
  state.editingMessageId = messageId;
  renderMessages();
}

function cancelEditMessage() {
  state.editingMessageId = null;
  renderMessages();
}

async function saveEditMessage(messageId) {
  const input = document.querySelector(`[data-edit-input="${messageId}"]`);
  const nextContent = input ? input.value.trim() : "";
  const message = state.messages.find((item) => item.id === messageId);
  if (!message || !nextContent || nextContent === message.content) {
    cancelEditMessage();
    return;
  }
  const updated = await request(`/api/messages/${messageId}`, {
    method: "PUT",
    body: JSON.stringify({ content: nextContent })
  });
  state.messages = state.messages.map((item) => (item.id === updated.id ? updated : item));
  state.editingMessageId = null;
  if (state.threadRoot && state.threadRoot.id === updated.id) {
    state.threadRoot = updated;
    renderThread();
  }
  renderMessages();
  showNotice(updated.sensitive ? "消息已编辑，敏感词提示已同步更新。" : "消息已编辑并写入审计。");
  refreshAudits();
}

async function createChannel() {
  const name = dom.channelName.value.trim();
  if (!name) return;
  const channel = await request("/api/channels", {
    method: "POST",
    body: JSON.stringify({ name, description: "MVP 快速创建频道" })
  });
  state.workspace.channels.push(channel);
  dom.channelName.value = "";
  showNotice(`频道 #${channel.name} 已创建。`);
  renderSidebar();
  refreshAudits();
}

async function joinChannel(channelId) {
  const updated = await request(`/api/channels/${channelId}/join`, { method: "POST", body: "{}" });
  state.workspace.channels = state.workspace.channels.map((item) => (item.id === updated.id ? updated : item));
  state.activeChannelId = updated.id;
  await loadMessages();
  render();
  showNotice(`已加入 #${updated.name}。`);
}

function openDiscover() {
  state.discoverKeyword = "";
  dom.discoverSearch.value = "";
  dom.discoverScrim.classList.remove("hidden");
  dom.discoverPanel.classList.remove("hidden");
  renderDiscover();
  dom.discoverSearch.focus();
}

function closeDiscover() {
  dom.discoverScrim.classList.add("hidden");
  dom.discoverPanel.classList.add("hidden");
}

function renderDiscover() {
  const keyword = state.discoverKeyword.trim().toLowerCase();
  const channels = state.workspace.channels.filter((channel) => {
    if (!keyword) return true;
    return `${channel.name} ${channel.description}`.toLowerCase().includes(keyword);
  });
  if (!channels.length) {
    dom.discoverList.innerHTML = "<div class=\"discover-empty\">没有匹配频道</div>";
    return;
  }
  dom.discoverList.innerHTML = channels.map((channel) => `
    <article class="discover-card">
      <span>#</span>
      <div>
        <strong>${escapeHtml(channel.name)}</strong>
        <small>${escapeHtml(channel.description)}</small>
      </div>
      <button ${channel.joined ? "disabled" : ""} data-discover-channel="${channel.id}">
        ${channel.joined ? "已加入" : "加入"}
      </button>
    </article>
  `).join("");
  dom.discoverList.querySelectorAll("[data-discover-channel]").forEach((button) => {
    button.addEventListener("click", async () => {
      await joinChannel(Number(button.dataset.discoverChannel));
      renderDiscover();
      closeDiscover();
    });
  });
}

function renderSidebar() {
  const joinedChannels = state.workspace.channels.filter((item) => item.joined);
  dom.channelList.innerHTML = joinedChannels.map((channel) => `
    <button class="${channel.id === state.activeChannelId ? "active" : ""}" data-channel-id="${channel.id}">
      <span># ${escapeHtml(channel.name)}</span>
      ${channel.unreadCount ? `<b>${channel.unreadCount}</b>` : ""}
    </button>
  `).join("");
  dom.channelList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      state.viewMode = "channel";
      state.activeChannelId = Number(button.dataset.channelId);
      state.activeDmUserId = null;
      state.messagePage = { hasMore: false, nextBeforeId: null, loadingOlder: false };
      await loadMessages();
      state.threadRoot = null;
      state.threadMessages = [];
      state.threadPage = { hasMore: false, nextBeforeId: null, loadingOlder: false };
      render();
    });
  });

  dom.dmList.innerHTML = state.workspace.users
    .filter((user) => user.id !== state.user.id)
    .map((user) => `
      <button class="dm-row ${state.viewMode === "direct" && user.id === state.activeDmUserId ? "active" : ""}" data-dm-user-id="${user.id}">
        <i class="${user.online ? "online" : ""}"></i><span>${escapeHtml(user.name)}</span>
        ${Number(state.workspace.directUnreadCounts?.[String(user.id)] || 0) ? `<b>${state.workspace.directUnreadCounts[String(user.id)]}</b>` : ""}
      </button>
    `)
    .join("");
  dom.dmList.querySelectorAll("[data-dm-user-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.viewMode = "direct";
      state.activeDmUserId = Number(button.dataset.dmUserId);
      state.threadRoot = null;
      state.threadMessages = [];
      state.threadPage = { hasMore: false, nextBeforeId: null, loadingOlder: false };
      state.messagePage = { hasMore: false, nextBeforeId: null, loadingOlder: false };
      await loadMessages();
      render();
    });
  });
}

function renderMessages(options = {}) {
  const previousScrollHeight = options.preserveScrollHeight || 0;
  const pager = state.messagePage.loadingOlder
    ? `<button class="load-more-messages" disabled>正在加载...</button>`
    : state.messagePage.hasMore
      ? `<button class="load-more-messages" id="loadMoreMessagesBtn">加载更早消息</button>`
      : state.messages.length
        ? `<div class="no-more-messages">没有更早消息</div>`
        : "";
  dom.messages.innerHTML = `${pager}<div class="date">今天</div>` + state.messages.map((message) => {
    const mine = message.senderId === state.user.id;
    const revoked = Boolean(message.revoked);
    const editing = state.editingMessageId === message.id;
    return `
      <article class="message ${mine ? "mine" : ""}">
        ${mine ? "" : `<span class="avatar" style="background:${message.avatarColor}">${message.avatarText}</span>`}
        <div class="message-body">
          <div class="meta">
            <strong>${escapeHtml(message.senderName)}</strong>
            <span>${formatTime(message.createdAt)}</span>
            ${message.edited ? "<em>已编辑</em>" : ""}
            ${message.sensitive ? "<b>敏感词提示</b>" : ""}
          </div>
          ${editing ? `
            <div class="inline-editor">
              <textarea data-edit-input="${message.id}">${escapeHtml(message.content)}</textarea>
              <div>
                <button data-save-edit-id="${message.id}">保存</button>
                <button data-cancel-edit-id="${message.id}">取消</button>
              </div>
            </div>
          ` : `
            <p class="${revoked ? "revoked" : ""}">${escapeHtml(message.content)}</p>
            ${message.file ? `
              <a class="file-card" href="${encodeURI(message.file.path)}" target="_blank" rel="noopener">
                <strong>${escapeHtml(message.file.originalName)}</strong>
                <span>${formatFileSize(message.file.size)} · 点击下载</span>
              </a>
            ` : ""}
          `}
          <div class="actions">
            <span>${message.deliveryStatus}</span>
            ${state.viewMode === "channel" ? `<button data-thread-id="${message.id}">线程 ${message.replyCount}</button>` : ""}
            ${mine && !revoked && !editing ? `<button data-edit-id="${message.id}">编辑</button>` : ""}
            ${mine && !revoked && !editing ? `<button data-revoke-id="${message.id}">撤回</button>` : ""}
            <button>👍 2</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
  dom.messages.querySelectorAll("[data-thread-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const message = state.messages.find((item) => item.id === Number(button.dataset.threadId));
      if (message) openThread(message);
    });
  });
  dom.messages.querySelectorAll("[data-revoke-id]").forEach((button) => {
    button.addEventListener("click", () => revokeMessage(Number(button.dataset.revokeId)));
  });
  dom.messages.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => startEditMessage(Number(button.dataset.editId)));
  });
  dom.messages.querySelectorAll("[data-save-edit-id]").forEach((button) => {
    button.addEventListener("click", () => saveEditMessage(Number(button.dataset.saveEditId)));
  });
  dom.messages.querySelectorAll("[data-cancel-edit-id]").forEach((button) => {
    button.addEventListener("click", cancelEditMessage);
  });
  const loadMoreBtn = dom.messages.querySelector("#loadMoreMessagesBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", loadOlderMessages);
  }
  if (previousScrollHeight) {
    dom.messages.scrollTop = dom.messages.scrollHeight - previousScrollHeight;
  } else if (!options.keepPosition) {
    dom.messages.scrollTop = dom.messages.scrollHeight;
  }
}

function renderThread() {
  dom.threadContent.classList.toggle("hidden", state.sidePanel !== "thread");
  dom.auditContent.classList.toggle("hidden", state.sidePanel !== "audit");
  dom.memberContent.classList.toggle("hidden", state.sidePanel !== "members");
  dom.threadTabBtn.classList.toggle("active", state.sidePanel === "thread");
  dom.auditTabBtn.classList.toggle("active", state.sidePanel === "audit");
  dom.memberTabBtn.classList.toggle("active", state.sidePanel === "members");
  if (state.sidePanel === "audit") {
    renderAudits();
    return;
  }
  if (state.sidePanel === "members") {
    renderMembers();
    return;
  }
  if (!state.threadRoot) {
    dom.threadContent.className = "thread-empty";
    dom.threadContent.innerHTML = "选择一条消息查看线程。";
    return;
  }
  dom.threadContent.className = "";
  dom.threadContent.innerHTML = `
    <div class="thread-root">
      <strong>${escapeHtml(state.threadRoot.senderName)}</strong>
      <p>${escapeHtml(state.threadRoot.content)}</p>
    </div>
    <div class="thread-audit">此线程包含客户信息时，转发前需完成脱敏检查。</div>
    <div class="thread-list">
      ${state.threadPage.loadingOlder
        ? "<button class=\"load-more-messages\" disabled>正在加载...</button>"
        : state.threadPage.hasMore
          ? "<button class=\"load-more-messages\" id=\"loadMoreThreadBtn\">加载更早回复</button>"
          : state.threadMessages.length
            ? "<div class=\"no-more-messages\">没有更早回复</div>"
            : ""}
      ${state.threadMessages.map((message) => `
        <div class="thread-item">
          <span style="background:${message.avatarColor}">${message.avatarText}</span>
          <div>
            <strong>${escapeHtml(message.senderName)}</strong>
            <p>${escapeHtml(message.content)}</p>
          </div>
        </div>
      `).join("")}
    </div>
    <div class="thread-input">
      <input id="threadInput" placeholder="回复线程..." />
      <button id="threadSendBtn">安全回复</button>
    </div>
  `;
  document.querySelector("#threadSendBtn").addEventListener("click", () => sendMessage(state.threadRoot.id));
  const loadMoreThreadBtn = document.querySelector("#loadMoreThreadBtn");
  if (loadMoreThreadBtn) {
    loadMoreThreadBtn.addEventListener("click", loadOlderThreadMessages);
  }
}

async function refreshAudits() {
  try {
    state.audits = await request(`/api/audits?type=${encodeURIComponent(state.auditFilter)}`);
    if (state.sidePanel === "audit") renderAudits();
  } catch (error) {
    showNotice(error.message);
  }
}

function renderAudits() {
  const audits = state.audits.slice(0, 80);
  if (!audits.length) {
    dom.auditContent.innerHTML = `
      ${renderAuditFilters()}
      <div class="thread-empty">暂无审计记录。</div>
    `;
    bindAuditFilters();
    return;
  }
  dom.auditContent.innerHTML = `
    ${renderAuditFilters()}
    <div class="audit-summary">最近 ${audits.length} 条操作</div>
    <div class="audit-list">
      ${audits.map((item) => `
        <div class="audit-item">
          <strong>${escapeHtml(item.action)}</strong>
          <span>${escapeHtml(item.operator)} · ${formatTime(item.createdAt)}</span>
          <small>目标：${escapeHtml(item.targetId)}</small>
        </div>
      `).join("")}
    </div>
  `;
  bindAuditFilters();
}

function renderAuditFilters() {
  const filters = [
    ["all", "全部"],
    ["message", "消息"],
    ["file", "文件"],
    ["member", "成员"],
    ["login", "登录"]
  ];
  return `
    <div class="audit-filters">
      ${filters.map(([value, label]) => `<button class="${state.auditFilter === value ? "active" : ""}" data-audit-filter="${value}">${label}</button>`).join("")}
    </div>
  `;
}

function bindAuditFilters() {
  dom.auditContent.querySelectorAll("[data-audit-filter]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.auditFilter = button.dataset.auditFilter;
      await refreshAudits();
    });
  });
}

function formatFileSize(size) {
  const value = Number(size) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

async function refreshMembers() {
  if (state.viewMode !== "channel") {
    state.members = [];
    renderMembers();
    return;
  }
  state.members = await request(`/api/channels/${state.activeChannelId}/members`);
  if (state.sidePanel === "members") renderMembers();
}

async function inviteMember(userId) {
  await request(`/api/channels/${state.activeChannelId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId })
  });
  showNotice("成员已邀请。");
  await refreshMembers();
  refreshAudits();
}

async function removeMember(userId) {
  await request(`/api/channels/${state.activeChannelId}/members/${userId}`, {
    method: "DELETE"
  });
  showNotice("成员已移除。");
  await refreshMembers();
  refreshAudits();
}

function renderMembers() {
  if (state.viewMode !== "channel") {
    dom.memberContent.innerHTML = "<div class=\"thread-empty\">私信会话没有频道成员。</div>";
    return;
  }
  const memberIds = new Set(state.members.map((item) => item.id));
  const candidates = state.workspace.users.filter((item) => !memberIds.has(item.id));
  dom.memberContent.innerHTML = `
    <div class="audit-summary">频道成员 ${state.members.length} 人</div>
    <div class="member-list">
      ${state.members.map((item) => `
        <div class="member-item">
          <span style="background:${item.avatarColor}">${item.avatarText}</span>
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${item.role === "ADMIN" ? "管理员" : "普通用户"}</small>
          </div>
          ${state.user.role === "ADMIN" && item.id !== state.user.id ? `<button data-remove-member="${item.id}">移除</button>` : ""}
        </div>
      `).join("")}
    </div>
    ${state.user.role === "ADMIN" && candidates.length ? `
      <div class="member-invite">
        <select id="memberInviteSelect">
          ${candidates.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}
        </select>
        <button id="memberInviteBtn">邀请</button>
      </div>
    ` : ""}
  `;
  dom.memberContent.querySelectorAll("[data-remove-member]").forEach((button) => {
    button.addEventListener("click", () => removeMember(Number(button.dataset.removeMember)));
  });
  const inviteBtn = dom.memberContent.querySelector("#memberInviteBtn");
  if (inviteBtn) {
    inviteBtn.addEventListener("click", () => {
      const select = dom.memberContent.querySelector("#memberInviteSelect");
      inviteMember(Number(select.value));
    });
  }
}

function renderHeader() {
  if (state.viewMode === "direct") {
    const user = activeDmUser();
    dom.channelTitle.textContent = user ? user.name : "私信";
    dom.channelDesc.textContent = user ? `${user.online ? "在线" : "离线"} · 一对一加密会话` : "一对一加密会话";
    dom.messageInput.placeholder = user ? `发送给 ${user.name}` : "发送私信";
    return;
  }
  const channel = activeChannel();
  dom.channelTitle.textContent = `# ${channel.name}`;
  dom.channelDesc.textContent = `${channel.memberCount} 成员 · ${channel.description}`;
  dom.messageInput.placeholder = `发送到 #${channel.name}`;
}

function render() {
  dom.securityMode.textContent = state.workspace.securityMode;
  dom.currentAvatar.textContent = state.user.avatarText;
  dom.currentAvatar.style.background = state.user.avatarColor;
  dom.currentName.textContent = state.user.name;
  renderSidebar();
  renderHeader();
  renderMessages();
  renderThread();
  if (!dom.discoverPanel.classList.contains("hidden")) renderDiscover();
  refreshAudits();
}

function hideSearchResults() {
  dom.searchResults.classList.add("hidden");
  dom.searchResults.innerHTML = "";
}

async function searchMessages(keyword) {
  const value = keyword.trim();
  if (!value) {
    hideSearchResults();
    return;
  }
  const results = await request(`/api/search?q=${encodeURIComponent(value)}`);
  if (!results.length) {
    dom.searchResults.classList.remove("hidden");
    dom.searchResults.innerHTML = "<div class=\"search-empty\">没有匹配结果</div>";
    return;
  }
  dom.searchResults.classList.remove("hidden");
  dom.searchResults.innerHTML = results.map((item) => `
    <button data-result-id="${item.id}" data-result-type="${item.messageType}" data-channel-id="${item.channelId || ""}" data-peer-id="${item.peerId || ""}">
      <strong>${item.title}</strong>
      <span>${item.senderName}：${item.content}</span>
    </button>
  `).join("");
  dom.searchResults.querySelectorAll("[data-result-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.resultType === "DIRECT") {
        state.viewMode = "direct";
        state.activeDmUserId = Number(button.dataset.peerId);
      } else {
        state.viewMode = "channel";
        state.activeChannelId = Number(button.dataset.channelId);
        state.activeDmUserId = null;
      }
      state.messagePage = { hasMore: false, nextBeforeId: null, loadingOlder: false };
      state.threadRoot = null;
      state.threadMessages = [];
      state.threadPage = { hasMore: false, nextBeforeId: null, loadingOlder: false };
      await loadMessages();
      render();
      hideSearchResults();
    });
  });
}

dom.sendBtn.addEventListener("click", () => sendMessage());
dom.fileBtn.addEventListener("click", () => dom.fileInput.click());
dom.fileInput.addEventListener("change", async () => {
  const [file] = dom.fileInput.files;
  dom.fileInput.value = "";
  try {
    await uploadFile(file);
  } catch (error) {
    showNotice(error.message);
  }
});
dom.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendMessage();
});
dom.closeThreadBtn.addEventListener("click", () => {
  state.threadRoot = null;
  state.threadMessages = [];
  renderThread();
});
dom.threadTabBtn.addEventListener("click", () => {
  state.sidePanel = "thread";
  renderThread();
});
dom.auditTabBtn.addEventListener("click", async () => {
  state.sidePanel = "audit";
  await refreshAudits();
  renderThread();
});
dom.memberTabBtn.addEventListener("click", async () => {
  state.sidePanel = "members";
  await refreshMembers();
  renderThread();
});
dom.createChannelBtn.addEventListener("click", createChannel);
dom.discoverBtn.addEventListener("click", openDiscover);
dom.discoverScrim.addEventListener("click", closeDiscover);
dom.closeDiscoverBtn.addEventListener("click", closeDiscover);
dom.discoverSearch.addEventListener("input", () => {
  state.discoverKeyword = dom.discoverSearch.value;
  renderDiscover();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dom.discoverPanel.classList.contains("hidden")) {
    closeDiscover();
  }
});
dom.logoutBtn.addEventListener("click", logout);
dom.searchInput.addEventListener("input", () => {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => {
    searchMessages(dom.searchInput.value).catch((error) => showNotice(error.message));
  }, 250);
});
dom.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  dom.loginError.classList.add("hidden");
  const account = dom.loginAccount.value.trim();
  const password = dom.loginPassword.value;
  if (!account || !password) {
    showLoginError("请输入账号和密码。");
    return;
  }
  try {
    await login(account, password);
  } catch (error) {
    showLoginError(error.message);
  }
});

restoreSession();
