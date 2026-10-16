import { createClient, type Client } from "@libsql/client";

// Local dev: a SQLite file, zero setup. Production: Turso (hosted libSQL), same SQL.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shares (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
  PRIMARY KEY (document_id, user_id)
);
CREATE INDEX IF NOT EXISTS shares_user ON shares(user_id);
INSERT OR IGNORE INTO users (id, name, email) VALUES
  ('alice', 'Alice Chen', 'alice@ajaia.test'),
  ('bob', 'Bob Okafor', 'bob@ajaia.test'),
  ('carol', 'Carol Diaz', 'carol@ajaia.test');
INSERT OR IGNORE INTO documents (id, owner_id, title, content, created_at, updated_at) VALUES
  ('welcome', 'alice', 'Welcome to Ajaia Docs',
   '<h1>Welcome to Ajaia Docs</h1><p>This document is <strong>owned by Alice</strong> and <em>shared with Bob</em> as an editor.</p><h2>Try it</h2><ul><li><p>Format text with the toolbar: <strong>bold</strong>, <em>italic</em>, <u>underline</u>, headings and lists.</p></li><li><p>Switch users (top right) to see owned vs shared documents.</p></li><li><p>Import a .txt, .md or .docx file from the home page.</p></li></ul>',
   '2026-10-01T09:00:00.000Z', '2026-10-01T09:00:00.000Z');
INSERT OR IGNORE INTO shares (document_id, user_id, role) VALUES ('welcome', 'bob', 'editor');
`;

let ready: Promise<Client> | null = null;

export function db(): Promise<Client> {
  ready ??= (async () => {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    // ponytail: idempotent schema on boot instead of a migration tool; add migrations when the schema starts changing.
    await client.executeMultiple(SCHEMA);
    return client;
  })().catch((err) => {
    ready = null; // allow retry on the next request instead of caching the failure
    throw err;
  });
  return ready;
}
