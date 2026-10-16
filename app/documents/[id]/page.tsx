"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@/components/Editor";
import SharePanel from "@/components/SharePanel";
import { api, ApiError, errorMessage } from "@/lib/client";
import type { Doc } from "@/lib/docs";

type Status = "saved" | "dirty" | "saving" | "error" | "conflict";
const STATUS_TEXT: Record<Status, string> = {
  saved: "All changes saved",
  dirty: "Unsaved changes…",
  saving: "Saving…",
  error: "Save failed — retrying…",
  conflict: "Not saved — document changed elsewhere",
};

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Status>("saved");
  const [showShare, setShowShare] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Autosave: edits accumulate in `pending`, flush after a short pause; saves run one at a time.
  const version = useRef(0);
  const pending = useRef<{ title?: string; content?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const conflicted = useRef(false);

  useEffect(() => {
    api<Doc>(`/api/documents/${id}`).then(
      (d) => {
        version.current = d.version;
        setDoc(d);
        setTitle(d.title);
      },
      (e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/");
        else setLoadError(errorMessage(e));
      },
    );
  }, [id, router]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      const patch = pending.current;
      if (conflicted.current || Object.keys(patch).length === 0) return;
      pending.current = {};
      setSaveError("");
      setStatus("saving");
      // Retry transient failures (network / 5xx) with backoff; 4xx won't fix itself, so surface it.
      for (let attempt = 0; ; attempt++) {
        try {
          const saved = await api<Doc>(`/api/documents/${id}`, {
            method: "PATCH",
            body: { ...patch, version: version.current },
            keepalive: true, // let the last save finish if the user navigates away
          });
          version.current = saved.version;
          setStatus(Object.keys(pending.current).length ? "dirty" : "saved");
          return;
        } catch (e) {
          const code = e instanceof ApiError ? e.status : 0;
          if (code === 409) {
            conflicted.current = true;
            setStatus("conflict");
            return;
          }
          if ((code === 0 || code >= 500) && attempt < 3) {
            setStatus("error");
            await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
            continue;
          }
          pending.current = { ...patch, ...pending.current }; // keep edits; next change retries
          setSaveError(errorMessage(e));
          setStatus("error");
          return;
        }
      }
    });
  }, [id]);

  const queue = useCallback(
    (patch: { title?: string; content?: string }) => {
      if (conflicted.current) return;
      Object.assign(pending.current, patch);
      setStatus("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 800);
    },
    [flush],
  );

  // Save on leave, and warn if the tab is closed with unsaved edits.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      flush();
    };
  }, [flush]);

  if (loadError) {
    return (
      <main className="center">
        <p className="error">{loadError}</p>
        <Link href="/">← Back to documents</Link>
      </main>
    );
  }
  if (!doc) return <main className="center muted">Loading document…</main>;

  const editable = doc.role !== "viewer";

  return (
    <>
      <header className="doc-header">
        <Link href="/" className="back" title="All documents">←</Link>
        <input
          className="title-input"
          value={title}
          readOnly={!editable}
          maxLength={200}
          aria-label="Document title"
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) queue({ title: e.target.value.trim() });
          }}
          onBlur={() => {
            if (!title.trim()) {
              setTitle("Untitled document");
              queue({ title: "Untitled document" });
            }
          }}
        />
        <span className={`status ${status}`} aria-live="polite">
          {!editable ? "View only" : saveError ? `Not saved: ${saveError}` : STATUS_TEXT[status]}
        </span>
        <span className={`badge ${doc.role}`}>
          {doc.role === "owner" ? "Owner" : doc.role === "editor" ? "Shared · can edit" : "Shared · can view"}
        </span>
        <button className="primary" onClick={() => setShowShare((v) => !v)}>
          {doc.role === "owner" ? "Share" : "People"}
        </button>
      </header>

      {status === "conflict" && (
        <div className="banner error" role="alert">
          Someone else saved this document after you opened it, so your latest edits were not saved.
          <button onClick={() => location.reload()}>Reload latest version</button>
        </div>
      )}
      {!editable && (
        <div className="banner">{doc.ownerName} shared this document with you as a viewer. You can read but not edit.</div>
      )}

      <div className="doc-layout">
        <main className="doc-main">
          <Editor content={doc.content} editable={editable} onChange={(html) => queue({ content: html })} />
        </main>
        {showShare && <SharePanel doc={doc} onClose={() => setShowShare(false)} />}
      </div>
    </>
  );
}
