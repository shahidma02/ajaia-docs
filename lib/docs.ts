import { db } from "./db";
import { HttpError } from "./http";

export type Role = "owner" | "editor" | "viewer";
export type User = { id: string; name: string; email: string };
export type DocSummary = { id: string; title: string; updatedAt: string; ownerName: string; role: Role };
export type Doc = DocSummary & { content: string; version: number; ownerId: string };
export type Share = { userId: string; name: string; email: string; role: "viewer" | "editor" };

export const MAX_TITLE = 200;
export const MAX_CONTENT = 1_000_000; // ~1 MB of HTML

const DOC_COLUMNS = `d.id, d.title, d.content, d.version, d.owner_id, d.updated_at, u.name AS owner_name`;

function toDoc(r: Record<string, unknown>, role: Role): Doc {
  return {
    id: String(r.id),
    title: String(r.title),
    content: String(r.content),
    version: Number(r.version),
    ownerId: String(r.owner_id),
    ownerName: String(r.owner_name),
    updatedAt: String(r.updated_at),
    role,
  };
}

function cleanTitle(title: unknown): string {
  if (typeof title !== "string") throw new HttpError(400, "Title must be a string.");
  const t = title.trim();
  if (!t) throw new HttpError(400, "Title cannot be empty.");
  if (t.length > MAX_TITLE) throw new HttpError(400, `Title must be ${MAX_TITLE} characters or fewer.`);
  return t;
}

function cleanContent(content: unknown): string {
  if (typeof content !== "string") throw new HttpError(400, "Content must be a string.");
  if (content.length > MAX_CONTENT) throw new HttpError(413, "Document is too large to save.");
  return content;
}

export async function listUsers(): Promise<User[]> {
  const { rows } = await (await db()).execute("SELECT id, name, email FROM users ORDER BY name");
  return rows.map((r) => ({ id: String(r.id), name: String(r.name), email: String(r.email) }));
}

export async function getUser(id: string): Promise<User | null> {
  const { rows } = await (await db()).execute({ sql: "SELECT id, name, email FROM users WHERE id = ?", args: [id] });
  return rows[0] ? { id: String(rows[0].id), name: String(rows[0].name), email: String(rows[0].email) } : null;
}

export async function listDocs(userId: string): Promise<{ owned: DocSummary[]; shared: DocSummary[] }> {
  const { rows } = await (await db()).execute({
    sql: `SELECT d.id, d.title, d.updated_at, u.name AS owner_name,
            CASE WHEN d.owner_id = ? THEN 'owner' ELSE s.role END AS role
          FROM documents d
          JOIN users u ON u.id = d.owner_id
          LEFT JOIN shares s ON s.document_id = d.id AND s.user_id = ?
          WHERE d.owner_id = ? OR s.user_id IS NOT NULL
          ORDER BY d.updated_at DESC`,
    args: [userId, userId, userId],
  });
  const docs: DocSummary[] = rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    updatedAt: String(r.updated_at),
    ownerName: String(r.owner_name),
    role: r.role as Role,
  }));
  return { owned: docs.filter((d) => d.role === "owner"), shared: docs.filter((d) => d.role !== "owner") };
}

// The single place that decides who can see a document. Returns 404 (not 403) for no access,
// so document ids don't leak to users who weren't given them.
export async function getDoc(docId: string, userId: string): Promise<Doc> {
  const { rows } = await (await db()).execute({
    sql: `SELECT ${DOC_COLUMNS}, CASE WHEN d.owner_id = ? THEN 'owner' ELSE s.role END AS role
          FROM documents d
          JOIN users u ON u.id = d.owner_id
          LEFT JOIN shares s ON s.document_id = d.id AND s.user_id = ?
          WHERE d.id = ? AND (d.owner_id = ? OR s.user_id IS NOT NULL)`,
    args: [userId, userId, docId, userId],
  });
  if (!rows[0]) throw new HttpError(404, "Document not found.");
  return toDoc(rows[0], rows[0].role as Role);
}

export async function createDoc(userId: string, title: unknown = "Untitled document", content: unknown = ""): Promise<Doc> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await (await db()).execute({
    sql: "INSERT INTO documents (id, owner_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, userId, cleanTitle(title), cleanContent(content), now, now],
  });
  return getDoc(id, userId);
}

// Optimistic concurrency: the client sends the version it loaded. If someone saved in between,
// the update matches zero rows and we return 409 instead of silently overwriting their work.
export async function updateDoc(
  docId: string,
  userId: string,
  patch: { title?: unknown; content?: unknown; version?: unknown },
): Promise<Doc> {
  const doc = await getDoc(docId, userId);
  if (doc.role === "viewer") throw new HttpError(403, "You have view-only access to this document.");
  if (typeof patch.version !== "number") throw new HttpError(400, "Version is required.");
  const title = patch.title === undefined ? doc.title : cleanTitle(patch.title);
  const content = patch.content === undefined ? doc.content : cleanContent(patch.content);
  const res = await (await db()).execute({
    sql: `UPDATE documents SET title = ?, content = ?, version = version + 1, updated_at = ?
          WHERE id = ? AND version = ?`,
    args: [title, content, new Date().toISOString(), docId, patch.version],
  });
  if (res.rowsAffected === 0) {
    throw new HttpError(409, "This document was changed by someone else. Reload to get the latest version.");
  }
  return getDoc(docId, userId);
}

export async function deleteDoc(docId: string, userId: string): Promise<void> {
  const doc = await getDoc(docId, userId);
  if (doc.role !== "owner") throw new HttpError(403, "Only the owner can delete this document.");
  await (await db()).batch(
    [
      { sql: "DELETE FROM shares WHERE document_id = ?", args: [docId] },
      { sql: "DELETE FROM documents WHERE id = ?", args: [docId] },
    ],
    "write",
  );
}

async function requireOwner(docId: string, userId: string) {
  const doc = await getDoc(docId, userId);
  if (doc.role !== "owner") throw new HttpError(403, "Only the owner can manage sharing.");
  return doc;
}

export async function listShares(docId: string, userId: string): Promise<Share[]> {
  await getDoc(docId, userId); // anyone with access can see who else has access
  const { rows } = await (await db()).execute({
    sql: `SELECT s.user_id, s.role, u.name, u.email FROM shares s JOIN users u ON u.id = s.user_id
          WHERE s.document_id = ? ORDER BY u.name`,
    args: [docId],
  });
  return rows.map((r) => ({
    userId: String(r.user_id),
    name: String(r.name),
    email: String(r.email),
    role: r.role as Share["role"],
  }));
}

// Upsert: sharing again with a different role changes the role.
export async function shareDoc(docId: string, ownerId: string, email: unknown, role: unknown): Promise<Share[]> {
  const doc = await requireOwner(docId, ownerId);
  if (role !== "viewer" && role !== "editor") throw new HttpError(400, "Role must be 'viewer' or 'editor'.");
  if (typeof email !== "string" || !email.trim()) throw new HttpError(400, "Enter an email address.");
  const { rows } = await (await db()).execute({
    sql: "SELECT id FROM users WHERE email = ? COLLATE NOCASE",
    args: [email.trim()],
  });
  if (!rows[0]) throw new HttpError(404, `No user with email ${email.trim()}.`);
  const targetId = String(rows[0].id);
  if (targetId === doc.ownerId) throw new HttpError(400, "You already own this document.");
  await (await db()).execute({
    sql: `INSERT INTO shares (document_id, user_id, role) VALUES (?, ?, ?)
          ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role`,
    args: [docId, targetId, role],
  });
  return listShares(docId, ownerId);
}

export async function unshareDoc(docId: string, ownerId: string, targetUserId: unknown): Promise<Share[]> {
  await requireOwner(docId, ownerId);
  if (typeof targetUserId !== "string") throw new HttpError(400, "userId is required.");
  await (await db()).execute({
    sql: "DELETE FROM shares WHERE document_id = ? AND user_id = ?",
    args: [docId, targetUserId],
  });
  return listShares(docId, ownerId);
}
