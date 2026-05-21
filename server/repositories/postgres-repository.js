const { assertRepositoryContract } = require("./contracts");
const { AUDIT_ACTIONS, auditFromRow } = require("./sqlite-repository");

function normalizePageSize(value) {
  const pageSize = Number(value) || 30;
  return Math.min(Math.max(pageSize, 1), 100);
}

function rowToMessage(row, sender) {
  return {
    id: Number(row.id),
    channelId: row.channel_id === null ? null : Number(row.channel_id),
    parentId: row.parent_id === null ? null : Number(row.parent_id),
    senderId: Number(row.sender_id),
    receiverId: row.receiver_id === null ? null : Number(row.receiver_id),
    senderName: sender ? sender.name : "未知用户",
    avatarText: sender ? sender.avatarText : "?",
    avatarColor: sender ? sender.avatarColor : "#8a93a5",
    content: row.content,
    sensitive: Boolean(row.sensitive),
    deliveryStatus: row.delivery_status,
    replyCount: Number(row.reply_count || 0),
    messageType: row.message_type,
    pinned: Boolean(row.pinned),
    favoriteUserIds: row.favorite_user_ids || [],
    reactions: row.reactions || {},
    mentionUserIds: row.mention_user_ids || [],
    revoked: Boolean(row.revoked),
    edited: Boolean(row.edited),
    file: row.file_json || undefined,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    revokedAt: row.revoked_at
  };
}

class PostgresRepository {
  constructor(options = {}) {
    this.adapter = options.adapter;
    this.users = options.users || [];
    this.publicMessage = options.publicMessage || ((message) => message);
  }

  senderFor(senderId) {
    return this.users.find((item) => Number(item.id) === Number(senderId));
  }

  async channelById(channelId) {
    const result = await this.adapter.query(
      "SELECT id, name, description, announcement, joined, member_count FROM channels WHERE id = $1",
      [channelId]
    );
    const row = result.rows[0];
    if (!row) return null;
    const memberResult = await this.adapter.query(
      "SELECT user_id FROM channel_members WHERE channel_id = $1 ORDER BY user_id ASC",
      [channelId]
    );
    return {
      id: Number(row.id),
      name: row.name,
      description: row.description,
      announcement: row.announcement || "",
      joined: Boolean(row.joined),
      memberCount: Number(row.member_count || 0),
      members: memberResult.rows.map((item) => Number(item.user_id)),
      unreadCount: 0,
      mentionCount: 0
    };
  }

  async channelMembers(channelId) {
    const result = await this.adapter.query(`
      SELECT u.id, u.account, u.name, u.role, u.avatar_text, u.avatar_color, u.online
      FROM users u
      JOIN channel_members cm ON cm.user_id = u.id
      WHERE cm.channel_id = $1
      ORDER BY u.id ASC
    `, [channelId]);
    return result.rows.map((row) => ({
      id: Number(row.id),
      account: row.account,
      name: row.name,
      role: row.role,
      avatarText: row.avatar_text,
      avatarColor: row.avatar_color,
      online: Boolean(row.online)
    }));
  }

  async channelMessages(channelId, parentId, beforeId, pageSizeValue) {
    const pageSize = normalizePageSize(pageSizeValue);
    const params = [channelId];
    let parentSql = "parent_id IS NULL";
    if (parentId) {
      params.push(parentId);
      parentSql = `parent_id = $${params.length}`;
    }
    let beforeSql = "";
    if (beforeId) {
      params.push(beforeId);
      beforeSql = ` AND id < $${params.length}`;
    }
    params.push(pageSize + 1);
    const result = await this.adapter.query(`
      SELECT *
      FROM messages
      WHERE channel_id = $1
        AND ${parentSql}
        AND message_type != 'DIRECT'
        ${beforeSql}
      ORDER BY id DESC
      LIMIT $${params.length}
    `, params);
    const hasMore = result.rows.length > pageSize;
    const items = (hasMore ? result.rows.slice(0, pageSize) : result.rows)
      .reverse()
      .map((row) => rowToMessage(row, this.senderFor(row.sender_id)))
      .map((message) => this.publicMessage(message));
    return {
      items,
      hasMore,
      nextBeforeId: items.length ? items[0].id : null,
      pageSize
    };
  }

  async directMessages(userId, peerId, beforeId, pageSizeValue) {
    const pageSize = normalizePageSize(pageSizeValue);
    const params = [userId, peerId, peerId, userId];
    let beforeSql = "";
    if (beforeId) {
      params.push(beforeId);
      beforeSql = ` AND id < $${params.length}`;
    }
    params.push(pageSize + 1);
    const result = await this.adapter.query(`
      SELECT *
      FROM messages
      WHERE message_type = 'DIRECT'
        AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $3 AND receiver_id = $4))
        ${beforeSql}
      ORDER BY id DESC
      LIMIT $${params.length}
    `, params);
    const hasMore = result.rows.length > pageSize;
    const items = (hasMore ? result.rows.slice(0, pageSize) : result.rows)
      .reverse()
      .map((row) => rowToMessage(row, this.senderFor(row.sender_id)))
      .map((message) => this.publicMessage(message));
    return {
      items,
      hasMore,
      nextBeforeId: items.length ? items[0].id : null,
      pageSize
    };
  }

  async channelFiles(channelId) {
    const result = await this.adapter.query(`
      SELECT *
      FROM messages
      WHERE channel_id = $1
        AND file_json IS NOT NULL
        AND revoked = false
        AND message_type != 'DIRECT'
      ORDER BY id DESC
      LIMIT 100
    `, [channelId]);
    return result.rows
      .map((row) => rowToMessage(row, this.senderFor(row.sender_id)))
      .map((message) => this.publicMessage(message));
  }

  async audits(type = "all", query = {}) {
    const params = [];
    const where = [];
    const actions = AUDIT_ACTIONS[type];
    if (type !== "all" && actions) {
      params.push(actions);
      where.push(`action = ANY($${params.length})`);
    }
    const operator = String(query.operator || "").trim();
    if (operator) {
      params.push(`%${operator}%`);
      where.push(`operator ILIKE $${params.length}`);
    }
    const keyword = String(query.keyword || "").trim();
    if (keyword) {
      params.push(`%${keyword}%`);
      where.push(`(module ILIKE $${params.length} OR action ILIKE $${params.length} OR target_id ILIKE $${params.length} OR operator ILIKE $${params.length})`);
    }
    if (query.from) {
      params.push(`${query.from}T00:00:00`);
      where.push(`created_at >= $${params.length}`);
    }
    if (query.to) {
      params.push(`${query.to}T23:59:59`);
      where.push(`created_at <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await this.adapter.query(`SELECT * FROM audits ${whereSql} ORDER BY id DESC`, params);
    return result.rows.map(auditFromRow);
  }

  async createChannelMessage() {
    throw new Error("PostgreSQL 频道消息写入仓储尚未接入主服务");
  }

  async createDirectMessage() {
    throw new Error("PostgreSQL 私信写入仓储尚未接入主服务");
  }

  async updateMessageContent() {
    throw new Error("PostgreSQL 消息编辑写入仓储尚未接入主服务");
  }

  async revokeMessage() {
    throw new Error("PostgreSQL 消息撤回写入仓储尚未接入主服务");
  }

  async migrationStatus() {
    return this.adapter.migrationStatus();
  }

  async health() {
    return this.adapter.health();
  }
}

function createPostgresRepository(options) {
  const repository = new PostgresRepository(options);
  assertRepositoryContract(repository);
  return repository;
}

module.exports = {
  PostgresRepository,
  createPostgresRepository,
  normalizePageSize,
  rowToMessage
};
