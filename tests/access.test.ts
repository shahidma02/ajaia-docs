import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Fresh SQLite file per run; must be set before lib/db reads it.
const dir = mkdtempSync(join(tmpdir(), "ajaia-test-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;

const docs = await import("../lib/docs");
const { fileToDoc } = await import("../lib/importer");

const status = (p: Promise<unknown>) => p.then(() => 200, (e) => e.status);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("document access control", () => {
  let id: string;
  beforeAll(async () => {
    id = (await docs.createDoc("alice", "Q4 plan", "<p>draft</p>")).id;
  });

  it("hides a document from users it was not shared with (404, not 403)", async () => {
    expect(await status(docs.getDoc(id, "bob"))).toBe(404);
    expect((await docs.listDocs("bob")).owned.map((d) => d.id)).not.toContain(id);
  });

  it("viewer can read but not edit, and sees it under 'shared'", async () => {
    await docs.shareDoc(id, "alice", "BOB@ajaia.test", "viewer"); // email match is case-insensitive
    const doc = await docs.getDoc(id, "bob");
    expect(doc.role).toBe("viewer");
    expect(await status(docs.updateDoc(id, "bob", { content: "<p>hack</p>", version: doc.version }))).toBe(403);
    expect((await docs.listDocs("bob")).shared.map((d) => d.id)).toContain(id);
  });

  it("re-sharing upgrades the role; editor can save but not manage sharing or delete", async () => {
    await docs.shareDoc(id, "alice", "bob@ajaia.test", "editor");
    const doc = await docs.getDoc(id, "bob");
    const saved = await docs.updateDoc(id, "bob", { content: "<p>bob was here</p>", version: doc.version });
    expect(saved.content).toBe("<p>bob was here</p>");
    expect(await status(docs.shareDoc(id, "bob", "carol@ajaia.test", "editor"))).toBe(403);
    expect(await status(docs.deleteDoc(id, "bob"))).toBe(403);
  });

  it("rejects a stale save instead of overwriting someone else's edit (409)", async () => {
    const { version } = await docs.getDoc(id, "alice");
    await docs.updateDoc(id, "bob", { content: "<p>bob first</p>", version });
    expect(await status(docs.updateDoc(id, "alice", { content: "<p>alice late</p>", version }))).toBe(409);
    expect((await docs.getDoc(id, "alice")).content).toBe("<p>bob first</p>");
  });

  it("revoking access removes it immediately", async () => {
    await docs.unshareDoc(id, "alice", "bob");
    expect(await status(docs.getDoc(id, "bob"))).toBe(404);
  });

  it("validates input", async () => {
    expect(await status(docs.createDoc("alice", "   "))).toBe(400);
    expect(await status(docs.shareDoc(id, "alice", "nobody@ajaia.test", "editor"))).toBe(404);
    expect(await status(docs.shareDoc(id, "alice", "bob@ajaia.test", "admin"))).toBe(400);
    expect(await status(docs.shareDoc(id, "alice", "alice@ajaia.test", "editor"))).toBe(400);
  });
});

describe("file import", () => {
  it("escapes HTML in .txt and keeps paragraphs", async () => {
    const { title, html } = await fileToDoc("notes.txt", Buffer.from("Hi <script>x</script>\n\nline1\nline2"));
    expect(title).toBe("notes");
    expect(html).toBe("<p>Hi &lt;script&gt;x&lt;/script&gt;</p><p>line1<br>line2</p>");
  });

  it("converts markdown structure", async () => {
    const { html } = await fileToDoc("a.md", Buffer.from("# Title\n\n- **one**"));
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>one</strong>");
  });

  it("rejects unsupported, empty and oversized files", async () => {
    expect(await status(fileToDoc("a.pdf", Buffer.from("x")))).toBe(415);
    expect(await status(fileToDoc("a.txt", Buffer.alloc(0)))).toBe(400);
    expect(await status(fileToDoc("a.txt", Buffer.alloc(3 * 1024 * 1024, 97)))).toBe(413);
    expect(await status(fileToDoc("broken.docx", Buffer.from("not a zip")))).toBe(400);
  });
});
