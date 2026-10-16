"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import DocList from "@/components/DocList";
import Logo from "@/components/Logo";
import SignInCard from "@/components/SignInCard";
import Spinner from "@/components/Spinner";
import { api, errorMessage } from "@/lib/client";
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
          <Spinner />
        )}
      </main>
    );
  }

  if (!session.user) {
    return (
      <main className="center">
        <SignInCard users={session.users} busy={busy} onPick={signIn} />
      </main>
    );
  }

  return (
    <>
      <header className="app-header">
        <Logo />
        <label className="user-switch">
          <Avatar name={session.user.name} small />
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

        <DocList title="My documents" docs={docs?.owned ?? []} empty="No documents yet. Create one or import a file." onDelete={deleteDoc} />
        <DocList title="Shared with me" docs={docs?.shared ?? []} empty="Nothing has been shared with you yet." />
      </main>
    </>
  );
}
