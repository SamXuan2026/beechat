CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  account TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_text TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  online BOOLEAN NOT NULL DEFAULT false,
  disabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  announcement TEXT NOT NULL DEFAULT '',
  joined BOOLEAN NOT NULL DEFAULT true,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY,
  channel_id BIGINT REFERENCES channels(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  parent_id BIGINT REFERENCES messages(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  receiver_id BIGINT REFERENCES users(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  sensitive BOOLEAN NOT NULL DEFAULT false,
  delivery_status TEXT NOT NULL DEFAULT '',
  reply_count INTEGER NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT false,
  favorite_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  mention_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  revoked BOOLEAN NOT NULL DEFAULT false,
  edited BOOLEAN NOT NULL DEFAULT false,
  file_json JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  edited_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS files (
  stored_name TEXT PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  original_name TEXT NOT NULL,
  size BIGINT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audits (
  id BIGINT PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  operator TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS unread_state (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_parent_id ON messages(channel_id, parent_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_direct_id ON messages(sender_id, receiver_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_operator ON audits(operator);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
