const baseUrl = "http://127.0.0.1:5188";

async function main() {
  const health = await request("/api/health");
  assert(health.status === "UP", "健康检查失败");
  assert(health.storage === "sqlite+json", "SQLite 存储状态异常");
  assert(Array.isArray(health.migrations), "迁移状态异常");
  assert(health.migrations.some((item) => item.version === "001"), "初始化迁移未执行");

  const session = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ account: "13677889001", password: "admin123" })
  });
  assert(session.user.id === 1, "登录失败");
  assert(session.user.role === "ADMIN", "管理员角色异常");
  assert(session.token && !session.token.startsWith("mvp-token"), "会话 token 未升级");

  const normalSession = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ account: "zhangsan", password: "123456" })
  });
  assert(normalSession.user.role === "USER", "普通用户角色异常");

  const restoredSession = await request("/api/session", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(restoredSession.user.id === session.user.id, "登录态恢复失败");
  await assertRealtimeConnected(session.token);

  const workspace = await request("/api/workspace", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(workspace.channels.length >= 3, "频道列表异常");

  const messagesPage = await request("/api/channels/1/messages?pageSize=2", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(Array.isArray(messagesPage.items) && messagesPage.items.length >= 1, "消息列表异常");
  assert(typeof messagesPage.hasMore === "boolean", "频道消息分页字段异常");
  if (messagesPage.hasMore) {
    const olderPage = await request(`/api/channels/1/messages?pageSize=2&beforeId=${messagesPage.nextBeforeId}`, {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    assert(Array.isArray(olderPage.items), "加载更早频道消息失败");
  }

  const sent = await request("/api/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ channelId: 1, senderId: 1, content: "MVP 冒烟消息" })
  });
  assert(sent.id > 0, "发送消息失败");

  const edited = await request(`/api/messages/${sent.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ content: "MVP 冒烟消息已编辑" })
  });
  assert(edited.edited === true && edited.content === "MVP 冒烟消息已编辑", "编辑消息失败");

  const channel = await request("/api/channels", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ name: `smoke-${Date.now()}`, description: "冒烟验证频道" })
  });
  assert(channel.id > 0, "管理员创建频道失败");

  await request(`/api/channels/${channel.id}/members`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ userId: 2 })
  });
  const channelMembers = await request(`/api/channels/${channel.id}/members`, {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(channelMembers.some((item) => item.id === 2), "邀请频道成员失败");

  await request(`/api/channels/${channel.id}/members/2`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.token}` }
  });
  const removedMembers = await request(`/api/channels/${channel.id}/members`, {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(!removedMembers.some((item) => item.id === 2), "移除频道成员失败");

  await expectFailure(`/api/channels/${channel.id}/messages`, {
    headers: { Authorization: `Bearer ${normalSession.token}` }
  }, "非成员读取频道消息应被拒绝");

  await expectFailure("/api/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${normalSession.token}` },
    body: JSON.stringify({ channelId: channel.id, senderId: 2, content: "非成员消息" })
  }, "非成员发送频道消息应被拒绝");

  await expectFailure("/api/channels", {
    method: "POST",
    headers: { Authorization: `Bearer ${normalSession.token}` },
    body: JSON.stringify({ name: `user-${Date.now()}`, description: "普通用户频道" })
  }, "普通用户创建频道应被拒绝");

  const normalChannelMessage = await request("/api/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${normalSession.token}` },
    body: JSON.stringify({ channelId: 1, senderId: 2, content: "普通用户频道未读验证" })
  });
  assert(normalChannelMessage.id > 0, "普通用户发送频道消息失败");

  const unreadWorkspace = await request("/api/workspace", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  const general = unreadWorkspace.channels.find((item) => item.id === 1);
  assert(general.unreadCount >= 1, "频道未读数异常");

  await request("/api/channels/1/messages", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  const readWorkspace = await request("/api/workspace", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert((readWorkspace.channels.find((item) => item.id === 1).unreadCount || 0) === 0, "频道未读清零失败");

  const direct = await request("/api/direct/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ receiverId: 2, content: "私信冒烟消息" })
  });
  assert(direct.messageType === "DIRECT", "发送私信失败");

  const formData = new FormData();
  formData.append("channelId", "1");
  formData.append("file", new Blob(["BeeChat file smoke"], { type: "text/plain" }), "smoke.txt");
  const upload = await request("/api/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: formData
  });
  assert(upload.file && upload.file.originalName === "smoke.txt", "文件上传失败");

  const download = await fetch(`${baseUrl}${upload.file.path}`, {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(download.ok, "文件下载失败");

  const normalDirect = await request("/api/direct/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${normalSession.token}` },
    body: JSON.stringify({ receiverId: 1, content: "私信未读验证" })
  });
  assert(normalDirect.messageType === "DIRECT", "普通用户发送私信失败");

  const directUnreadWorkspace = await request("/api/workspace", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(Number(directUnreadWorkspace.directUnreadCounts["2"] || 0) >= 1, "私信未读数异常");

  const directMessagesPage = await request("/api/direct/2/messages?pageSize=2", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(directMessagesPage.items.some((item) => item.id === direct.id), "私信列表异常");
  assert(typeof directMessagesPage.hasMore === "boolean", "私信分页字段异常");

  const directReadWorkspace = await request("/api/workspace", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(Number(directReadWorkspace.directUnreadCounts["2"] || 0) === 0, "私信未读清零失败");

  const searchResults = await request("/api/search?q=%E7%A7%81%E4%BF%A1", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(searchResults.length >= 1, "消息搜索失败");

  const revoked = await request(`/api/messages/${direct.id}/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: "{}"
  });
  assert(revoked.revoked === true && revoked.content === "消息已撤回", "消息撤回失败");

  const audits = await request("/api/audits", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(audits.some((item) => item.action === "编辑消息"), "审计列表缺少编辑记录");
  assert(audits.some((item) => item.action === "撤回消息"), "审计列表缺少撤回记录");
  assert(audits.some((item) => item.action === "上传文件"), "审计列表缺少上传记录");
  const fileAudits = await request("/api/audits?type=file", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(fileAudits.every((item) => ["上传文件", "下载文件"].includes(item.action)), "审计文件筛选异常");

  console.log("BeeChat MVP 冒烟验证通过");
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.message || "请求失败");
  }
  return payload.data;
}

async function expectFailure(path, options, message) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (payload.success) {
    throw new Error(message);
  }
}

function assertRealtimeConnected(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${baseUrl.replace("http", "ws")}/api/realtime?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("实时连接超时"));
    }, 3000);
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event === "connected") {
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("实时连接失败"));
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
