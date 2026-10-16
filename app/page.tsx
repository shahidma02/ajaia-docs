"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, initials } from "@/lib/client";
import type { Doc, DocSummary, User } from "@/lib/docs";

type Session = { user: User | null; users: User[] };
type DocLists = { owned: DocSummary[]; shared: DocSummary[] };

const MAX_UPLOAD_MB = 2;

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [docs, setDocs] = useState<DocLists | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () =>
      api<Session>("/api/session")
        .then(async (s) => {
          setDocs(s.user ? await api<DocLists>("/api/documents") : null);
          setSession(s);
        })
        .catch((e) => {
          setLoadError(errorMessage(e));
          toast.error(errorMessage(e));
        }),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const signIn = (userId: string) =>
    run(async () => {
      if (userId) await api("/api/session", { method: "POST", body: { userId } });
      else await api("/api/session", { method: "DELETE" });
      await load();
    });

  const createDoc = () =>
    run(async () => {
      const doc = await api<Doc>("/api/documents", { method: "POST", body: {} });
      router.push(`/documents/${doc.id}`);
    });

  const importFile = (file: File) =>
    run(async () => {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`File is larger than the ${MAX_UPLOAD_MB} MB limit.`);
      const form = new FormData();
      form.append("file", file);
      const doc = await api<Doc>("/api/documents/import", { method: "POST", form });
      toast.success(`Imported “${file.name}”`);
      router.push(`/documents/${doc.id}`);
    });

  const deleteDoc = (d: DocSummary) =>
    run(async () => {
      if (!confirm(`Delete “${d.title}”? This cannot be undone.`)) return;
      await api(`/api/documents/${d.id}`, { method: "DELETE" });
      toast.success(`Deleted “${d.title}”`);
      await load();
    });

  if (!session) {
    return (
      <main className="center">
        {loadError ? (
          <div className="card stack">
            <p className="error">{loadError}</p>
            <button onClick={() => location.reload()}>Try again</button>
          </div>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </main>
    );
  }

  if (!session.user) {
    return (
      <main className="center">
        <div className="card signin">
          <div className="brand">
            <span className="logo-mark"><FileText size={20} /></span>
            <h1>Ajaia Docs</h1>
          </div>
          <p className="muted">Choose a demo account to continue. This is mock sign-in for review, so there are no passwords.</p>
          <div className="stack">
            {session.users.map((u) => (
              <button key={u.id} className="user-pick" disabled={busy} onClick={() => signIn(u.id)}>
                <span className="avatar">{initials(u.name)}</span>
                <span className="user-pick-text">
                  <strong>{u.name}</strong>
                  <span className="muted">{u.email}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="app-header">
        <span className="brand">
          <span className="logo-mark"><FileText size={18} /></span>
          <span className="logo">Ajaia Docs</span>
        </span>
        <label className="user-switch">
          <span className="avatar sm">{initials(session.user.name)}</span>
          <select value={session.user.id} disabled={busy} onChange={(e) => signIn(e.target.value)} aria-label="Switch user">
            {session.users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
            <option value="">Sign out</option>
          </select>
        </label>
      </header>

      <main className="home">
        <div className="actions">
          <button className="primary" disabled={busy} onClick={createDoc}>
            <Plus size={18} /> New document
          </button>
          <button disabled={busy} onClick={() => fileInput.current?.click()}>
            <Upload size={18} /> Import file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.md,.docx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // allow re-selecting the same file
              if (f) importFile(f);
            }}
          />
        </div>
        <p className="muted hint">Import turns a .txt, .md or .docx file (up to {MAX_UPLOAD_MB} MB) into a new editable document.</p>

        <DocSection title="My documents" docs={docs?.owned} empty="No documents yet. Create one or import a file." onDelete={deleteDoc} />
        <DocSection title="Shared with me" docs={docs?.shared} empty="Nothing has been shared with you yet." />
      </main>
    </>
  );
}

function DocSection({
  title,
  docs,
  empty,
  onDelete,
}: {
  title: string;
  docs?: DocSummary[];
  empty: string;
  onDelete?: (d: DocSummary) => void;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {!docs ? (
        <p className="muted">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="muted empty">{empty}</p>
      ) : (
        <ul className="doc-list">
          {docs.map((d) => (
            <li key={d.id}>
              <Link href={`/documents/${d.id}`} className="doc-link">
                <span className="doc-icon"><FileText size={18} /></span>
                <span className="doc-text">
                  <span className="doc-title">{d.title}</span>
                  <span className="muted">
                    {d.role === "owner" ? "" : `${d.ownerName} · `}edited {new Date(d.updatedAt).toLocaleString()}
                  </span>
                </span>
              </Link>
              {d.role !== "owner" && <span className={`badge ${d.role}`}>{d.role === "editor" ? "Can edit" : "Can view"}</span>}
              {onDelete && (
                <button className="icon-btn" onClick={() => onDelete(d)} title="Delete" aria-label={`Delete ${d.title}`}>
                  <Trash2 size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
