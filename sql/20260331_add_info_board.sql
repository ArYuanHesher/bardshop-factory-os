-- 資訊看板：部門間訊息交流
CREATE TABLE IF NOT EXISTS info_board_posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  department TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE info_board_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "info_board_posts_select" ON info_board_posts FOR SELECT USING (true);
CREATE POLICY "info_board_posts_insert" ON info_board_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "info_board_posts_update" ON info_board_posts FOR UPDATE USING (true);
CREATE POLICY "info_board_posts_delete" ON info_board_posts FOR DELETE USING (true);
