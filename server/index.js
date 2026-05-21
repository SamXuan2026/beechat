const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { createSQLiteRepository } = require("./repositories/sqlite-repository");

const PORT = Number(process.env.PORT || 5188);
const FRONTEND_PUBLIC_DIR = path.join(__dirname, "..", "frontend", "dist");
const LEGACY_PUBLIC_DIR = path.join(__dirname, "..", "web");
const DATA_DIR = path.join(__dirname, "..", "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "beechat.log");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const DB_FILE = path.join(DATA_DIR, "beechat.sqlite");
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const DB_PROVIDER = normalizeDatabaseProvider(process.env.BEECHAT_DB_PROVIDER || "sqlite");
const DATABASE_URL = String(process.env.BEECHAT_DATABASE_URL || "").trim();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_RAW_UPLOAD_BYTES = 100 * 1024 * 1024 + 1024 * 128;
const USER_ROLES = new Set(["ADMIN", "AUDITOR", "CHANNEL_ADMIN", "USER"]);
const MESSAGE_REACTIONS = new Set(["👍", "✅", "👀"]);
const STARTED_AT = new Date();
const MAX_LOG_BYTES = 5 * 1024 * 1024;

const users = [
  { id: 1, account: "13677889001", name: "当前用户", role: "ADMIN", passwordHash: hashPassword("admin123"), avatarText: "我", avatarColor: "#4A9FD8", online: true },
  { id: 2, account: "zhangsan", name: "张三", role: "USER", passwordHash: hashPassword("123456"), avatarText: "张", avatarColor: "#E8924A", online: true },
  { id: 3, account: "lisi", name: "李四", role: "USER", passwordHash: hashPassword("123456"), avatarText: "李", avatarColor: "#5DADE2", online: true },
  { id: 4, account: "wangwu", name: "王五", role: "USER", passwordHash: hashPassword("123456"), avatarText: "王", avatarColor: "#58D68D", online: false }
];

const seedChannels = [
  { id: 1, name: "general", description: "日常协作与公告", announcement: "本周优先完成阶段 5 消息协作增强验证，重要消息请及时置顶。", joined: true, memberCount: 128, unreadCount: 0 },
  { id: 2, name: "engineering", description: "研发项目协作", announcement: "研发频道仅讨论当前迭代任务，发布前请确认审计记录完整。", joined: true, memberCount: 34, unreadCount: 3 },
  { id: 3, name: "sales", description: "客户与商机协作", announcement: "", joined: false, memberCount: 42, unreadCount: 0 },
  { id: 4, name: "announcements", description: "只读公告频道", announcement: "公告频道由管理员统一发布，普通成员仅阅读。", joined: true, memberCount: 128, unreadCount: 0 }
];

const now = Date.now();
const seedMessages = [
  createSeedMessage(101, 1, null, 2, "大家好！新版聊天工具的 UI 设计稿已经出来了，请大家看看效果如何？", false, "已读 18 人", 2, now - 1200000),
  createSeedMessage(102, 1, null, 3, "设计风格挺清爽！相比传统企业 IM，线程和审计提示更适合内部协作。", false, "已读 12 人", 1, now - 960000),
  createSeedMessage(103, 1, null, 1, "同意！全局会话像 Lark 操作平台的体验，加上 Telegram 的消息气泡会更舒服。", false, "已读 12 人 · 已归档", 0, now - 600000),
  createSeedMessage(104, 1, null, 4, "可以把上传的合同文档走脱敏，另外提醒功能也要参考 Lark 的全局搜索。", true, "敏感词已提示", 0, now - 300000),
  createSeedMessage(201, 1, 102, 2, "线程里建议补充：移动端先不做，MVP 只做桌面 Web。", false, "已送达", 0, now - 800000),
  createSeedMessage(202, 1, 102, 1, "收到，第一期先保证频道、线程和审计闭环。", false, "已送达", 0, now - 700000)
];

let channels = [];
let messages = [];
let audits = [];
let unreadState = {};
let sessions = {};
let userSettings = {};
let userAdminState = {};
let loginFailures = {};
let securityPolicy = defaultSecurityPolicy();
let uploadPolicy = defaultUploadPolicy();
let networkPolicy = defaultNetworkPolicy();
let db = null;
let repository = null;
const realtimeClients = new Map();
let nextMessageId = 1000;
let nextChannelId = 10;

function normalizeDatabaseProvider(value) {
  const provider = String(value || "sqlite").trim().toLowerCase();
  if (provider === "postgresql") return "postgres";
  return provider;
}

function databaseRuntimeConfig() {
  return {
    provider: DB_PROVIDER,
    sqliteFile: DB_PROVIDER === "sqlite" ? DB_FILE : null,
    postgresConfigured: DB_PROVIDER === "postgres" && Boolean(DATABASE_URL)
  };
}

function validateDatabaseConfig() {
  if (!["sqlite", "postgres"].includes(DB_PROVIDER)) {
    throw new Error(`数据库类型不支持：${DB_PROVIDER}，请使用 sqlite 或 postgres`);
  }
  if (DB_PROVIDER === "postgres" && !DATABASE_URL) {
    throw new Error("PostgreSQL 模式缺少 BEECHAT_DATABASE_URL");
  }
}

function readRepository() {
  if (!repository) {
    throw new Error("业务仓储尚未初始化");
  }
  return repository;
}

function createSeedMessage(id, channelId, parentId, senderId, content, sensitive, deliveryStatus, replyCount, time) {
  const sender = users.find((item) => item.id === senderId);
  return {
    id,
    channelId,
    parentId,
    senderId,
    senderName: sender.name,
    avatarText: sender.avatarText,
    avatarColor: sender.avatarColor,
    content,
    sensitive,
    deliveryStatus,
    replyCount,
    pinned: false,
    favoriteUserIds: [],
    reactions: {},
    mentionUserIds: mentionedUserIds(content, senderId),
    messageType: parentId ? "THREAD" : "CHANNEL",
    createdAt: new Date(time).toISOString()
  };
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  response.end(JSON.stringify({ success: status < 400, code: status < 400 ? "OK" : "ERROR", message: status < 400 ? "处理成功" : data.message, data: status < 400 ? data : null }));
}

function sendCsv(response, filename, rows) {
  response.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
  });
  response.end(`\uFEFF${rows.join("\n")}`);
}

function safeLogValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (value && typeof value === "object") return value;
  return value;
}

function rotateLogIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stat = fs.statSync(LOG_FILE);
    if (stat.size < MAX_LOG_BYTES) return;
    const rotated = path.join(LOG_DIR, `beechat-${Date.now()}.log`);
    fs.renameSync(LOG_FILE, rotated);
  } catch {
    // 日志轮转失败不影响主流程。
  }
}

function writeLog(level, event, fields = {}) {
  const record = {
    time: new Date().toISOString(),
    level,
    event,
    service: "bee-chat",
    ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, safeLogValue(value)]))
  };
  const line = `${JSON.stringify(record)}\n`;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    rotateLogIfNeeded();
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // 文件日志失败时仍保留控制台输出。
  }
  if (level === "ERROR") {
    console.error(line.trim());
    return;
  }
  console.log(line.trim());
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(`beechat:${password}`).digest("hex");
}

function isUserOnline(userId) {
  pruneExpiredSessions();
  const id = Number(userId);
  const user = users.find((item) => item.id === id);
  if (user && user.disabled) return false;
  const hasActiveSession = Object.values(sessions).some((session) => Number(session.userId) === id);
  const hasRealtimeClient = [...realtimeClients.values()].some((client) => Number(client.user.id) === id);
  return hasActiveSession || hasRealtimeClient;
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    disabled: Boolean(user.disabled),
    online: isUserOnline(user.id)
  };
}

function publicUsers() {
  return users.map(publicUser);
}

function defaultSettingsFor(user) {
  return {
    displayName: user.name,
    bio: "在 BeeChat 团队工作",
    emailDigest: true,
    desktopNotify: true,
    soundNotify: false,
    compactMode: false
  };
}

function settingsFor(user) {
  return {
    ...defaultSettingsFor(user),
    ...(userSettings[String(user.id)] || {})
  };
}

function applyUserSettingsToUsers() {
  users.forEach((user) => {
    const settings = userSettings[String(user.id)];
    if (settings && settings.displayName) {
      user.name = settings.displayName;
    }
  });
}

function defaultSecurityPolicy() {
  return {
    maxLoginFailures: 5,
    lockMinutes: 15,
    minPasswordLength: 6,
    requireNumber: true
  };
}

function defaultUploadPolicy() {
  return {
    allowedExtensions: [".txt", ".md", ".pdf", ".png", ".jpg", ".jpeg", ".csv", ".xlsx", ".docx"],
    maxFileSizeMb: 5
  };
}

function defaultNetworkPolicy() {
  return {
    enabled: false,
    allowedIps: ["127.0.0.1", "::1"]
  };
}

function normalizeIp(value) {
  const ip = String(value || "").trim();
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  if (ip === "::1") return "127.0.0.1";
  return ip;
}

function normalizedNetworkPolicy(value = {}) {
  const defaults = defaultNetworkPolicy();
  const source = Array.isArray(value.allowedIps) ? value.allowedIps : String(value.allowedIps || "").split(",");
  const allowedIps = source
    .map((item) => normalizeIp(item))
    .filter(Boolean)
    .filter((item) => /^[a-zA-Z0-9:.%-]+$/.test(item));
  return {
    enabled: Boolean(value.enabled),
    allowedIps: [...new Set(allowedIps.length ? allowedIps : defaults.allowedIps)]
  };
}

function clientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return normalizeIp(forwarded || request.socket.remoteAddress || "");
}

function isIpAllowed(request) {
  if (!networkPolicy.enabled) return true;
  const allowed = new Set((networkPolicy.allowedIps || []).map((item) => normalizeIp(item)));
  return allowed.has(clientIp(request));
}

function normalizeExtensions(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  const extensions = source
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
    .map((item) => (item.startsWith(".") ? item : `.${item}`))
    .filter((item) => /^\.[a-z0-9]+$/.test(item));
  return [...new Set(extensions)].slice(0, 30);
}

function normalizedUploadPolicy(value = {}) {
  const defaults = defaultUploadPolicy();
  const allowedExtensions = normalizeExtensions(value.allowedExtensions || defaults.allowedExtensions);
  return {
    allowedExtensions: allowedExtensions.length ? allowedExtensions : defaults.allowedExtensions,
    maxFileSizeMb: Math.min(Math.max(Number(value.maxFileSizeMb) || defaults.maxFileSizeMb, 1), 100)
  };
}

function applyAdminStateToUsers() {
  users.forEach((user) => {
    const state = userAdminState[String(user.id)];
    user.role = state && USER_ROLES.has(state.role) ? state.role : user.id === 1 ? "ADMIN" : "USER";
    user.disabled = Boolean(state && state.disabled);
  });
}

function loginFailureFor(account) {
  const key = String(account || "");
  if (!loginFailures[key]) {
    loginFailures[key] = { count: 0, lockedUntil: 0 };
  }
  return loginFailures[key];
}

function isAccountLocked(account) {
  const failure = loginFailureFor(account);
  return Number(failure.lockedUntil || 0) > Date.now();
}

function recordLoginFailure(account) {
  const failure = loginFailureFor(account);
  failure.count = Number(failure.count || 0) + 1;
  if (failure.count >= Number(securityPolicy.maxLoginFailures || 5)) {
    failure.lockedUntil = Date.now() + Number(securityPolicy.lockMinutes || 15) * 60 * 1000;
  }
  saveStore();
}

function clearLoginFailure(account) {
  delete loginFailures[String(account || "")];
  saveStore();
}

function createDefaultStore() {
  return {
    channels: seedChannels.map((channel) => normalizeChannel(channel)),
    messages: seedMessages,
    audits: [],
    userSettings: {},
    userAdminState: {},
    loginFailures: {},
    securityPolicy: defaultSecurityPolicy(),
    uploadPolicy: defaultUploadPolicy(),
    networkPolicy: defaultNetworkPolicy(),
    unreadState: {
      "1": {
        channels: { "2": 3 },
        direct: {}
      }
    }
  };
}

function normalizeChannel(channel) {
  const members = Array.isArray(channel.members) && channel.members.length ? channel.members : users.map((user) => user.id);
  return {
    ...channel,
    announcement: String(channel.announcement || ""),
    members,
    memberCount: members.length
  };
}

function maxId(items) {
  return items.reduce((result, item) => Math.max(result, Number(item.id) || 0), 0);
}

function loadStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  initDatabase();
  const sqliteStore = loadSqliteSnapshot();
  if (sqliteStore) {
    applyStore(sqliteStore);
    saveStore();
    return;
  }
  if (!fs.existsSync(DATA_FILE)) {
    const defaults = createDefaultStore();
    applyStore(defaults);
    saveStore();
    return;
  }

  const content = fs.readFileSync(DATA_FILE, "utf8");
  const stored = JSON.parse(content);
  applyStore(stored);
  saveStore();
}

function applyStore(stored) {
  channels = Array.isArray(stored.channels) ? stored.channels.map((channel) => normalizeChannel(channel)) : seedChannels.map((channel) => normalizeChannel(channel));
  messages = Array.isArray(stored.messages) ? stored.messages : seedMessages;
  messages.forEach(normalizeMessageEnhancement);
  audits = Array.isArray(stored.audits) ? stored.audits : [];
  unreadState = stored.unreadState && typeof stored.unreadState === "object" ? stored.unreadState : {};
  sessions = stored.sessions && typeof stored.sessions === "object" ? stored.sessions : {};
  userSettings = stored.userSettings && typeof stored.userSettings === "object" ? stored.userSettings : {};
  userAdminState = stored.userAdminState && typeof stored.userAdminState === "object" ? stored.userAdminState : {};
  loginFailures = stored.loginFailures && typeof stored.loginFailures === "object" ? stored.loginFailures : {};
  securityPolicy = { ...defaultSecurityPolicy(), ...(stored.securityPolicy || {}) };
  uploadPolicy = normalizedUploadPolicy(stored.uploadPolicy);
  networkPolicy = normalizedNetworkPolicy(stored.networkPolicy);
  applyAdminStateToUsers();
  applyUserSettingsToUsers();
  pruneExpiredSessions();
  nextMessageId = Math.max(1000, maxId(messages));
  nextChannelId = Math.max(10, maxId(channels));
  refreshRepository();
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  pruneExpiredSessions();
  const snapshot = { channels, messages, audits, unreadState, sessions, userSettings, userAdminState, loginFailures, securityPolicy, uploadPolicy, networkPolicy };
  fs.writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2));
  saveSqliteSnapshot(snapshot);
}

function initDatabase() {
  if (DB_PROVIDER === "postgres") {
    throw new Error("PostgreSQL 运行适配层尚未启用。请先使用 npm run db:export:postgres 生成导入 SQL，并保持 BEECHAT_DB_PROVIDER=sqlite 运行当前版本。");
  }
  db = new DatabaseSync(DB_FILE);
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  runMigrations();
  refreshRepository();
}

function refreshRepository() {
  if (!db) return;
  repository = createSQLiteRepository({ db, users, messages, publicMessage });
}

function runMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return;
  const appliedRows = db.prepare("SELECT version FROM schema_migrations").all();
  const appliedVersions = new Set(appliedRows.map((row) => row.version));
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  files.forEach((file) => {
    const version = file.split("_")[0];
    if (appliedVersions.has(version)) return;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8").trim();
    if (!sql) return;
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)")
        .run(version, file, new Date().toISOString());
      db.exec("COMMIT");
      appliedVersions.add(version);
      writeLog("INFO", "migration.applied", { version, file });
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`数据库迁移失败：${file}，${error.message}`);
    }
  });
}

function migrationStatus() {
  if (!db) return [];
  return db.prepare("SELECT version, name, applied_at AS appliedAt FROM schema_migrations ORDER BY version ASC").all();
}

function loadSqliteSnapshot() {
  if (!db) return null;
  const row = db.prepare("SELECT value FROM app_state WHERE key = ?").get("store");
  if (!row) return null;
  return JSON.parse(row.value);
}

function saveSqliteSnapshot(snapshot) {
  if (!db) return;
  syncNormalizedTables(snapshot);
  db.prepare(`
    INSERT INTO app_state(key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run("store", JSON.stringify(snapshot), new Date().toISOString());
}

function syncNormalizedTables(snapshot) {
  db.exec("BEGIN");
  try {
    db.exec(`
      DELETE FROM users;
      DELETE FROM sessions;
      DELETE FROM channels;
      DELETE FROM channel_members;
      DELETE FROM messages;
      DELETE FROM files;
      DELETE FROM audits;
      DELETE FROM unread_state;
    `);
    const insertUser = db.prepare("INSERT INTO users(id, account, name, role, avatar_text, avatar_color, online) VALUES (?, ?, ?, ?, ?, ?, ?)");
    users.forEach((user) => insertUser.run(user.id, user.account, user.name, user.role, user.avatarText, user.avatarColor, isUserOnline(user.id) ? 1 : 0));
    const insertSession = db.prepare("INSERT INTO sessions(token, user_id, expires_at) VALUES (?, ?, ?)");
    Object.entries(snapshot.sessions || {}).forEach(([token, session]) => insertSession.run(token, session.userId, session.expiresAt));
    const insertChannel = db.prepare("INSERT INTO channels(id, name, description, announcement, joined, member_count) VALUES (?, ?, ?, ?, ?, ?)");
    const insertMember = db.prepare("INSERT INTO channel_members(channel_id, user_id) VALUES (?, ?)");
    snapshot.channels.forEach((channel) => {
      insertChannel.run(channel.id, channel.name, channel.description || "", channel.announcement || "", channel.joined ? 1 : 0, channel.members.length);
      channel.members.forEach((userId) => insertMember.run(channel.id, userId));
    });
    const insertMessage = db.prepare(`
      INSERT INTO messages(id, channel_id, parent_id, sender_id, receiver_id, message_type, content, sensitive, delivery_status, reply_count, pinned, favorite_user_ids_json, reactions_json, mention_user_ids_json, revoked, edited, file_json, created_at, edited_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertFile = db.prepare("INSERT INTO files(stored_name, message_id, original_name, size, path) VALUES (?, ?, ?, ?, ?)");
    snapshot.messages.forEach((message) => {
      insertMessage.run(
        message.id,
        message.channelId,
        message.parentId,
        message.senderId,
        message.receiverId || null,
        message.messageType,
        message.content,
        message.sensitive ? 1 : 0,
        message.deliveryStatus,
        message.replyCount || 0,
        message.pinned ? 1 : 0,
        JSON.stringify(message.favoriteUserIds || []),
        JSON.stringify(message.reactions || {}),
        JSON.stringify(message.mentionUserIds || []),
        message.revoked ? 1 : 0,
        message.edited ? 1 : 0,
        message.file ? JSON.stringify(message.file) : null,
        message.createdAt,
        message.editedAt || null,
        message.revokedAt || null
      );
      if (message.file) insertFile.run(message.file.storedName, message.id, message.file.originalName, message.file.size, message.file.path);
    });
    const insertAudit = db.prepare("INSERT INTO audits(id, module, action, target_id, operator, success, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    snapshot.audits.forEach((audit) => insertAudit.run(audit.id, audit.module, audit.action, audit.targetId, audit.operator, audit.success ? 1 : 0, audit.createdAt));
    const insertUnread = db.prepare("INSERT INTO unread_state(user_id, target_type, target_id, count) VALUES (?, ?, ?, ?)");
    Object.entries(snapshot.unreadState || {}).forEach(([userId, state]) => {
      Object.entries(state.channels || {}).forEach(([targetId, count]) => insertUnread.run(Number(userId), "channel", targetId, Number(count) || 0));
      Object.entries(state.direct || {}).forEach(([targetId, count]) => insertUnread.run(Number(userId), "direct", targetId, Number(count) || 0));
      Object.entries(state.mentions || {}).forEach(([targetId, count]) => insertUnread.run(Number(userId), "mention", targetId, Number(count) || 0));
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function sqliteMessageFromRow(row) {
  if (!row) return null;
  const sender = users.find((item) => item.id === Number(row.sender_id));
  const favoriteUserIds = row.favorite_user_ids_json ? JSON.parse(row.favorite_user_ids_json) : [];
  const reactions = row.reactions_json ? JSON.parse(row.reactions_json) : {};
  const mentionUserIds = row.mention_user_ids_json ? JSON.parse(row.mention_user_ids_json) : [];
  return {
    id: row.id,
    channelId: row.channel_id,
    parentId: row.parent_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    senderName: sender ? sender.name : "未知用户",
    avatarText: sender ? sender.avatarText : "?",
    avatarColor: sender ? sender.avatarColor : "#8a93a5",
    content: row.content,
    sensitive: Boolean(row.sensitive),
    deliveryStatus: row.delivery_status,
    replyCount: row.reply_count,
    messageType: row.message_type,
    pinned: Boolean(row.pinned),
    favoriteUserIds,
    reactions,
    mentionUserIds,
    revoked: Boolean(row.revoked),
    edited: Boolean(row.edited),
    file: row.file_json ? JSON.parse(row.file_json) : undefined,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    revokedAt: row.revoked_at
  };
}

function sqliteChannel(channelId) {
  const row = db.prepare("SELECT id, name, description, announcement, joined, member_count FROM channels WHERE id = ?").get(channelId);
  if (!row) return null;
  const members = db.prepare("SELECT user_id FROM channel_members WHERE channel_id = ?").all(channelId).map((item) => item.user_id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    announcement: row.announcement || "",
    joined: Boolean(row.joined),
    memberCount: row.member_count,
    members,
    unreadCount: 0,
    mentionCount: 0
  };
}

function sqliteChannelMembers(channelId) {
  return db.prepare(`
    SELECT u.id, u.account, u.name, u.role, u.avatar_text, u.avatar_color, u.online
    FROM users u
    JOIN channel_members cm ON cm.user_id = u.id
    WHERE cm.channel_id = ?
    ORDER BY u.id ASC
  `).all(channelId).map((row) => ({
    id: row.id,
    account: row.account,
    name: row.name,
    role: row.role,
    avatarText: row.avatar_text,
    avatarColor: row.avatar_color,
    online: Boolean(row.online)
  }));
}

function normalizePageSize(value) {
  const pageSize = Number(value) || 30;
  return Math.min(Math.max(pageSize, 1), 100);
}

function pagedMessages(rows, pageSize) {
  const hasMore = rows.length > pageSize;
  const items = (hasMore ? rows.slice(0, pageSize) : rows)
    .reverse()
    .map(sqliteMessageFromRow)
    .map(publicMessage);
  return {
    items,
    hasMore,
    nextBeforeId: items.length ? items[0].id : null,
    pageSize
  };
}

function sqliteChannelMessages(channelId, parentId, beforeId, pageSize) {
  const limit = pageSize + 1;
  const beforeSql = beforeId ? " AND id < ?" : "";
  const params = parentId
    ? [channelId, parentId]
    : [channelId];
  if (beforeId) params.push(beforeId);
  params.push(limit);
  const rows = parentId
    ? db.prepare(`SELECT * FROM messages WHERE channel_id = ? AND parent_id = ? AND message_type != 'DIRECT'${beforeSql} ORDER BY id DESC LIMIT ?`).all(...params)
    : db.prepare(`SELECT * FROM messages WHERE channel_id = ? AND parent_id IS NULL AND message_type != 'DIRECT'${beforeSql} ORDER BY id DESC LIMIT ?`).all(...params);
  return pagedMessages(rows, pageSize);
}

function sqliteDirectMessages(userId, peerId, beforeId, pageSize) {
  const beforeSql = beforeId ? " AND id < ?" : "";
  const params = [userId, peerId, peerId, userId];
  if (beforeId) params.push(beforeId);
  params.push(pageSize + 1);
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE message_type = 'DIRECT'
      AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
      ${beforeSql}
    ORDER BY id DESC
    LIMIT ?
  `).all(...params);
  return pagedMessages(rows, pageSize);
}

function sqliteChannelFiles(channelId) {
  return db.prepare(`
    SELECT * FROM messages
    WHERE channel_id = ?
      AND file_json IS NOT NULL
      AND revoked = 0
      AND message_type != 'DIRECT'
    ORDER BY id DESC
    LIMIT 100
  `).all(channelId).map(sqliteMessageFromRow).map(publicMessage);
}

function sqliteAudits(type, query = {}) {
  const rows = db.prepare("SELECT * FROM audits ORDER BY id DESC").all();
  const operator = String(query.operator || "").trim().toLowerCase();
  const keyword = String(query.keyword || "").trim().toLowerCase();
  const fromTime = query.from ? new Date(`${query.from}T00:00:00`).getTime() : 0;
  const toTime = query.to ? new Date(`${query.to}T23:59:59`).getTime() : 0;
  return rows.map((row) => ({
    id: row.id,
    module: row.module,
    action: row.action,
    targetId: row.target_id,
    operator: row.operator,
    success: Boolean(row.success),
    createdAt: row.created_at
  })).filter((item) => {
    if (type === "all") return true;
    if (type === "message") return ["发送频道消息", "发送线程回复", "发送私信", "编辑消息", "撤回消息", "置顶消息", "取消置顶消息", "收藏消息", "取消收藏消息", "回应消息", "取消回应消息"].includes(item.action);
    if (type === "file") return ["上传文件", "下载文件"].includes(item.action);
    if (type === "member") return ["邀请频道成员", "移除频道成员", "创建频道", "加入频道"].includes(item.action);
    if (type === "login") return item.action === "用户登录";
    return true;
  }).filter((item) => {
    if (operator && !String(item.operator || "").toLowerCase().includes(operator)) return false;
    if (keyword) {
      const haystack = [item.module, item.action, item.targetId, item.operator].join(" ").toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    const createdAt = new Date(item.createdAt).getTime();
    if (fromTime && createdAt < fromTime) return false;
    if (toTime && createdAt > toTime) return false;
    return true;
  });
}

function adminOverview() {
  return {
    metrics: {
      users: users.length,
      channels: channels.length,
      messages: messages.length,
      audits: audits.length
    },
    users: publicUsers().map((user) => ({
      ...user,
      disabled: Boolean(user.disabled),
      bio: settingsFor(user).bio,
      failedAttempts: Number(loginFailures[user.account]?.count || 0),
      lockedUntil: Number(loginFailures[user.account]?.lockedUntil || 0)
    })),
    channels: channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      description: channel.description || "",
      announcement: channel.announcement || "",
      joined: Boolean(channel.joined),
      memberCount: channel.members.length,
      unreadCount: 0
    })),
    audits: sqliteAudits("all").slice(0, 30),
    networkPolicy,
    securityPolicy,
    uploadPolicy
  };
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function directorySize(directoryPath) {
  if (!fs.existsSync(directoryPath)) return 0;
  return fs.readdirSync(directoryPath).reduce((total, name) => {
    const currentPath = path.join(directoryPath, name);
    const stat = fs.statSync(currentPath);
    return total + (stat.isDirectory() ? directorySize(currentPath) : stat.size);
  }, 0);
}

function runtimeMetrics() {
  pruneExpiredSessions();
  const activeSessionCount = Object.keys(sessions).length;
  return {
    service: "bee-chat",
    status: "UP",
    storage: DB_PROVIDER === "sqlite" ? "sqlite+json" : DB_PROVIDER,
    database: databaseRuntimeConfig(),
    startedAt: STARTED_AT.toISOString(),
    uptimeSeconds: Math.floor((Date.now() - STARTED_AT.getTime()) / 1000),
    process: {
      pid: process.pid,
      node: process.version,
      memory: process.memoryUsage()
    },
    realtime: {
      clients: realtimeClients.size
    },
    sessions: {
      active: activeSessionCount
    },
    data: {
      sqliteBytes: fileSize(DB_FILE),
      snapshotBytes: fileSize(DATA_FILE),
      uploadsBytes: directorySize(UPLOAD_DIR),
      logBytes: fileSize(LOG_FILE)
    },
    counts: {
      users: users.length,
      onlineUsers: publicUsers().filter((user) => user.online).length,
      channels: channels.length,
      messages: messages.length,
      audits: audits.length,
      files: messages.filter((message) => Boolean(message.file)).length
    },
    migrations: migrationStatus(),
    time: new Date().toISOString()
  };
}

function sqliteFileMessage(storedName) {
  const row = db.prepare(`
    SELECT m.* FROM messages m
    JOIN files f ON f.message_id = m.id
    WHERE f.stored_name = ?
  `).get(storedName);
  return sqliteMessageFromRow(row);
}

function websocketFrame(payload) {
  const body = Buffer.from(JSON.stringify(payload));
  if (body.length < 126) {
    return Buffer.concat([Buffer.from([0x81, body.length]), body]);
  }
  if (body.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
    return Buffer.concat([header, body]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(body.length), 2);
  return Buffer.concat([header, body]);
}

function sendRealtime(socket, payload) {
  if (socket.destroyed) return;
  socket.write(websocketFrame(payload));
}

function broadcastRealtime(event, payload = {}, targetUserIds = null) {
  const recipients = targetUserIds ? new Set(targetUserIds.map((item) => Number(item))) : null;
  realtimeClients.forEach((client) => {
    if (recipients && !recipients.has(client.user.id)) return;
    sendRealtime(client.socket, { event, payload, time: new Date().toISOString() });
  });
}

function broadcastPresence() {
  broadcastRealtime("presence:updated", { users: publicUsers() });
}

function channelMemberIds(channelId) {
  const channel = channels.find((item) => item.id === Number(channelId));
  return channel ? channel.members : users.map((user) => user.id);
}

function isChannelMember(channel, userId) {
  return Boolean(channel && channel.members.includes(Number(userId)));
}

function canAccessMessageFile(message, user) {
  if (!message || !user) return false;
  if (message.messageType === "DIRECT") {
    return message.senderId === user.id || message.receiverId === user.id;
  }
  const channel = channels.find((item) => item.id === Number(message.channelId));
  return isChannelMember(channel, user.id);
}

function canAccessMessage(message, user) {
  if (!message || !user) return false;
  if (message.messageType === "DIRECT") {
    return message.senderId === user.id || message.receiverId === user.id;
  }
  const channel = channels.find((item) => item.id === Number(message.channelId));
  return isChannelMember(channel, user.id);
}

function normalizeMessageEnhancement(message) {
  if (!Array.isArray(message.favoriteUserIds)) message.favoriteUserIds = [];
  if (!message.reactions || typeof message.reactions !== "object" || Array.isArray(message.reactions)) message.reactions = {};
  if (!Array.isArray(message.mentionUserIds)) message.mentionUserIds = [];
}

function handleRealtimeUpgrade(request, socket) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname !== "/api/realtime") {
    socket.destroy();
    return;
  }
  const user = findUserByToken(url.searchParams.get("token"));
  if (!user) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  const key = request.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "\r\n"
  ].join("\r\n"));
  const clientId = crypto.randomBytes(12).toString("hex");
  realtimeClients.set(clientId, { socket, user: publicUser(user) });
  sendRealtime(socket, { event: "connected", payload: { userId: user.id }, time: new Date().toISOString() });
  broadcastPresence();
  function releaseClient() {
    if (!realtimeClients.has(clientId)) return;
    realtimeClients.delete(clientId);
    broadcastPresence();
  }
  socket.on("data", (chunk) => {
    if (chunk[0] === 0x88) socket.end();
    if (chunk[0] === 0x89) socket.write(Buffer.from([0x8a, 0x00]));
  });
  socket.on("close", releaseClient);
  socket.on("error", releaseClient);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error("请求体过大"));
    });
    request.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("请求 JSON 格式错误"));
      }
    });
  });
}

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_RAW_UPLOAD_BYTES) {
        reject(new Error("上传文件过大"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function parseMultipart(request, body) {
  const contentType = request.headers["content-type"] || "";
  const match = contentType.match(/boundary=(.+)$/);
  if (!match) throw new Error("上传请求格式错误");
  const boundary = `--${match[1]}`;
  const segments = body.toString("binary").split(boundary).slice(1, -1);
  const fields = {};
  const files = {};

  segments.forEach((segment) => {
    const trimmed = segment.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const splitIndex = trimmed.indexOf("\r\n\r\n");
    if (splitIndex < 0) return;
    const rawHeaders = trimmed.slice(0, splitIndex);
    const rawContent = trimmed.slice(splitIndex + 4);
    const disposition = rawHeaders.match(/name="([^"]+)"(?:; filename="([^"]*)")?/);
    if (!disposition) return;
    const name = disposition[1];
    const filename = disposition[2];
    const content = Buffer.from(rawContent, "binary");
    if (filename) {
      files[name] = { filename, content };
    } else {
      fields[name] = content.toString("utf8");
    }
  });

  return { fields, files };
}

function publishAudit(action, targetId, operator) {
  const audit = {
    id: audits.length + 1,
    module: "BeeChat",
    action,
    targetId,
    operator: operator || "system",
    success: true,
    createdAt: new Date().toISOString()
  };
  audits.unshift(audit);
  writeLog("INFO", "audit.recorded", audit);
  saveStore();
}

function hasSensitiveWord(content) {
  return ["客户", "合同", "报价", "身份证", "手机号"].some((word) => content.includes(word));
}

function unreadBucket(userId) {
  const key = String(userId);
  if (!unreadState[key]) {
    unreadState[key] = { channels: {}, direct: {}, mentions: {} };
  }
  if (!unreadState[key].channels) unreadState[key].channels = {};
  if (!unreadState[key].direct) unreadState[key].direct = {};
  if (!unreadState[key].mentions) unreadState[key].mentions = {};
  return unreadState[key];
}

function addUnread(userId, type, targetId) {
  const bucket = unreadBucket(userId);
  const group = type === "direct" ? bucket.direct : bucket.channels;
  const key = String(targetId);
  group[key] = (Number(group[key]) || 0) + 1;
}

function addMentionUnread(userId, channelId) {
  const bucket = unreadBucket(userId);
  const key = String(channelId);
  bucket.mentions[key] = (Number(bucket.mentions[key]) || 0) + 1;
}

function markRead(userId, type, targetId) {
  const bucket = unreadBucket(userId);
  const group = type === "direct" ? bucket.direct : bucket.channels;
  group[String(targetId)] = 0;
  if (type === "channel") bucket.mentions[String(targetId)] = 0;
}

function workspace(user) {
  const bucket = user ? unreadBucket(user.id) : { channels: {}, direct: {}, mentions: {} };
  return {
    name: "BeeChat",
    securityMode: "内网安全模式",
    channels: channels.map((channel) => ({
      ...channel,
      memberCount: channel.members.length,
      unreadCount: Number(bucket.channels[String(channel.id)]) || 0,
      mentionCount: Number(bucket.mentions[String(channel.id)]) || 0
    })),
    users: publicUsers(),
    directUnreadCounts: bucket.direct
  };
}

function mentionedUserIds(content, senderId) {
  const matched = new Set();
  users.forEach((user) => {
    if (user.id === senderId) return;
    const names = [user.name, user.account, user.avatarText].filter(Boolean);
    if (names.some((name) => content.includes(`@${name}`))) matched.add(user.id);
  });
  return [...matched];
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions[token] = {
    userId: user.id,
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  saveStore();
  return token;
}

function revokeUserSessions(userId) {
  Object.entries(sessions).forEach(([token, session]) => {
    if (Number(session.userId) === Number(userId)) delete sessions[token];
  });
}

function pruneExpiredSessions() {
  const now = Date.now();
  Object.entries(sessions).forEach(([token, session]) => {
    if (!session || Number(session.expiresAt) <= now) {
      delete sessions[token];
    }
  });
}

function findUserByToken(token) {
  pruneExpiredSessions();
  const session = sessions[String(token || "")];
  if (!session) return null;
  return users.find((item) => item.id === Number(session.userId)) || null;
}

function tokenFromRequest(request) {
  const header = request.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  const url = new URL(request.url, `http://${request.headers.host}`);
  return url.searchParams.get("token") || "";
}

function currentUser(request) {
  return findUserByToken(tokenFromRequest(request));
}

function requireUser(request, response) {
  const user = currentUser(request);
  if (!user) {
    sendJson(response, 401, { message: "登录已失效，请重新登录" });
    return null;
  }
  return user;
}

function requireAdmin(request, response) {
  const user = requireUser(request, response);
  if (!user) return null;
  if (user.role !== "ADMIN") {
    sendJson(response, 403, { message: "仅管理员允许执行此操作" });
    return null;
  }
  return user;
}

function requireAuditAccess(request, response) {
  const user = requireUser(request, response);
  if (!user) return null;
  if (!["ADMIN", "AUDITOR"].includes(user.role)) {
    sendJson(response, 403, { message: "仅管理员或审计员允许查看审计" });
    return null;
  }
  return user;
}

function requireChannelManager(request, response, channel) {
  const user = requireUser(request, response);
  if (!user) return null;
  if (user.role === "ADMIN") return user;
  if (user.role === "CHANNEL_ADMIN" && isChannelMember(channel, user.id)) return user;
  sendJson(response, 403, { message: "仅管理员或频道管理员允许执行此操作" });
  return null;
}

function publicMessage(message) {
  if (!message.revoked) return message;
  return {
    ...message,
    content: "消息已撤回",
    sensitive: false
  };
}

function isDirectMessageFor(message, userId, peerId) {
  return message.messageType === "DIRECT" && (
    (message.senderId === userId && message.receiverId === peerId) ||
    (message.senderId === peerId && message.receiverId === userId)
  );
}

async function routeApi(request, response, url) {
  if (request.method === "OPTIONS") return sendJson(response, 200, true);
  if (!isIpAllowed(request)) return sendJson(response, 403, { message: "当前 IP 不在访问白名单内" });

  if (request.method === "GET" && url.pathname === "/api/health") {
    const metrics = runtimeMetrics();
    return sendJson(response, 200, {
      service: metrics.service,
      status: metrics.status,
      storage: metrics.storage,
      database: metrics.database,
      startedAt: metrics.startedAt,
      uptimeSeconds: metrics.uptimeSeconds,
      migrations: metrics.migrations,
      time: metrics.time
    });
  }

  if (request.method === "GET" && url.pathname === "/api/metrics") {
    const user = requireAuditAccess(request, response);
    if (!user) return;
    return sendJson(response, 200, runtimeMetrics());
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(request);
    const user = users.find((item) => item.account === body.account);
    if (isAccountLocked(body.account)) {
      return sendJson(response, 423, { message: "账号已被临时锁定，请稍后再试" });
    }
    if (!user || user.passwordHash !== hashPassword(body.password || "")) {
      recordLoginFailure(body.account);
      return sendJson(response, 401, { message: "账号或密码错误" });
    }
    if (user.disabled) {
      return sendJson(response, 403, { message: "账号已停用，请联系管理员" });
    }
    clearLoginFailure(user.account);
    const token = createSession(user);
    publishAudit("用户登录", String(user.id), user.account);
    broadcastPresence();
    return sendJson(response, 200, { token, user: publicUser(user), expiresAt: sessions[token].expiresAt, workspace: workspace(user) });
  }

  if (request.method === "POST" && url.pathname === "/api/logout") {
    const token = tokenFromRequest(request);
    const user = findUserByToken(token);
    if (token && sessions[token]) {
      delete sessions[token];
      saveStore();
    }
    if (user) publishAudit("用户登出", String(user.id), user.account);
    broadcastPresence();
    return sendJson(response, 200, { loggedOut: true });
  }

  if (request.method === "GET" && url.pathname === "/api/session") {
    const user = findUserByToken(tokenFromRequest(request));
    if (!user) return sendJson(response, 401, { message: "登录已失效，请重新登录" });
    return sendJson(response, 200, { token: tokenFromRequest(request), user: publicUser(user), workspace: workspace(user) });
  }

  if (request.method === "GET" && url.pathname === "/api/settings") {
    const user = requireUser(request, response);
    if (!user) return;
    return sendJson(response, 200, settingsFor(user));
  }

  if (request.method === "PUT" && url.pathname === "/api/settings") {
    const user = requireUser(request, response);
    if (!user) return;
    const body = await readBody(request);
    const displayName = String(body.displayName || "").trim();
    if (!displayName) return sendJson(response, 400, { message: "显示名称不能为空" });
    if (displayName.length > 24) return sendJson(response, 400, { message: "显示名称不能超过 24 个字符" });
    const bio = String(body.bio || "").trim();
    if (bio.length > 80) return sendJson(response, 400, { message: "个人简介不能超过 80 个字符" });
    const nextSettings = {
      displayName,
      bio,
      emailDigest: Boolean(body.emailDigest),
      desktopNotify: Boolean(body.desktopNotify),
      soundNotify: Boolean(body.soundNotify),
      compactMode: Boolean(body.compactMode)
    };
    userSettings[String(user.id)] = nextSettings;
    user.name = displayName;
    publishAudit("更新个人设置", String(user.id), user.account);
    saveStore();
    return sendJson(response, 200, { settings: settingsFor(user), user: publicUser(user), workspace: workspace(user) });
  }

  if (request.method === "GET" && url.pathname === "/api/workspace") {
    return sendJson(response, 200, workspace(currentUser(request)));
  }

  if (request.method === "GET" && url.pathname === "/api/admin/overview") {
    const user = requireAdmin(request, response);
    if (!user) return;
    publishAudit("查看管理后台", "overview", user.account);
    return sendJson(response, 200, adminOverview());
  }

  const adminUserMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)$/);
  if (request.method === "PUT" && adminUserMatch) {
    const user = requireAdmin(request, response);
    if (!user) return;
    const target = users.find((item) => item.id === Number(adminUserMatch[1]));
    if (!target) return sendJson(response, 404, { message: "用户不存在" });
    const body = await readBody(request);
    const role = USER_ROLES.has(body.role) ? body.role : "USER";
    const disabled = Boolean(body.disabled);
    if (target.id === user.id && (role !== "ADMIN" || disabled)) {
      return sendJson(response, 400, { message: "不能降低或停用当前管理员账号" });
    }
    target.role = role;
    target.disabled = disabled;
    userAdminState[String(target.id)] = { role, disabled };
    if (disabled) revokeUserSessions(target.id);
    publishAudit("更新用户权限", String(target.id), user.account);
    saveStore();
    broadcastPresence();
    return sendJson(response, 200, adminOverview());
  }

  if (request.method === "PUT" && url.pathname === "/api/admin/security-policy") {
    const user = requireAdmin(request, response);
    if (!user) return;
    const body = await readBody(request);
    const nextPolicy = {
      maxLoginFailures: Math.min(Math.max(Number(body.maxLoginFailures) || 5, 3), 10),
      lockMinutes: Math.min(Math.max(Number(body.lockMinutes) || 15, 1), 1440),
      minPasswordLength: Math.min(Math.max(Number(body.minPasswordLength) || 6, 6), 32),
      requireNumber: Boolean(body.requireNumber)
    };
    securityPolicy = nextPolicy;
    publishAudit("更新安全策略", "security-policy", user.account);
    saveStore();
    return sendJson(response, 200, adminOverview());
  }

  if (request.method === "PUT" && url.pathname === "/api/admin/upload-policy") {
    const user = requireAdmin(request, response);
    if (!user) return;
    const body = await readBody(request);
    uploadPolicy = normalizedUploadPolicy(body);
    publishAudit("更新文件策略", "upload-policy", user.account);
    saveStore();
    return sendJson(response, 200, adminOverview());
  }

  if (request.method === "PUT" && url.pathname === "/api/admin/network-policy") {
    const user = requireAdmin(request, response);
    if (!user) return;
    const body = await readBody(request);
    const nextPolicy = normalizedNetworkPolicy(body);
    const currentIp = clientIp(request);
    if (nextPolicy.enabled && !nextPolicy.allowedIps.map((item) => normalizeIp(item)).includes(currentIp)) {
      return sendJson(response, 400, { message: `白名单必须包含当前 IP：${currentIp}` });
    }
    networkPolicy = nextPolicy;
    publishAudit("更新网络策略", "network-policy", user.account);
    saveStore();
    return sendJson(response, 200, adminOverview());
  }

  if (request.method === "GET" && url.pathname === "/api/admin/audits/export") {
    const user = requireAuditAccess(request, response);
    if (!user) return;
    publishAudit("导出审计日志", "audits", user.account);
    const rows = [
      "ID,模块,操作,目标,操作者,结果,时间",
      ...readRepository().audits("all").map((audit) => [
        audit.id,
        audit.module,
        audit.action,
        audit.targetId,
        audit.operator,
        audit.success ? "成功" : "失败",
        audit.createdAt
      ].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    ];
    return sendCsv(response, `beechat-audits-${Date.now()}.csv`, rows);
  }

  const adminChannelMatch = url.pathname.match(/^\/api\/admin\/channels\/(\d+)$/);
  if (request.method === "PUT" && adminChannelMatch) {
    const channel = channels.find((item) => item.id === Number(adminChannelMatch[1]));
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    const user = requireChannelManager(request, response, channel);
    if (!user) return;
    const body = await readBody(request);
    const description = String(body.description || "").trim();
    const announcement = String(body.announcement || "").trim();
    if (!description) return sendJson(response, 400, { message: "频道说明不能为空" });
    if (description.length > 80) return sendJson(response, 400, { message: "频道说明不能超过 80 个字符" });
    if (announcement.length > 160) return sendJson(response, 400, { message: "频道公告不能超过 160 个字符" });
    channel.description = description;
    channel.announcement = announcement;
    publishAudit("更新频道说明", String(channel.id), user.account);
    if (announcement) publishAudit("更新频道公告", String(channel.id), user.account);
    saveStore();
    broadcastRealtime("channel:updated", { channel }, channel.members);
    return sendJson(response, 200, channel);
  }

  const memberMatch = url.pathname.match(/^\/api\/channels\/(\d+)\/members$/);
  if (request.method === "GET" && memberMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const channel = readRepository().channelById(Number(memberMatch[1]));
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    if (!isChannelMember(channel, user.id)) return sendJson(response, 403, { message: "非频道成员不可查看成员" });
    const members = readRepository().channelMembers(channel.id);
    return sendJson(response, 200, members);
  }

  if (request.method === "POST" && memberMatch) {
    const channel = channels.find((item) => item.id === Number(memberMatch[1]));
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    const user = requireChannelManager(request, response, channel);
    if (!user) return;
    const body = await readBody(request);
    const member = users.find((item) => item.id === Number(body.userId));
    if (!member) return sendJson(response, 404, { message: "用户不存在" });
    if (!channel.members.includes(member.id)) {
      channel.members.push(member.id);
      channel.memberCount = channel.members.length;
      publishAudit("邀请频道成员", `${channel.id}:${member.id}`, user.account);
      saveStore();
      broadcastRealtime("members:changed", { channelId: channel.id }, channel.members);
    }
    return sendJson(response, 200, channel);
  }

  const removeMemberMatch = url.pathname.match(/^\/api\/channels\/(\d+)\/members\/(\d+)$/);
  if (request.method === "DELETE" && removeMemberMatch) {
    const channel = channels.find((item) => item.id === Number(removeMemberMatch[1]));
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    const user = requireChannelManager(request, response, channel);
    if (!user) return;
    const memberId = Number(removeMemberMatch[2]);
    if (memberId === user.id) return sendJson(response, 400, { message: "不能移除自己" });
    channel.members = channel.members.filter((item) => item !== memberId);
    channel.memberCount = channel.members.length;
    publishAudit("移除频道成员", `${channel.id}:${memberId}`, user.account);
    saveStore();
    broadcastRealtime("members:changed", { channelId: channel.id }, [...channel.members, memberId]);
    return sendJson(response, 200, channel);
  }

  const messageMatch = url.pathname.match(/^\/api\/channels\/(\d+)\/messages$/);
  if (request.method === "GET" && messageMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const channelId = Number(messageMatch[1]);
    const parentId = url.searchParams.get("parentId");
    const beforeId = Number(url.searchParams.get("beforeId")) || null;
    const pageSize = normalizePageSize(url.searchParams.get("pageSize"));
    const channel = readRepository().channelById(channelId);
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    if (!isChannelMember(channel, user.id)) return sendJson(response, 403, { message: "非频道成员不可读取消息" });
    if (user && !parentId && !beforeId) {
      markRead(user.id, "channel", channelId);
      saveStore();
    }
    const result = readRepository().channelMessages(channelId, parentId ? Number(parentId) : null, beforeId, pageSize);
    return sendJson(response, 200, result);
  }

  const directMatch = url.pathname.match(/^\/api\/direct\/(\d+)\/messages$/);
  if (request.method === "GET" && directMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const peerId = Number(directMatch[1]);
    const peer = users.find((item) => item.id === peerId);
    if (!peer || peer.id === user.id) return sendJson(response, 404, { message: "私信用户不存在" });
    const beforeId = Number(url.searchParams.get("beforeId")) || null;
    const pageSize = normalizePageSize(url.searchParams.get("pageSize"));
    if (!beforeId) {
      markRead(user.id, "direct", peerId);
      saveStore();
    }
    const result = readRepository().directMessages(user.id, peerId, beforeId, pageSize);
    return sendJson(response, 200, result);
  }

  const channelFilesMatch = url.pathname.match(/^\/api\/channels\/(\d+)\/files$/);
  if (request.method === "GET" && channelFilesMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const channelId = Number(channelFilesMatch[1]);
    const channel = readRepository().channelById(channelId);
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    if (!isChannelMember(channel, user.id)) return sendJson(response, 403, { message: "非频道成员不可查看文件" });
    return sendJson(response, 200, readRepository().channelFiles(channelId));
  }

  if (request.method === "POST" && url.pathname === "/api/messages") {
    const body = await readBody(request);
    const loginUser = currentUser(request);
    const sender = loginUser || users.find((item) => item.id === Number(body.senderId));
    if (!sender) return sendJson(response, 400, { message: "发送人不存在" });
    const content = String(body.content || "").trim();
    if (!content) return sendJson(response, 400, { message: "消息内容不能为空" });
    const channel = channels.find((item) => item.id === Number(body.channelId));
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    if (!isChannelMember(channel, sender.id)) return sendJson(response, 403, { message: "非频道成员不可发送消息" });
    if (channel.name === "announcements" && sender.role !== "ADMIN") {
      return sendJson(response, 403, { message: "公告频道仅管理员允许发言" });
    }
    const parentId = body.parentId == null ? null : Number(body.parentId);
    const mentionUserIds = mentionedUserIds(content, sender.id).filter((userId) => channel.members.includes(userId));
    const message = readRepository().createChannelMessage({
      id: ++nextMessageId,
      channelId: Number(body.channelId),
      parentId,
      sender,
      content,
      sensitive: hasSensitiveWord(content),
      mentionUserIds,
      createdAt: new Date().toISOString()
    });
    users.filter((item) => item.id !== sender.id).forEach((item) => addUnread(item.id, "channel", message.channelId));
    mentionUserIds.forEach((userId) => addMentionUnread(userId, message.channelId));
    publishAudit(parentId ? "发送线程回复" : "发送频道消息", String(message.id), sender.account);
    saveStore();
    broadcastRealtime(parentId ? "message:thread" : "message:channel", { message: publicMessage(message) }, channelMemberIds(message.channelId));
    return sendJson(response, 200, message);
  }

  const editMatch = url.pathname.match(/^\/api\/messages\/(\d+)$/);
  if (request.method === "PUT" && editMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const message = messages.find((item) => item.id === Number(editMatch[1]));
    if (!message) return sendJson(response, 404, { message: "消息不存在" });
    if (message.senderId !== user.id) return sendJson(response, 403, { message: "只能编辑自己发送的消息" });
    if (message.revoked) return sendJson(response, 400, { message: "已撤回消息不能编辑" });
    const body = await readBody(request);
    const content = String(body.content || "").trim();
    if (!content) return sendJson(response, 400, { message: "消息内容不能为空" });
    const updatedMessage = readRepository().updateMessageContent(message.id, {
      content,
      sensitive: hasSensitiveWord(content),
      editedAt: new Date().toISOString()
    });
    if (!updatedMessage) return sendJson(response, 404, { message: "消息不存在" });
    publishAudit("编辑消息", String(updatedMessage.id), user.account);
    saveStore();
    const targets = updatedMessage.messageType === "DIRECT" ? [updatedMessage.senderId, updatedMessage.receiverId] : channelMemberIds(updatedMessage.channelId);
    broadcastRealtime("message:edited", { message: publicMessage(updatedMessage) }, targets);
    return sendJson(response, 200, publicMessage(updatedMessage));
  }

  const pinMatch = url.pathname.match(/^\/api\/messages\/(\d+)\/pin$/);
  if (request.method === "POST" && pinMatch) {
    const message = messages.find((item) => item.id === Number(pinMatch[1]));
    if (!message) return sendJson(response, 404, { message: "消息不存在" });
    if (message.messageType === "DIRECT") return sendJson(response, 400, { message: "私信暂不支持置顶" });
    if (message.revoked) return sendJson(response, 400, { message: "已撤回消息不能置顶" });
    const channel = channels.find((item) => item.id === Number(message.channelId));
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    const user = requireChannelManager(request, response, channel);
    if (!user) return;
    const body = await readBody(request);
    message.pinned = Boolean(body.pinned);
    publishAudit(message.pinned ? "置顶消息" : "取消置顶消息", String(message.id), user.account);
    saveStore();
    const targets = channelMemberIds(message.channelId);
    broadcastRealtime("message:pinned", { message: publicMessage(message) }, targets);
    return sendJson(response, 200, publicMessage(message));
  }

  const favoriteMatch = url.pathname.match(/^\/api\/messages\/(\d+)\/favorite$/);
  if (request.method === "POST" && favoriteMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const message = messages.find((item) => item.id === Number(favoriteMatch[1]));
    if (!message) return sendJson(response, 404, { message: "消息不存在" });
    if (message.revoked) return sendJson(response, 400, { message: "已撤回消息不能收藏" });
    if (!canAccessMessage(message, user)) return sendJson(response, 403, { message: "无权操作该消息" });
    const body = await readBody(request);
    normalizeMessageEnhancement(message);
    const favorited = Boolean(body.favorited);
    message.favoriteUserIds = favorited
      ? [...new Set([...message.favoriteUserIds, user.id])]
      : message.favoriteUserIds.filter((item) => item !== user.id);
    publishAudit(favorited ? "收藏消息" : "取消收藏消息", String(message.id), user.account);
    saveStore();
    const targets = message.messageType === "DIRECT" ? [message.senderId, message.receiverId] : channelMemberIds(message.channelId);
    broadcastRealtime("message:favorite", { message: publicMessage(message) }, targets);
    return sendJson(response, 200, publicMessage(message));
  }

  const reactionMatch = url.pathname.match(/^\/api\/messages\/(\d+)\/reactions$/);
  if (request.method === "POST" && reactionMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const message = messages.find((item) => item.id === Number(reactionMatch[1]));
    if (!message) return sendJson(response, 404, { message: "消息不存在" });
    if (message.revoked) return sendJson(response, 400, { message: "已撤回消息不能回应" });
    if (!canAccessMessage(message, user)) return sendJson(response, 403, { message: "无权操作该消息" });
    const body = await readBody(request);
    const emoji = String(body.emoji || "").trim();
    if (!MESSAGE_REACTIONS.has(emoji)) return sendJson(response, 400, { message: "不支持的表情回应" });
    normalizeMessageEnhancement(message);
    const reacted = Boolean(body.reacted);
    const current = Array.isArray(message.reactions[emoji]) ? message.reactions[emoji] : [];
    message.reactions[emoji] = reacted
      ? [...new Set([...current, user.id])]
      : current.filter((item) => item !== user.id);
    if (!message.reactions[emoji].length) delete message.reactions[emoji];
    publishAudit(reacted ? "回应消息" : "取消回应消息", `${message.id}:${emoji}`, user.account);
    saveStore();
    const targets = message.messageType === "DIRECT" ? [message.senderId, message.receiverId] : channelMemberIds(message.channelId);
    broadcastRealtime("message:reaction", { message: publicMessage(message) }, targets);
    return sendJson(response, 200, publicMessage(message));
  }

  if (request.method === "POST" && url.pathname === "/api/direct/messages") {
    const user = requireUser(request, response);
    if (!user) return;
    const body = await readBody(request);
    const receiver = users.find((item) => item.id === Number(body.receiverId));
    if (!receiver || receiver.id === user.id) return sendJson(response, 400, { message: "接收人不存在" });
    const content = String(body.content || "").trim();
    if (!content) return sendJson(response, 400, { message: "消息内容不能为空" });
    const message = readRepository().createDirectMessage({
      id: ++nextMessageId,
      sender: user,
      receiver,
      content,
      sensitive: hasSensitiveWord(content),
      createdAt: new Date().toISOString()
    });
    addUnread(receiver.id, "direct", user.id);
    publishAudit("发送私信", String(message.id), user.account);
    saveStore();
    broadcastRealtime("message:direct", { message }, [user.id, receiver.id]);
    return sendJson(response, 200, message);
  }

  if (request.method === "POST" && url.pathname === "/api/files") {
    const user = requireUser(request, response);
    if (!user) return;
    const body = await readRawBody(request);
    const { fields, files } = parseMultipart(request, body);
    const upload = files.file;
    if (!upload) return sendJson(response, 400, { message: "未选择上传文件" });
    const maxUploadBytes = Number(uploadPolicy.maxFileSizeMb || 5) * 1024 * 1024;
    if (upload.content.length > maxUploadBytes) return sendJson(response, 400, { message: `文件大小不能超过 ${uploadPolicy.maxFileSizeMb}MB` });
    const originalName = path.basename(upload.filename || "attachment.bin");
    const ext = path.extname(originalName).toLowerCase();
    if (!new Set(uploadPolicy.allowedExtensions || []).has(ext)) return sendJson(response, 400, { message: "文件类型不允许上传" });
    const safeName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(filePath, upload.content);
    const channelId = Number(fields.channelId);
    const receiverId = Number(fields.receiverId);
    const receiver = receiverId ? users.find((item) => item.id === receiverId) : null;
    const channel = channelId ? channels.find((item) => item.id === channelId) : null;
    if (!receiver && !channel) return sendJson(response, 400, { message: "上传目标不存在" });
    if (channel && !isChannelMember(channel, user.id)) return sendJson(response, 403, { message: "非频道成员不可上传文件" });
    const message = {
      id: ++nextMessageId,
      channelId: channel ? channel.id : null,
      parentId: null,
      senderId: user.id,
      receiverId: receiver ? receiver.id : null,
      senderName: user.name,
      avatarText: user.avatarText,
      avatarColor: user.avatarColor,
      content: `上传文件：${originalName}`,
      sensitive: hasSensitiveWord(originalName),
      deliveryStatus: "文件已上传",
      replyCount: 0,
      pinned: false,
      favoriteUserIds: [],
      reactions: {},
      mentionUserIds: [],
      messageType: receiver ? "DIRECT" : "CHANNEL",
      file: {
        originalName,
        storedName: safeName,
        size: upload.content.length,
        path: `/api/files/${safeName}`
      },
      createdAt: new Date().toISOString()
    };
    messages.push(message);
    if (receiver) {
      addUnread(receiver.id, "direct", user.id);
    } else {
      users.filter((item) => item.id !== user.id).forEach((item) => addUnread(item.id, "channel", channel.id));
    }
    publishAudit("上传文件", String(message.id), user.account);
    saveStore();
    broadcastRealtime("file:uploaded", { message }, receiver ? [user.id, receiver.id] : channelMemberIds(channel.id));
    return sendJson(response, 200, message);
  }

  const downloadMatch = url.pathname.match(/^\/api\/files\/([^/]+)$/);
  if (request.method === "GET" && downloadMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const storedName = path.basename(downloadMatch[1]);
    const fileMessage = sqliteFileMessage(storedName);
    if (!fileMessage) return sendJson(response, 404, { message: "文件不存在" });
    if (!canAccessMessageFile(fileMessage, user)) return sendJson(response, 403, { message: "无权下载该文件" });
    const filePath = path.join(UPLOAD_DIR, storedName);
    if (!fs.existsSync(filePath)) return sendJson(response, 404, { message: "文件不存在" });
    publishAudit("下载文件", String(fileMessage.id), user.account);
    response.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileMessage.file.originalName)}`
    });
    fs.createReadStream(filePath).pipe(response);
    return;
  }

  const revokeMatch = url.pathname.match(/^\/api\/messages\/(\d+)\/revoke$/);
  if (request.method === "POST" && revokeMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const message = messages.find((item) => item.id === Number(revokeMatch[1]));
    if (!message) return sendJson(response, 404, { message: "消息不存在" });
    if (message.senderId !== user.id) return sendJson(response, 403, { message: "只能撤回自己发送的消息" });
    if (message.revoked) return sendJson(response, 400, { message: "消息已撤回" });
    const revokedMessage = readRepository().revokeMessage(message.id, {
      revokedAt: new Date().toISOString()
    });
    if (!revokedMessage) return sendJson(response, 404, { message: "消息不存在" });
    publishAudit("撤回消息", String(revokedMessage.id), user.account);
    saveStore();
    const targets = revokedMessage.messageType === "DIRECT" ? [revokedMessage.senderId, revokedMessage.receiverId] : channelMemberIds(revokedMessage.channelId);
    broadcastRealtime("message:revoked", { message: publicMessage(revokedMessage) }, targets);
    return sendJson(response, 200, publicMessage(revokedMessage));
  }

  if (request.method === "GET" && url.pathname === "/api/search") {
    const user = requireUser(request, response);
    if (!user) return;
    const keyword = String(url.searchParams.get("q") || "").trim().toLowerCase();
    if (!keyword) return sendJson(response, 200, []);
    const result = messages
      .filter((item) => !item.revoked && String(item.content || "").toLowerCase().includes(keyword))
      .filter((item) => {
        if (item.messageType === "DIRECT") return item.senderId === user.id || item.receiverId === user.id;
        const channel = channels.find((channelItem) => channelItem.id === Number(item.channelId));
        return isChannelMember(channel, user.id);
      })
      .slice(-30)
      .reverse()
      .map((item) => {
        const channel = item.channelId ? channels.find((channelItem) => channelItem.id === item.channelId) : null;
        const peerId = item.messageType === "DIRECT" ? (item.senderId === user.id ? item.receiverId : item.senderId) : null;
        const peer = peerId ? users.find((userItem) => userItem.id === peerId) : null;
        return {
          id: item.id,
          messageType: item.messageType,
          channelId: item.channelId,
          peerId,
          title: item.messageType === "DIRECT" ? `私信 · ${peer ? peer.name : "未知用户"}` : `# ${channel ? channel.name : "未知频道"}`,
          senderName: item.senderName,
          content: item.content,
          createdAt: item.createdAt
        };
      });
    publishAudit("搜索消息", keyword, user.account);
    return sendJson(response, 200, result);
  }

  if (request.method === "POST" && url.pathname === "/api/channels") {
    const user = requireAdmin(request, response);
    if (!user) return;
    const body = await readBody(request);
    const name = String(body.name || "").trim().replace("#", "").toLowerCase();
    if (!name) return sendJson(response, 400, { message: "频道名称不能为空" });
    if (channels.some((item) => item.name === name)) return sendJson(response, 400, { message: "频道已存在" });
    const channel = { id: ++nextChannelId, name, description: body.description || "企业内部协作频道", announcement: "", joined: true, members: [user.id], memberCount: 1, unreadCount: 0, mentionCount: 0 };
    channels.push(channel);
    publishAudit("创建频道", String(channel.id), user.account);
    saveStore();
    broadcastRealtime("channel:created", { channel }, [user.id]);
    return sendJson(response, 200, channel);
  }

  const joinMatch = url.pathname.match(/^\/api\/channels\/(\d+)\/join$/);
  if (request.method === "POST" && joinMatch) {
    const channel = channels.find((item) => item.id === Number(joinMatch[1]));
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    channel.joined = true;
    publishAudit("加入频道", String(channel.id), "system");
    saveStore();
    return sendJson(response, 200, channel);
  }

  if (request.method === "GET" && url.pathname === "/api/audits") {
    const user = requireAuditAccess(request, response);
    if (!user) return;
    const type = String(url.searchParams.get("type") || "all");
    const result = readRepository().audits(type, {
      from: url.searchParams.get("from") || "",
      keyword: url.searchParams.get("q") || "",
      operator: url.searchParams.get("operator") || "",
      to: url.searchParams.get("to") || ""
    });
    return sendJson(response, 200, result);
  }

  return sendJson(response, 404, { message: "接口不存在" });
}

function publicDir() {
  return fs.existsSync(path.join(FRONTEND_PUBLIC_DIR, "index.html")) ? FRONTEND_PUBLIC_DIR : LEGACY_PUBLIC_DIR;
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json" || ext === ".map") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "text/html; charset=utf-8";
}

function serveStatic(response, pathname) {
  const staticRoot = publicDir();
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(staticRoot, safePath));
  const relativePath = path.relative(staticRoot, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (!path.extname(safePath)) {
        const indexPath = path.join(staticRoot, "index.html");
        fs.readFile(indexPath, (indexError, indexContent) => {
          if (indexError) {
            response.writeHead(404);
            response.end("Not Found");
            return;
          }
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          response.end(indexContent);
        });
        return;
      }
      response.writeHead(404);
      response.end("Not Found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentType(filePath) });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const startedAt = Date.now();
  let statusCode = 200;
  const originalWriteHead = response.writeHead.bind(response);
  response.writeHead = (status, ...args) => {
    statusCode = Number(status) || statusCode;
    return originalWriteHead(status, ...args);
  };
  response.on("finish", () => {
    writeLog(statusCode >= 500 ? "ERROR" : "INFO", "http.request", {
      method: request.method,
      path: url.pathname,
      statusCode,
      durationMs: Date.now() - startedAt,
      ip: clientIp(request),
      userAgent: request.headers["user-agent"] || ""
    });
  });
  try {
    if (url.pathname.startsWith("/api/")) {
      await routeApi(request, response, url);
    } else {
      serveStatic(response, url.pathname);
    }
  } catch (error) {
    writeLog("ERROR", "http.error", {
      method: request.method,
      path: url.pathname,
      error
    });
    sendJson(response, 500, { message: error.message || "系统繁忙" });
  }
});

server.on("upgrade", handleRealtimeUpgrade);

validateDatabaseConfig();
loadStore();

server.listen(PORT, "127.0.0.1", () => {
  writeLog("INFO", "server.started", { port: PORT, url: `http://127.0.0.1:${PORT}` });
});
