const { assertRepositoryContract } = require("./contracts");

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizePageSize(value) {
  const pageSize = Number(value) || 30;
  return Math.min(Math.max(pageSize, 1), 100);
}

const AUDIT_ACTIONS = {
  message: ["发送频道消息", "发送线程回复", "发送私信", "编辑消息", "撤回消息", "置顶消息", "取消置顶消息", "收藏消息", "取消收藏消息", "回应消息", "取消回应消息"],
  file: ["上传文件", "下载文件"],
  member: ["邀请频道成员", "移除频道成员", "创建频道", "加入频道"],
  login: ["用户登录"]
};

function auditFromRow(row) {
  return {
    id: row.id,
    module: row.module,
    action: row.action,
    targetId: row.target_id,
    operator: row.operator,
    success: Boolean(row.success),
    createdAt: row.created_at
  };
}

class SQLiteRepository {
  constructor(options = {}) {
    this.db = options.db;
    this.users = options.users || [];
    this.messages = options.messages || [];
    this.publicMessage = options.publicMessage || ((message) => message);
  }

  senderFor(senderId) {
    return this.users.find((item) => Number(item.id) === Number(senderId));
  }

  messageFromRow(row) {
    if (!row) return null;
    const sender = this.senderFor(row.sender_id);
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
      favoriteUserIds: parseJson(row.favorite_user_ids_json, []),
      reactions: parseJson(row.reactions_json, {}),
      mentionUserIds: parseJson(row.mention_user_ids_json, []),
      revoked: Boolean(row.revoked),
      edited: Boolean(row.edited),
      file: parseJson(row.file_json, undefined),
      createdAt: row.created_at,
      editedAt: row.edited_at,
      revokedAt: row.revoked_at
    };
  }

  pageRows(rows, pageSize) {
    const hasMore = rows.length > pageSize;
    const items = (hasMore ? rows.slice(0, pageSize) : rows)
      .reverse()
      .map((row) => this.messageFromRow(row))
      .map((message) => this.publicMessage(message));
    return {
      items,
      hasMore,
      nextBeforeId: items.length ? items[0].id : null,
      pageSize
    };
  }

  channelById(channelId) {
    const row = this.db.prepare("SELECT id, name, description, announcement, joined, member_count FROM channels WHERE id = ?").get(channelId);
    if (!row) return null;
    const members = this.db.prepare("SELECT user_id FROM channel_members WHERE channel_id = ?").all(channelId).map((item) => item.user_id);
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

  channelMembers(channelId) {
    return this.db.prepare(`
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

  channelMessages(channelId, parentId, beforeId, pageSizeValue) {
    const pageSize = normalizePageSize(pageSizeValue);
    const limit = pageSize + 1;
    const beforeSql = beforeId ? " AND id < ?" : "";
    const params = parentId ? [channelId, parentId] : [channelId];
    if (beforeId) params.push(beforeId);
    params.push(limit);
    const rows = parentId
      ? this.db.prepare(`SELECT * FROM messages WHERE channel_id = ? AND parent_id = ? AND message_type != 'DIRECT'${beforeSql} ORDER BY id DESC LIMIT ?`).all(...params)
      : this.db.prepare(`SELECT * FROM messages WHERE channel_id = ? AND parent_id IS NULL AND message_type != 'DIRECT'${beforeSql} ORDER BY id DESC LIMIT ?`).all(...params);
    return this.pageRows(rows, pageSize);
  }

  directMessages(userId, peerId, beforeId, pageSizeValue) {
    const pageSize = normalizePageSize(pageSizeValue);
    const beforeSql = beforeId ? " AND id < ?" : "";
    const params = [userId, peerId, peerId, userId];
    if (beforeId) params.push(beforeId);
    params.push(pageSize + 1);
    const rows = this.db.prepare(`
      SELECT * FROM messages
      WHERE message_type = 'DIRECT'
        AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
        ${beforeSql}
      ORDER BY id DESC
      LIMIT ?
    `).all(...params);
    return this.pageRows(rows, pageSize);
  }

  channelFiles(channelId) {
    return this.db.prepare(`
      SELECT * FROM messages
      WHERE channel_id = ?
        AND file_json IS NOT NULL
        AND revoked = 0
        AND message_type != 'DIRECT'
      ORDER BY id DESC
      LIMIT 100
    `).all(channelId).map((row) => this.messageFromRow(row)).map((message) => this.publicMessage(message));
  }

  audits(type = "all", query = {}) {
    const rows = this.db.prepare("SELECT * FROM audits ORDER BY id DESC").all();
    const operator = String(query.operator || "").trim().toLowerCase();
    const keyword = String(query.keyword || "").trim().toLowerCase();
    const fromTime = query.from ? new Date(`${query.from}T00:00:00`).getTime() : 0;
    const toTime = query.to ? new Date(`${query.to}T23:59:59`).getTime() : 0;
    return rows.map(auditFromRow).filter((item) => {
      if (type !== "all") {
        const actions = AUDIT_ACTIONS[type];
        if (actions && !actions.includes(item.action)) return false;
      }
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

  createChannelMessage(input = {}) {
    const sender = input.sender;
    const parentId = input.parentId == null ? null : Number(input.parentId);
    const message = {
      id: Number(input.id),
      channelId: Number(input.channelId),
      parentId,
      senderId: sender.id,
      senderName: sender.name,
      avatarText: sender.avatarText,
      avatarColor: sender.avatarColor,
      content: input.content,
      sensitive: Boolean(input.sensitive),
      deliveryStatus: parentId ? "线程回复已送达" : "已送达",
      replyCount: 0,
      pinned: false,
      favoriteUserIds: [],
      reactions: {},
      mentionUserIds: Array.isArray(input.mentionUserIds) ? input.mentionUserIds : [],
      messageType: parentId ? "THREAD" : "CHANNEL",
      createdAt: input.createdAt || new Date().toISOString()
    };
    this.messages.push(message);
    if (parentId) {
      const root = this.messages.find((item) => Number(item.id) === parentId);
      if (root) root.replyCount = Number(root.replyCount || 0) + 1;
    }
    return message;
  }

  createDirectMessage(input = {}) {
    const sender = input.sender;
    const receiver = input.receiver;
    const message = {
      id: Number(input.id),
      channelId: null,
      parentId: null,
      senderId: sender.id,
      receiverId: receiver.id,
      senderName: sender.name,
      avatarText: sender.avatarText,
      avatarColor: sender.avatarColor,
      content: input.content,
      sensitive: Boolean(input.sensitive),
      deliveryStatus: "私信已送达",
      replyCount: 0,
      pinned: false,
      favoriteUserIds: [],
      reactions: {},
      mentionUserIds: [],
      messageType: "DIRECT",
      createdAt: input.createdAt || new Date().toISOString()
    };
    this.messages.push(message);
    return message;
  }

  updateMessageContent(messageId, input = {}) {
    const message = this.messages.find((item) => Number(item.id) === Number(messageId));
    if (!message) return null;
    message.content = input.content;
    message.sensitive = Boolean(input.sensitive);
    message.edited = true;
    message.editedAt = input.editedAt || new Date().toISOString();
    return message;
  }

  revokeMessage(messageId, input = {}) {
    const message = this.messages.find((item) => Number(item.id) === Number(messageId));
    if (!message) return null;
    message.revoked = true;
    message.revokedAt = input.revokedAt || new Date().toISOString();
    message.deliveryStatus = "已撤回";
    return message;
  }

  migrationStatus() {
    return this.db.prepare("SELECT version, name, applied_at AS appliedAt FROM schema_migrations ORDER BY version ASC").all();
  }

  health() {
    return {
      provider: "sqlite",
      status: "UP"
    };
  }
}

function createSQLiteRepository(options) {
  const repository = new SQLiteRepository(options);
  assertRepositoryContract(repository);
  return repository;
}

module.exports = {
  SQLiteRepository,
  AUDIT_ACTIONS,
  auditFromRow,
  createSQLiteRepository,
  normalizePageSize,
  parseJson
};
