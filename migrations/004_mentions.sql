ALTER TABLE messages ADD COLUMN mention_user_ids_json TEXT NOT NULL DEFAULT '[]';
