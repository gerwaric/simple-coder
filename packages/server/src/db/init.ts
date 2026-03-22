import type { Sql } from "postgres";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state      TEXT NOT NULL DEFAULT 'pending'
               CHECK (state IN ('pending', 'active', 'completed', 'stopped')),
  agent_id   TEXT,
  title      TEXT NOT NULL DEFAULT '',
  include_claude_md BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool_call', 'tool_result')),
  content         TEXT NOT NULL,
  thinking        TEXT,
  tool_name       TEXT,
  tool_args       JSONB,
  tool_call_id    TEXT,
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  context_status  TEXT NOT NULL DEFAULT 'active'
                    CHECK (context_status IN ('active', 'summarized', 'inactive')),
  token_count     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS summaries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  token_count INTEGER,
  created_by  TEXT NOT NULL CHECK (created_by IN ('agent', 'user')),
  position_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS summary_messages (
  summary_id UUID NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (summary_id, message_id),
  UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_tool_call_id ON messages(tool_call_id);
CREATE INDEX IF NOT EXISTS idx_summary_messages_message_id ON summary_messages(message_id);
`;

export async function initDb(sql: Sql): Promise<void> {
  await sql.unsafe(SCHEMA);
  console.log("database schema applied");
}
