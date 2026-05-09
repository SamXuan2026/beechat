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
