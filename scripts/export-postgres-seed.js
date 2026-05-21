const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const dataFile = path.join(root, "data", "store.json");
const outputDir = path.join(root, "backups", "postgres");
const outputFile = path.join(outputDir, "beechat-postgres-seed.sql");

const seedUsers = [
  { id: 1, account: "13677889001", name: "当前用户", role: "ADMIN", passwordHash: hashPassword("admin123"), avatarText: "我", avatarColor: "#4A9FD8", online: false },
  { id: 2, account: "zhangsan", name: "张三", role: "USER", passwordHash: hashPassword("123456"), avatarText: "张", avatarColor: "#E8924A", online: false },
  { id: 3, account: "lisi", name: "李四", role: "USER", passwordHash: hashPassword("123456"), avatarText: "李", avatarColor: "#5DADE2", online: false },
  { id: 4, account: "wangwu", name: "王五", role: "USER", passwordHash: hashPassword("123456"), avatarText: "王", avatarColor: "#58D68D", online: false }
];

function hashPassword(password) {
  return crypto.createHash("sha256").update(`beechat:${password}`).digest("hex");
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value ?? null))}::jsonb`;
}

function sqlBoolean(value) {
  return value ? "true" : "false";
}

function sqlNumber(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  const number = Number(value);
  assert(Number.isFinite(number), `数值字段异常：${value}`);
  return String(number);
}

function sqlTime(value) {
  if (!value) return "NULL";
  const date = new Date(value);
  assert(!Number.isNaN(date.getTime()), `时间字段异常：${value}`);
  return sqlString(date.toISOString());
}

function normalizeStore(raw) {
  const store = JSON.parse(raw);
  assert(Array.isArray(store.channels), "store.json 缺少 channels 数组");
  assert(Array.isArray(store.messages), "store.json 缺少 messages 数组");
  assert(Array.isArray(store.audits), "store.json 缺少 audits 数组");
  return store;
}

function usersFromStore(store) {
  const settings = store.userSettings || {};
  const adminState = store.userAdminState || {};
  return seedUsers.map((user) => {
    const userSettings = settings[String(user.id)] || {};
    const userState = adminState[String(user.id)] || {};
    return {
      ...user,
      name: userSettings.displayName || user.name,
      role: userState.role || user.role,
      disabled: Boolean(userState.disabled)
    };
  });
}

function channelMembers(channel) {
  const members = Array.isArray(channel.members) && channel.members.length
    ? channel.members
    : seedUsers.map((user) => user.id);
  return [...new Set(members.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
}

function sanitizedStoreSnapshot(store) {
  return {
    ...store,
    sessions: {},
    loginFailures: {}
  };
}

function buildSql(store) {
  const lines = [
    "-- BeeChat PostgreSQL 一次性导入脚本",
    "-- 由 scripts/export-postgres-seed.js 生成，导入前请先执行 migrations/postgres/001_init.sql。",
    "BEGIN;",
    "SET CONSTRAINTS ALL DEFERRED;",
    "TRUNCATE unread_state, audits, files, messages, channel_members, channels, sessions, users, app_state RESTART IDENTITY CASCADE;"
  ];

  usersFromStore(store).forEach((user) => {
    lines.push(`INSERT INTO users(id, account, name, role, password_hash, avatar_text, avatar_color, online, disabled) VALUES (${sqlNumber(user.id)}, ${sqlString(user.account)}, ${sqlString(user.name)}, ${sqlString(user.role)}, ${sqlString(user.passwordHash)}, ${sqlString(user.avatarText)}, ${sqlString(user.avatarColor)}, ${sqlBoolean(false)}, ${sqlBoolean(user.disabled)}) ON CONFLICT(id) DO UPDATE SET account = excluded.account, name = excluded.name, role = excluded.role, password_hash = excluded.password_hash, avatar_text = excluded.avatar_text, avatar_color = excluded.avatar_color, online = excluded.online, disabled = excluded.disabled, updated_at = now();`);
  });

  store.channels.forEach((channel) => {
    const members = channelMembers(channel);
    lines.push(`INSERT INTO channels(id, name, description, announcement, joined, member_count) VALUES (${sqlNumber(channel.id)}, ${sqlString(channel.name)}, ${sqlString(channel.description || "")}, ${sqlString(channel.announcement || "")}, ${sqlBoolean(channel.joined !== false)}, ${sqlNumber(members.length)}) ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, announcement = excluded.announcement, joined = excluded.joined, member_count = excluded.member_count, updated_at = now();`);
    members.forEach((userId) => {
      lines.push(`INSERT INTO channel_members(channel_id, user_id) VALUES (${sqlNumber(channel.id)}, ${sqlNumber(userId)}) ON CONFLICT(channel_id, user_id) DO NOTHING;`);
    });
  });

  store.messages.forEach((message) => {
    lines.push(`INSERT INTO messages(id, channel_id, parent_id, sender_id, receiver_id, message_type, content, sensitive, delivery_status, reply_count, pinned, favorite_user_ids, reactions, mention_user_ids, revoked, edited, file_json, created_at, edited_at, revoked_at) VALUES (${sqlNumber(message.id)}, ${sqlNumber(message.channelId)}, ${sqlNumber(message.parentId)}, ${sqlNumber(message.senderId)}, ${sqlNumber(message.receiverId)}, ${sqlString(message.messageType || (message.receiverId ? "DIRECT" : "CHANNEL"))}, ${sqlString(message.content || "")}, ${sqlBoolean(message.sensitive)}, ${sqlString(message.deliveryStatus || "")}, ${sqlNumber(message.replyCount || 0)}, ${sqlBoolean(message.pinned)}, ${sqlJson(message.favoriteUserIds || [])}, ${sqlJson(message.reactions || {})}, ${sqlJson(message.mentionUserIds || [])}, ${sqlBoolean(message.revoked)}, ${sqlBoolean(message.edited)}, ${message.file ? sqlJson(message.file) : "NULL"}, ${sqlTime(message.createdAt)}, ${sqlTime(message.editedAt)}, ${sqlTime(message.revokedAt)}) ON CONFLICT(id) DO UPDATE SET content = excluded.content, sensitive = excluded.sensitive, delivery_status = excluded.delivery_status, reply_count = excluded.reply_count, pinned = excluded.pinned, favorite_user_ids = excluded.favorite_user_ids, reactions = excluded.reactions, mention_user_ids = excluded.mention_user_ids, revoked = excluded.revoked, edited = excluded.edited, file_json = excluded.file_json, edited_at = excluded.edited_at, revoked_at = excluded.revoked_at;`);
    if (message.file) {
      lines.push(`INSERT INTO files(stored_name, message_id, original_name, size, path) VALUES (${sqlString(message.file.storedName)}, ${sqlNumber(message.id)}, ${sqlString(message.file.originalName)}, ${sqlNumber(message.file.size)}, ${sqlString(message.file.path)}) ON CONFLICT(stored_name) DO UPDATE SET message_id = excluded.message_id, original_name = excluded.original_name, size = excluded.size, path = excluded.path;`);
    }
  });

  store.audits.forEach((audit) => {
    lines.push(`INSERT INTO audits(id, module, action, target_id, operator, success, created_at) VALUES (${sqlNumber(audit.id)}, ${sqlString(audit.module)}, ${sqlString(audit.action)}, ${sqlString(audit.targetId)}, ${sqlString(audit.operator)}, ${sqlBoolean(audit.success !== false)}, ${sqlTime(audit.createdAt)}) ON CONFLICT(id) DO UPDATE SET module = excluded.module, action = excluded.action, target_id = excluded.target_id, operator = excluded.operator, success = excluded.success, created_at = excluded.created_at;`);
  });

  Object.entries(store.unreadState || {}).forEach(([userId, state]) => {
    Object.entries(state.channels || {}).forEach(([targetId, count]) => {
      lines.push(`INSERT INTO unread_state(user_id, target_type, target_id, count) VALUES (${sqlNumber(userId)}, 'channel', ${sqlString(targetId)}, ${sqlNumber(count)}) ON CONFLICT(user_id, target_type, target_id) DO UPDATE SET count = excluded.count;`);
    });
    Object.entries(state.direct || {}).forEach(([targetId, count]) => {
      lines.push(`INSERT INTO unread_state(user_id, target_type, target_id, count) VALUES (${sqlNumber(userId)}, 'direct', ${sqlString(targetId)}, ${sqlNumber(count)}) ON CONFLICT(user_id, target_type, target_id) DO UPDATE SET count = excluded.count;`);
    });
    Object.entries(state.mentions || {}).forEach(([targetId, count]) => {
      lines.push(`INSERT INTO unread_state(user_id, target_type, target_id, count) VALUES (${sqlNumber(userId)}, 'mention', ${sqlString(targetId)}, ${sqlNumber(count)}) ON CONFLICT(user_id, target_type, target_id) DO UPDATE SET count = excluded.count;`);
    });
  });

  lines.push(`INSERT INTO app_state(key, value, updated_at) VALUES ('store', ${sqlJson(sanitizedStoreSnapshot(store))}, now()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`);
  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

function main() {
  assert(fs.existsSync(dataFile), "缺少 data/store.json，请先启动服务生成快照或执行备份");
  const store = normalizeStore(fs.readFileSync(dataFile, "utf8"));
  const sql = buildSql(store);
  assert(sql.includes("BEGIN;"), "导入 SQL 缺少事务");
  assert(sql.includes("INSERT INTO users"), "导入 SQL 缺少用户数据");
  assert(sql.includes("INSERT INTO channels"), "导入 SQL 缺少频道数据");
  assert(sql.includes("INSERT INTO messages"), "导入 SQL 缺少消息数据");
  assert(sql.includes("INSERT INTO app_state"), "导入 SQL 缺少快照数据");
  ensureDir(outputDir);
  fs.writeFileSync(outputFile, sql);
  console.log(`BeeChat PostgreSQL 导入 SQL 已生成：${outputFile}`);
}

main();
