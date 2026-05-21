const fs = require("fs");
const path = require("path");

const baseUrl = "http://127.0.0.1:5188";
const frontendIndex = path.join(__dirname, "..", "frontend", "dist", "index.html");
const reportPath = path.join(__dirname, "..", "docs", "beechat", "SMOKE_REPORT.html");
const logPath = path.join(__dirname, "..", "logs", "beechat.log");
const dockerfilePath = path.join(__dirname, "..", "Dockerfile");
const composeProdPath = path.join(__dirname, "..", "docker-compose.prod.yml");
const envProdExamplePath = path.join(__dirname, "..", ".env.prod.example");
const nginxConfigPath = path.join(__dirname, "..", "deploy", "nginx", "beechat.conf");
const postgresMigrationPath = path.join(__dirname, "..", "migrations", "postgres", "001_init.sql");
const databasePlanPath = path.join(__dirname, "..", "docs", "beechat", "DATABASE_PLAN.md");
const postgresExportScriptPath = path.join(__dirname, "export-postgres-seed.js");
const postgresAdapterPath = path.join(__dirname, "..", "server", "database", "postgres-adapter.js");
const repositoryContractPath = path.join(__dirname, "..", "server", "repositories", "contracts.js");
const sqliteRepositoryPath = path.join(__dirname, "..", "server", "repositories", "sqlite-repository.js");
const postgresRepositoryPath = path.join(__dirname, "..", "server", "repositories", "postgres-repository.js");
const serverIndexPath = path.join(__dirname, "..", "server", "index.js");
const startedAt = new Date();

async function main() {
  const entry = await fetch(baseUrl);
  assert(entry.ok, "入口页面访问失败");
  const entryHtml = await entry.text();
  assert(entryHtml.includes("BeeChat"), "入口页面内容异常");
  if (fs.existsSync(frontendIndex)) {
    assert(entryHtml.includes("BeeChat 工程化前端"), "新前端入口未生效");
    await assertStaticAssets(entryHtml);
  }
  assertProdDeployConfig();

  const health = await request("/api/health");
  assert(health.status === "UP", "健康检查失败");
  assert(health.storage === "sqlite+json", "SQLite 存储状态异常");
  assert(health.database.provider === "sqlite", "数据库运行模式异常");
  assert(typeof health.uptimeSeconds === "number", "健康检查运行时长异常");
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

  const currentSettings = await request("/api/settings", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(currentSettings.displayName, "设置读取失败");
  const updatedSettings = await request("/api/settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({
      ...currentSettings,
      bio: "冒烟验证设置",
      desktopNotify: true,
      emailDigest: true,
      soundNotify: false,
      compactMode: false
    })
  });
  assert(updatedSettings.settings.bio === "冒烟验证设置", "设置保存失败");

  const adminOverview = await request("/api/admin/overview", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(adminOverview.users.length >= 3, "管理后台用户列表异常");
  assert(adminOverview.channels.length >= 3, "管理后台频道列表异常");
  assert(adminOverview.audits.length >= 1, "管理后台审计列表异常");
  assert(adminOverview.securityPolicy.maxLoginFailures >= 3, "安全策略读取异常");

  const metrics = await request("/api/metrics", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(metrics.status === "UP", "运行指标状态异常");
  assert(metrics.database.provider === "sqlite", "运行指标数据库模式异常");
  assert(metrics.counts.users >= 4, "运行指标用户数异常");
  assert(metrics.data.sqliteBytes > 0, "运行指标数据库大小异常");
  assert(typeof metrics.data.logBytes === "number", "运行指标日志大小异常");
  assert(metrics.sessions.active >= 1, "运行指标会话数异常");
  assert(fs.existsSync(logPath), "结构化日志文件未生成");
  const logContent = fs.readFileSync(logPath, "utf8");
  assert(logContent.includes("\"event\":\"http.request\""), "结构化请求日志缺失");

  const roleOverview = await request("/api/admin/users/3", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ role: "ADMIN", disabled: false })
  });
  assert(roleOverview.users.find((item) => item.id === 3).role === "ADMIN", "角色权限保存失败");
  const auditorOverview = await request("/api/admin/users/3", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ role: "AUDITOR", disabled: false })
  });
  assert(auditorOverview.users.find((item) => item.id === 3).role === "AUDITOR", "审计员角色保存失败");
  const auditorSession = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ account: "lisi", password: "123456" })
  });
  assert(auditorSession.user.role === "AUDITOR", "审计员登录角色异常");
  const auditorAudits = await request("/api/audits?type=login", {
    headers: { Authorization: `Bearer ${auditorSession.token}` }
  });
  assert(auditorAudits.length >= 1, "审计员查看审计失败");
  const auditorExport = await fetch(`${baseUrl}/api/admin/audits/export?token=${encodeURIComponent(auditorSession.token)}`);
  assert(auditorExport.ok, "审计员导出审计失败");
  await expectFailure("/api/admin/overview", {
    headers: { Authorization: `Bearer ${auditorSession.token}` }
  }, "审计员不应访问管理总览");
  const channelAdminOverview = await request("/api/admin/users/3", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ role: "CHANNEL_ADMIN", disabled: false })
  });
  assert(channelAdminOverview.users.find((item) => item.id === 3).role === "CHANNEL_ADMIN", "频道管理员角色保存失败");
  const channelAdminSession = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ account: "lisi", password: "123456" })
  });
  assert(channelAdminSession.user.role === "CHANNEL_ADMIN", "频道管理员登录角色异常");
  const managedChannel = await request("/api/admin/channels/1", {
    method: "PUT",
    headers: { Authorization: `Bearer ${channelAdminSession.token}` },
    body: JSON.stringify({ announcement: "频道管理员更新公告", description: "频道管理员更新说明" })
  });
  assert(managedChannel.description === "频道管理员更新说明", "频道管理员更新频道说明失败");
  assert(managedChannel.announcement === "频道管理员更新公告", "频道管理员更新频道公告失败");
  await request("/api/channels/1/members", {
    method: "POST",
    headers: { Authorization: `Bearer ${channelAdminSession.token}` },
    body: JSON.stringify({ userId: 4 })
  });
  await request("/api/channels/1/members/4", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${channelAdminSession.token}` }
  });
  await expectFailure("/api/admin/overview", {
    headers: { Authorization: `Bearer ${channelAdminSession.token}` }
  }, "频道管理员不应访问管理总览");
  await request("/api/admin/users/3", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ role: "USER", disabled: false })
  });

  const disabledOverview = await request("/api/admin/users/4", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ role: "USER", disabled: true })
  });
  assert(disabledOverview.users.find((item) => item.id === 4).disabled === true, "用户停用保存失败");
  await expectFailure("/api/login", {
    method: "POST",
    body: JSON.stringify({ account: "wangwu", password: "123456" })
  }, "停用用户登录应被拒绝");
  await request("/api/admin/users/4", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ role: "USER", disabled: false })
  });
  const wangwuSession = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ account: "wangwu", password: "123456" })
  });
  const onlineWorkspace = await request("/api/workspace", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(onlineWorkspace.users.find((item) => item.id === 4).online === true, "用户登录后在线状态异常");
  const logoutResult = await request("/api/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${wangwuSession.token}` },
    body: "{}"
  });
  assert(logoutResult.loggedOut === true, "用户登出接口异常");
  await expectFailure("/api/session", {
    headers: { Authorization: `Bearer ${wangwuSession.token}` }
  }, "登出后会话应失效");
  const offlineWorkspace = await request("/api/workspace", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(offlineWorkspace.users.find((item) => item.id === 4).online === false, "用户登出后在线状态异常");

  const originalPolicy = adminOverview.securityPolicy;
  const policyOverview = await request("/api/admin/security-policy", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ ...originalPolicy, maxLoginFailures: 3, lockMinutes: 1, minPasswordLength: 8, requireNumber: true })
  });
  assert(policyOverview.securityPolicy.maxLoginFailures === 3, "登录失败策略保存失败");
  const lockAccount = `lock-${Date.now()}`;
  for (let index = 0; index < 3; index += 1) {
    await expectFailure("/api/login", {
      method: "POST",
      body: JSON.stringify({ account: lockAccount, password: "bad-password" })
    }, "错误密码登录应失败");
  }
  await expectFailure("/api/login", {
    method: "POST",
    body: JSON.stringify({ account: lockAccount, password: "bad-password" })
  }, "登录失败锁定应生效");
  await request("/api/admin/security-policy", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(originalPolicy)
  });

  const originalUploadPolicy = adminOverview.uploadPolicy;
  const uploadPolicyOverview = await request("/api/admin/upload-policy", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ allowedExtensions: [".txt"], maxFileSizeMb: 1 })
  });
  assert(uploadPolicyOverview.uploadPolicy.allowedExtensions.includes(".txt"), "文件策略保存失败");
  const blockedFile = new FormData();
  blockedFile.append("channelId", "1");
  blockedFile.append("file", new Blob(["blocked"], { type: "application/octet-stream" }), "blocked.exe");
  await expectFailure("/api/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: blockedFile
  }, "禁止扩展名上传应被拒绝");
  await request("/api/admin/upload-policy", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(originalUploadPolicy)
  });

  const originalNetworkPolicy = adminOverview.networkPolicy;
  const networkPolicyOverview = await request("/api/admin/network-policy", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ allowedIps: ["127.0.0.1"], enabled: true })
  });
  assert(networkPolicyOverview.networkPolicy.enabled === true, "网络策略保存失败");
  const whitelistHealth = await request("/api/health");
  assert(whitelistHealth.status === "UP", "IP 白名单允许本机访问失败");
  await request("/api/admin/network-policy", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(originalNetworkPolicy)
  });

  const exportResponse = await fetch(`${baseUrl}/api/admin/audits/export?token=${encodeURIComponent(session.token)}`);
  assert(exportResponse.ok, "审计导出失败");
  const exportText = await exportResponse.text();
  assert(exportText.includes("ID,模块,操作,目标,操作者,结果,时间"), "审计导出内容异常");

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

  const { result: sent, event: realtimeMessageEvent } = await assertRealtimeEvent(
    session.token,
    "message:channel",
    () => request("/api/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ channelId: 1, senderId: 1, content: "MVP 冒烟消息" })
    })
  );
  assert(sent.id > 0, "发送消息失败");
  assert(realtimeMessageEvent.payload.message.id === sent.id, "实时频道消息事件异常");

  const mentionMessage = await request("/api/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ channelId: 1, senderId: 1, content: "@张三 请关注阶段 5 提醒验证" })
  });
  assert(mentionMessage.mentionUserIds.includes(2), "@ 人提醒识别失败");
  const mentionWorkspace = await request("/api/workspace", {
    headers: { Authorization: `Bearer ${normalSession.token}` }
  });
  assert((mentionWorkspace.channels.find((item) => item.id === 1).mentionCount || 0) >= 1, "@ 人提醒未读数异常");

  const edited = await request(`/api/messages/${sent.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ content: "MVP 冒烟消息已编辑" })
  });
  assert(edited.edited === true && edited.content === "MVP 冒烟消息已编辑", "编辑消息失败");

  const pinned = await request(`/api/messages/${sent.id}/pin`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ pinned: true })
  });
  assert(pinned.pinned === true, "置顶消息失败");
  const unpinned = await request(`/api/messages/${sent.id}/pin`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ pinned: false })
  });
  assert(unpinned.pinned === false, "取消置顶消息失败");

  const favorited = await request(`/api/messages/${sent.id}/favorite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ favorited: true })
  });
  assert(favorited.favoriteUserIds.includes(session.user.id), "收藏消息失败");
  const reacted = await request(`/api/messages/${sent.id}/reactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ emoji: "👍", reacted: true })
  });
  assert(reacted.reactions["👍"].includes(session.user.id), "表情回应失败");
  const reactionRemoved = await request(`/api/messages/${sent.id}/reactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ emoji: "👍", reacted: false })
  });
  assert(!reactionRemoved.reactions["👍"], "取消表情回应失败");
  const favoriteRemoved = await request(`/api/messages/${sent.id}/favorite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ favorited: false })
  });
  assert(!favoriteRemoved.favoriteUserIds.includes(session.user.id), "取消收藏消息失败");

  const channel = await request("/api/channels", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ name: `smoke-${Date.now()}`, description: "冒烟验证频道" })
  });
  assert(channel.id > 0, "管理员创建频道失败");

  const updatedChannel = await request(`/api/admin/channels/${channel.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ announcement: "冒烟频道公告", description: "冒烟更新频道说明" })
  });
  assert(updatedChannel.description === "冒烟更新频道说明", "管理后台更新频道失败");
  assert(updatedChannel.announcement === "冒烟频道公告", "管理后台更新频道公告失败");

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

  await expectFailure("/api/audits", {
    headers: { Authorization: `Bearer ${normalSession.token}` }
  }, "普通用户查看审计应被拒绝");

  const unreadChannel = await request("/api/channels", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ name: `unread-${Date.now()}`, description: "冒烟未读验证频道" })
  });
  await request(`/api/channels/${unreadChannel.id}/members`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ userId: 2 })
  });

  const normalChannelMessage = await request("/api/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${normalSession.token}` },
    body: JSON.stringify({ channelId: unreadChannel.id, senderId: 2, content: "普通用户频道未读验证" })
  });
  assert(normalChannelMessage.id > 0, "普通用户发送频道消息失败");

  const unreadWorkspace = await request("/api/workspace", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  const unreadChannelState = unreadWorkspace.channels.find((item) => item.id === unreadChannel.id);
  assert(unreadChannelState.unreadCount >= 1, "频道未读数异常");

  await request(`/api/channels/${unreadChannel.id}/messages`, {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  const readWorkspace = await request("/api/workspace", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert((readWorkspace.channels.find((item) => item.id === unreadChannel.id).unreadCount || 0) === 0, "频道未读清零失败");

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

  const imageData = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0xf8, 0x0f, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ]);
  const imageFormData = new FormData();
  imageFormData.append("channelId", "1");
  imageFormData.append("file", new Blob([imageData], { type: "image/png" }), "smoke-preview.png");
  const imageUpload = await request("/api/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: imageFormData
  });
  assert(imageUpload.file && imageUpload.file.originalName === "smoke-preview.png", "图片上传失败");
  const channelFiles = await request("/api/channels/1/files", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(channelFiles.some((item) => item.file && item.file.originalName === "smoke-preview.png"), "频道文件列表缺少图片文件");

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

  const channelSearchResults = await request(`/api/search?q=${encodeURIComponent("阶段 5 提醒验证")}`, {
    headers: { Authorization: `Bearer ${normalSession.token}` }
  });
  assert(channelSearchResults.some((item) => item.channelId === 1 && item.id === mentionMessage.id), "搜索结果定位上下文异常");

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
  assert(audits.some((item) => item.action === "置顶消息"), "审计列表缺少置顶记录");
  assert(audits.some((item) => item.action === "收藏消息"), "审计列表缺少收藏记录");
  assert(audits.some((item) => item.action === "回应消息"), "审计列表缺少回应记录");
  assert(audits.some((item) => item.action === "撤回消息"), "审计列表缺少撤回记录");
  assert(audits.some((item) => item.action === "上传文件"), "审计列表缺少上传记录");
  const fileAudits = await request("/api/audits?type=file", {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(fileAudits.every((item) => ["上传文件", "下载文件"].includes(item.action)), "审计文件筛选异常");
  const operatorAudits = await request(`/api/audits?type=file&operator=${encodeURIComponent(session.user.account)}&q=${encodeURIComponent("文件")}`, {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  assert(operatorAudits.length >= 1, "审计组合筛选无结果");
  assert(operatorAudits.every((item) => item.operator.includes(session.user.account) && ["上传文件", "下载文件"].includes(item.action)), "审计组合筛选异常");

  writeSmokeReport("通过", "BeeChat MVP 冒烟验证通过");
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
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (payload.success) {
    throw new Error(message);
  }
}

async function assertStaticAssets(html) {
  const assets = [
    ...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)
  ].map((match) => match[1]);
  assert(assets.length >= 2, "前端静态资源引用异常");
  for (const asset of assets) {
    const response = await fetch(`${baseUrl}${asset}`);
    assert(response.ok, `静态资源加载失败：${asset}`);
  }
}

function assertProdDeployConfig() {
  const dockerfile = fs.readFileSync(dockerfilePath, "utf8");
  const composeProd = fs.readFileSync(composeProdPath, "utf8");
  const envProdExample = fs.readFileSync(envProdExamplePath, "utf8");
  const nginxConfig = fs.readFileSync(nginxConfigPath, "utf8");
  assert(dockerfile.includes("AS frontend-builder"), "Dockerfile 缺少前端构建阶段");
  assert(dockerfile.includes("COPY --from=frontend-builder"), "Dockerfile 未复制前端产物");
  assert(dockerfile.includes("HEALTHCHECK"), "Dockerfile 缺少健康检查");
  assert(composeProd.includes("./data:/app/data"), "生产 Compose 缺少数据卷");
  assert(composeProd.includes("./logs:/app/logs"), "生产 Compose 缺少日志卷");
  assert(composeProd.includes("./backups:/app/backups"), "生产 Compose 缺少备份卷");
  assert(envProdExample.includes("BEECHAT_BIND="), "生产环境变量样例缺少绑定地址");
  assert(envProdExample.includes("BEECHAT_DB_PROVIDER=sqlite"), "生产环境变量样例缺少数据库类型");
  assert(envProdExample.includes("BEECHAT_DATABASE_URL="), "生产环境变量样例缺少数据库连接串");
  assert(nginxConfig.includes("location /api/realtime"), "Nginx 样例缺少 WebSocket 代理");
  const postgresMigration = fs.readFileSync(postgresMigrationPath, "utf8");
  const databasePlan = fs.readFileSync(databasePlanPath, "utf8");
  const postgresExportScript = fs.readFileSync(postgresExportScriptPath, "utf8");
  const postgresAdapter = fs.readFileSync(postgresAdapterPath, "utf8");
  const repositoryContract = fs.readFileSync(repositoryContractPath, "utf8");
  const sqliteRepository = fs.readFileSync(sqliteRepositoryPath, "utf8");
  const postgresRepository = fs.readFileSync(postgresRepositoryPath, "utf8");
  const serverIndex = fs.readFileSync(serverIndexPath, "utf8");
  assert(postgresMigration.includes("JSONB"), "PostgreSQL 迁移缺少 JSONB 字段");
  assert(postgresMigration.includes("REFERENCES users"), "PostgreSQL 迁移缺少用户外键约束");
  assert(postgresMigration.includes("password_hash"), "PostgreSQL 迁移缺少密码哈希字段");
  assert(postgresMigration.includes("idx_messages_channel_parent_id"), "PostgreSQL 迁移缺少消息索引");
  assert(databasePlan.includes("SQLite 到 PostgreSQL 迁移路径"), "数据库规划缺少迁移路径");
  assert(databasePlan.includes("npm run db:export:postgres"), "数据库规划缺少 PostgreSQL 导出命令");
  assert(postgresExportScript.includes("INSERT INTO messages"), "PostgreSQL 导出脚本缺少消息导入逻辑");
  assert(postgresAdapter.includes("class PostgresAdapter"), "PostgreSQL 查询适配层缺少类定义");
  assert(postgresAdapter.includes("async transaction"), "PostgreSQL 查询适配层缺少事务封装");
  assert(repositoryContract.includes("REQUIRED_METHODS"), "仓储契约缺少方法清单");
  assert(sqliteRepository.includes("class SQLiteRepository"), "SQLite 仓储缺少类定义");
  assert(postgresRepository.includes("class PostgresRepository"), "PostgreSQL 仓储缺少类定义");
  assert(serverIndex.includes("createSQLiteRepository"), "主服务未初始化 SQLite 仓储");
  assert(serverIndex.includes("readRepository().channelById"), "主服务未接入仓储频道读取");
  assert(serverIndex.includes("readRepository().channelMembers"), "主服务未接入仓储成员读取");
  assert(serverIndex.includes("readRepository().channelMessages"), "主服务未接入仓储消息分页读取");
  assert(serverIndex.includes("readRepository().directMessages"), "主服务未接入仓储私信分页读取");
  assert(serverIndex.includes("readRepository().channelFiles"), "主服务未接入仓储文件读取");
  assert(serverIndex.includes("readRepository().audits"), "主服务未接入仓储审计读取");
  assert(serverIndex.includes("readRepository().createChannelMessage"), "主服务未接入仓储频道消息写入");
  assert(serverIndex.includes("readRepository().createDirectMessage"), "主服务未接入仓储私信写入");
  assert(serverIndex.includes("readRepository().updateMessageContent"), "主服务未接入仓储消息编辑写入");
  assert(serverIndex.includes("readRepository().revokeMessage"), "主服务未接入仓储消息撤回写入");
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

function assertRealtimeEvent(token, expectedEvent, trigger) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${baseUrl.replace("http", "ws")}/api/realtime?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`实时事件 ${expectedEvent} 等待超时`));
    }, 3000);
    let triggerResult = null;
    let triggerPromise = null;

    ws.addEventListener("message", async (event) => {
      const payload = JSON.parse(event.data);
      try {
        if (payload.event === "connected") {
          triggerPromise = Promise.resolve(trigger()).then((result) => {
            triggerResult = result;
            return result;
          });
          return;
        }
        if (payload.event !== expectedEvent) return;
        if (triggerPromise) await triggerPromise;
        clearTimeout(timer);
        ws.close();
        resolve({ result: triggerResult, event: payload });
      } catch (error) {
        clearTimeout(timer);
        ws.close();
        reject(error);
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`实时事件 ${expectedEvent} 连接失败`));
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeSmokeReport(status, message) {
  const endedAt = new Date();
  const cssHref = "../assets/docs.css";
  const resultTone = status === "通过" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200";
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BeeChat 冒烟测试报告</title>
    <link rel="stylesheet" href="${cssHref}" />
  </head>
  <body>
    <div class="doc-shell">
      <main class="doc-main">
        <article class="doc-article">
          <div class="doc-meta"><span>BeeChat</span><span>离线 HTML 测试报告</span></div>
          <h1>BeeChat 冒烟测试报告</h1>
          <p class="border ${resultTone} rounded-md px-4 py-3 font-bold">结果：${escapeHtml(status)}</p>
          <table>
            <tbody>
              <tr><th>开始时间</th><td>${escapeHtml(startedAt.toLocaleString("zh-CN", { hour12: false }))}</td></tr>
              <tr><th>结束时间</th><td>${escapeHtml(endedAt.toLocaleString("zh-CN", { hour12: false }))}</td></tr>
              <tr><th>入口地址</th><td><code>${escapeHtml(baseUrl)}</code></td></tr>
              <tr><th>执行命令</th><td><code>npm run smoke</code></td></tr>
              <tr><th>结论</th><td>${escapeHtml(message)}</td></tr>
            </tbody>
          </table>
          <h2>覆盖范围</h2>
          <ul>
            <li>入口页面、静态资源、健康检查、运行指标、结构化日志、数据库迁移。</li>
            <li>Docker 多阶段构建、生产 Compose、环境变量样例、Nginx WebSocket 代理样例。</li>
            <li>PostgreSQL 表结构迁移、生产数据库变量、SQLite 到 PostgreSQL 迁移规划。</li>
            <li>PostgreSQL 一次性导入 SQL 生成脚本与数据顺序校验。</li>
            <li>数据库运行模式配置、PostgreSQL 未启用保护和健康检查数据库摘要。</li>
            <li>PostgreSQL 查询适配层、连接串校验、事务封装和迁移执行封装。</li>
            <li>业务仓储契约、SQLite 仓储骨架、PostgreSQL 仓储骨架和双实现契约检查。</li>
            <li>主服务频道、成员、频道消息分页、私信分页、文件列表、审计查询只读路径接入 SQLite 仓储。</li>
            <li>主服务频道消息发送写入路径接入 SQLite 仓储。</li>
            <li>主服务私信发送写入路径接入 SQLite 仓储。</li>
            <li>主服务消息编辑与消息撤回写入路径接入 SQLite 仓储。</li>
            <li>登录、会话恢复、退出登录、WebSocket 实时连接、动态在线状态。</li>
            <li>频道消息、线程、私信、未读清零。</li>
            <li>频道公告、置顶消息、消息收藏、表情回应、频道成员管理。</li>
            <li>@ 人提醒、文件上传策略、下载、图片预览数据、频道文件列表、搜索定位、审计筛选与导出。</li>
            <li>角色权限、安全策略、IP 白名单。</li>
          </ul>
        </article>
      </main>
    </div>
  </body>
</html>`;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, html);
}

main().catch((error) => {
  writeSmokeReport("失败", error.message);
  console.error(error.message);
  process.exit(1);
});
