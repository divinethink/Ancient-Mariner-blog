-- D1 migration 0001 (P11a-১): view-count ও dedupe। additive; IF NOT EXISTS ⇒ আবার চালালেও নিরাপদ।
-- day = সাইট-timezone-এর "YYYY-MM-DD" (Arch §৭, §৮); কাঁচা IP/UA কোথাও নেই।
CREATE TABLE IF NOT EXISTS viewCounts (
  postId   TEXT    NOT NULL,
  day      TEXT    NOT NULL,
  country  TEXT    NOT NULL DEFAULT 'XX',
  referrer TEXT    NOT NULL DEFAULT 'direct',
  n        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (postId, day, country, referrer)
);
CREATE INDEX IF NOT EXISTS idx_viewCounts_day ON viewCounts (day);

CREATE TABLE IF NOT EXISTS dailyVisitors (
  day TEXT PRIMARY KEY,
  n   INTEGER NOT NULL DEFAULT 0
);

-- key = 'v:<h>' (ভিজিটর/দিন) বা 'p:<postId>:<h>' (পোস্ট×ভিজিটর/দিন); windowStart = day; Cron পুরনো row মোছে
CREATE TABLE IF NOT EXISTS rateLimits (
  key         TEXT PRIMARY KEY,
  windowStart TEXT    NOT NULL,
  n           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_rateLimits_window ON rateLimits (windowStart);
