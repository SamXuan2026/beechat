ALTER TABLE messages ADD COLUMN favorite_user_ids_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE messages ADD COLUMN reactions_json TEXT NOT NULL DEFAULT '{}';
