const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 5188);
const PUBLIC_DIR = path.join(__dirname, "..", "web");
const DATA_DIR = path.join(__dirname, "..", "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const DB_FILE = path.join(DATA_DIR, "beechat.sqlite");
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTS = new Set([".txt", ".md", ".pdf", ".png", ".jpg", ".jpeg", ".csv", ".xlsx", ".docx"]);

const users = [
  { id: 1, account: "13677889001", name: "当前用户", role: "ADMIN", passwordHash: hashPassword("admin123"), avatarText: "我", avatarColor: "#4A9FD8", online: true },
  { id: 2, account: "zhangsan", name: "张三", role: "USER", passwordHash: hashPassword("123456"), avatarText: "张", avatarColor: "#E8924A", online: true },
  { id: 3, account: "lisi", name: "李四", role: "USER", passwordHash: hashPassword("123456"), avatarText: "李", avatarColor: "#5DADE2", online: true },
  { id: 4, account: "wangwu", name: "王五", role: "USER", passwordHash: hashPassword("123456"), avatarText: "王", avatarColor: "#58D68D", online: false }
];

const seedChannels = [
  { id: 1, name: "general", description: "日常协作与公告", joined: true, memberCount: 128, unreadCount: 0 },
  { id: 2, name: "engineering", description: "研发项目协作", joined: true, memberCount: 34, unreadCount: 3 },
  { id: 3, name: "sales", description: "客户与商机协作", joined: false, memberCount: 42, unreadCount: 0 },
  { id: 4, name: "announcements", description: "只读公告频道", joined: true, memberCount: 128, unreadCount: 0 }
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
let db = null;
const realtimeClients = new Map();
let nextMessageId = 1000;
let nextChannelId = 10;

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
    messageType: parentId ? "THREAD" : "CHANNEL",
    createdAt: new Date(time).toISOString()
  };
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify({ success: status < 400, code: status < 400 ? "OK" : "ERROR", message: status < 400 ? "处理成功" : data.message, data: status < 400 ? data : null }));
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(`beechat:${password}`).digest("hex");
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function publicUsers() {
  return users.map(publicUser);
}

function createDefaultStore() {
  return {
    channels: seedChannels.map((channel) => normalizeChannel(channel)),
    messages: seedMessages,
    audits: [],
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
  audits = Array.isArray(stored.audits) ? stored.audits : [];
  unreadState = stored.unreadState && typeof stored.unreadState === "object" ? stored.unreadState : {};
  sessions = stored.sessions && typeof stored.sessions === "object" ? stored.sessions : {};
  pruneExpiredSessions();
  nextMessageId = Math.max(1000, maxId(messages));
  nextChannelId = Math.max(10, maxId(channels));
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  pruneExpiredSessions();
  const snapshot = { channels, messages, audits, unreadState, sessions };
  fs.writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2));
  saveSqliteSnapshot(snapshot);
}

function initDatabase() {
  db = new DatabaseSync(DB_FILE);
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      account TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar_text TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      online INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      joined INTEGER NOT NULL,
      member_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS channel_members (
      channel_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY(channel_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      channel_id INTEGER,
      parent_id INTEGER,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER,
      message_type TEXT NOT NULL,
      content TEXT NOT NULL,
      sensitive INTEGER NOT NULL,
      delivery_status TEXT NOT NULL,
      reply_count INTEGER NOT NULL,
      revoked INTEGER NOT NULL,
      edited INTEGER NOT NULL,
      file_json TEXT,
      created_at TEXT NOT NULL,
      edited_at TEXT,
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS files (
      stored_name TEXT PRIMARY KEY,
      message_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audits (
      id INTEGER PRIMARY KEY,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      target_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      success INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS unread_state (
      user_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY(user_id, target_type, target_id)
    );
  `);
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
    users.forEach((user) => insertUser.run(user.id, user.account, user.name, user.role, user.avatarText, user.avatarColor, user.online ? 1 : 0));
    const insertSession = db.prepare("INSERT INTO sessions(token, user_id, expires_at) VALUES (?, ?, ?)");
    Object.entries(snapshot.sessions || {}).forEach(([token, session]) => insertSession.run(token, session.userId, session.expiresAt));
    const insertChannel = db.prepare("INSERT INTO channels(id, name, description, joined, member_count) VALUES (?, ?, ?, ?, ?)");
    const insertMember = db.prepare("INSERT INTO channel_members(channel_id, user_id) VALUES (?, ?)");
    snapshot.channels.forEach((channel) => {
      insertChannel.run(channel.id, channel.name, channel.description || "", channel.joined ? 1 : 0, channel.members.length);
      channel.members.forEach((userId) => insertMember.run(channel.id, userId));
    });
    const insertMessage = db.prepare(`
      INSERT INTO messages(id, channel_id, parent_id, sender_id, receiver_id, message_type, content, sensitive, delivery_status, reply_count, revoked, edited, file_json, created_at, edited_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    revoked: Boolean(row.revoked),
    edited: Boolean(row.edited),
    file: row.file_json ? JSON.parse(row.file_json) : undefined,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    revokedAt: row.revoked_at
  };
}

function sqliteChannel(channelId) {
  const row = db.prepare("SELECT id, name, description, joined, member_count FROM channels WHERE id = ?").get(channelId);
  if (!row) return null;
  const members = db.prepare("SELECT user_id FROM channel_members WHERE channel_id = ?").all(channelId).map((item) => item.user_id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    joined: Boolean(row.joined),
    memberCount: row.member_count,
    members,
    unreadCount: 0
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

function sqliteChannelMessages(channelId, parentId) {
  const rows = parentId
    ? db.prepare("SELECT * FROM messages WHERE channel_id = ? AND parent_id = ? AND message_type != 'DIRECT' ORDER BY id ASC").all(channelId, parentId)
    : db.prepare("SELECT * FROM messages WHERE channel_id = ? AND parent_id IS NULL AND message_type != 'DIRECT' ORDER BY id ASC").all(channelId);
  return rows.map(sqliteMessageFromRow).map(publicMessage);
}

function sqliteDirectMessages(userId, peerId) {
  return db.prepare(`
    SELECT * FROM messages
    WHERE message_type = 'DIRECT'
      AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
    ORDER BY id ASC
  `).all(userId, peerId, peerId, userId).map(sqliteMessageFromRow).map(publicMessage);
}

function sqliteAudits(type) {
  const rows = db.prepare("SELECT * FROM audits ORDER BY id DESC").all();
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
    if (type === "message") return ["发送频道消息", "发送线程回复", "发送私信", "编辑消息", "撤回消息"].includes(item.action);
    if (type === "file") return ["上传文件", "下载文件"].includes(item.action);
    if (type === "member") return ["邀请频道成员", "移除频道成员", "创建频道", "加入频道"].includes(item.action);
    if (type === "login") return item.action === "用户登录";
    return true;
  });
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
  socket.on("data", (chunk) => {
    if (chunk[0] === 0x88) socket.end();
    if (chunk[0] === 0x89) socket.write(Buffer.from([0x8a, 0x00]));
  });
  socket.on("close", () => realtimeClients.delete(clientId));
  socket.on("error", () => realtimeClients.delete(clientId));
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
      if (size > MAX_UPLOAD_BYTES + 1024 * 128) {
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
  audits.unshift({
    id: audits.length + 1,
    module: "BeeChat",
    action,
    targetId,
    operator: operator || "system",
    success: true,
    createdAt: new Date().toISOString()
  });
  saveStore();
}

function hasSensitiveWord(content) {
  return ["客户", "合同", "报价", "身份证", "手机号"].some((word) => content.includes(word));
}

function unreadBucket(userId) {
  const key = String(userId);
  if (!unreadState[key]) {
    unreadState[key] = { channels: {}, direct: {} };
  }
  if (!unreadState[key].channels) unreadState[key].channels = {};
  if (!unreadState[key].direct) unreadState[key].direct = {};
  return unreadState[key];
}

function addUnread(userId, type, targetId) {
  const bucket = unreadBucket(userId);
  const group = type === "direct" ? bucket.direct : bucket.channels;
  const key = String(targetId);
  group[key] = (Number(group[key]) || 0) + 1;
}

function markRead(userId, type, targetId) {
  const bucket = unreadBucket(userId);
  const group = type === "direct" ? bucket.direct : bucket.channels;
  group[String(targetId)] = 0;
}

function workspace(user) {
  const bucket = user ? unreadBucket(user.id) : { channels: {}, direct: {} };
  return {
    name: "BeeChat",
    securityMode: "内网安全模式",
    channels: channels.map((channel) => ({
      ...channel,
      memberCount: channel.members.length,
      unreadCount: Number(bucket.channels[String(channel.id)]) || 0
    })),
    users: publicUsers(),
    directUnreadCounts: bucket.direct
  };
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
  return header.startsWith("Bearer ") ? header.slice(7) : "";
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

  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, { service: "bee-chat", status: "UP", storage: "sqlite+json", time: new Date().toISOString() });
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(request);
    const user = users.find((item) => item.account === body.account);
    if (!user || user.passwordHash !== hashPassword(body.password || "")) {
      return sendJson(response, 401, { message: "账号或密码错误" });
    }
    const token = createSession(user);
    publishAudit("用户登录", String(user.id), user.account);
    return sendJson(response, 200, { token, user: publicUser(user), expiresAt: sessions[token].expiresAt, workspace: workspace(user) });
  }

  if (request.method === "GET" && url.pathname === "/api/session") {
    const user = findUserByToken(tokenFromRequest(request));
    if (!user) return sendJson(response, 401, { message: "登录已失效，请重新登录" });
    return sendJson(response, 200, { token: tokenFromRequest(request), user: publicUser(user), workspace: workspace(user) });
  }

  if (request.method === "GET" && url.pathname === "/api/workspace") {
    return sendJson(response, 200, workspace(currentUser(request)));
  }

  const memberMatch = url.pathname.match(/^\/api\/channels\/(\d+)\/members$/);
  if (request.method === "GET" && memberMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const channel = sqliteChannel(Number(memberMatch[1]));
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    if (!isChannelMember(channel, user.id)) return sendJson(response, 403, { message: "非频道成员不可查看成员" });
    const members = sqliteChannelMembers(channel.id);
    return sendJson(response, 200, members);
  }

  if (request.method === "POST" && memberMatch) {
    const user = requireAdmin(request, response);
    if (!user) return;
    const channel = channels.find((item) => item.id === Number(memberMatch[1]));
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
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
    const user = requireAdmin(request, response);
    if (!user) return;
    const channel = channels.find((item) => item.id === Number(removeMemberMatch[1]));
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
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
    const channel = sqliteChannel(channelId);
    if (!channel) return sendJson(response, 404, { message: "频道不存在" });
    if (!isChannelMember(channel, user.id)) return sendJson(response, 403, { message: "非频道成员不可读取消息" });
    if (user && !parentId) {
      markRead(user.id, "channel", channelId);
      saveStore();
    }
    const result = sqliteChannelMessages(channelId, parentId ? Number(parentId) : null);
    return sendJson(response, 200, result);
  }

  const directMatch = url.pathname.match(/^\/api\/direct\/(\d+)\/messages$/);
  if (request.method === "GET" && directMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const peerId = Number(directMatch[1]);
    const peer = users.find((item) => item.id === peerId);
    if (!peer || peer.id === user.id) return sendJson(response, 404, { message: "私信用户不存在" });
    markRead(user.id, "direct", peerId);
    saveStore();
    const result = sqliteDirectMessages(user.id, peerId);
    return sendJson(response, 200, result);
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
    const message = {
      id: ++nextMessageId,
      channelId: Number(body.channelId),
      parentId,
      senderId: sender.id,
      senderName: sender.name,
      avatarText: sender.avatarText,
      avatarColor: sender.avatarColor,
      content,
      sensitive: hasSensitiveWord(content),
      deliveryStatus: parentId ? "线程回复已送达" : "已送达",
      replyCount: 0,
      messageType: parentId ? "THREAD" : "CHANNEL",
      createdAt: new Date().toISOString()
    };
    messages.push(message);
    if (parentId) {
      const root = messages.find((item) => item.id === parentId);
      if (root) root.replyCount += 1;
    }
    users.filter((item) => item.id !== sender.id).forEach((item) => addUnread(item.id, "channel", message.channelId));
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
    message.content = content;
    message.sensitive = hasSensitiveWord(content);
    message.edited = true;
    message.editedAt = new Date().toISOString();
    publishAudit("编辑消息", String(message.id), user.account);
    saveStore();
    const targets = message.messageType === "DIRECT" ? [message.senderId, message.receiverId] : channelMemberIds(message.channelId);
    broadcastRealtime("message:edited", { message: publicMessage(message) }, targets);
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
    const message = {
      id: ++nextMessageId,
      channelId: null,
      parentId: null,
      senderId: user.id,
      receiverId: receiver.id,
      senderName: user.name,
      avatarText: user.avatarText,
      avatarColor: user.avatarColor,
      content,
      sensitive: hasSensitiveWord(content),
      deliveryStatus: "私信已送达",
      replyCount: 0,
      messageType: "DIRECT",
      createdAt: new Date().toISOString()
    };
    messages.push(message);
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
    if (upload.content.length > MAX_UPLOAD_BYTES) return sendJson(response, 400, { message: "文件大小不能超过 5MB" });
    const originalName = path.basename(upload.filename || "attachment.bin");
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTS.has(ext)) return sendJson(response, 400, { message: "文件类型不允许上传" });
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
    message.revoked = true;
    message.revokedAt = new Date().toISOString();
    message.deliveryStatus = "已撤回";
    publishAudit("撤回消息", String(message.id), user.account);
    saveStore();
    const targets = message.messageType === "DIRECT" ? [message.senderId, message.receiverId] : channelMemberIds(message.channelId);
    broadcastRealtime("message:revoked", { message: publicMessage(message) }, targets);
    return sendJson(response, 200, publicMessage(message));
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
    const channel = { id: ++nextChannelId, name, description: body.description || "企业内部协作频道", joined: true, members: [user.id], memberCount: 1, unreadCount: 0 };
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
    const type = String(url.searchParams.get("type") || "all");
    const result = sqliteAudits(type);
    return sendJson(response, 200, result);
  }

  return sendJson(response, 404, { message: "接口不存在" });
}

function serveStatic(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not Found");
      return;
    }
    const ext = path.extname(filePath);
    const type = ext === ".css" ? "text/css; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
    response.writeHead(200, { "Content-Type": type });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await routeApi(request, response, url);
    } else {
      serveStatic(response, url.pathname);
    }
  } catch (error) {
    sendJson(response, 500, { message: error.message || "系统繁忙" });
  }
});

server.on("upgrade", handleRealtimeUpgrade);

loadStore();

server.listen(PORT, "127.0.0.1", () => {
  console.log(`BeeChat MVP 已启动：http://127.0.0.1:${PORT}`);
});
