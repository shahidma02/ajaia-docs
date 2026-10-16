"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@/components/Editor";
import Icon from "@/components/Icon";
import SharePanel from "@/components/SharePanel";
import { toast } from "@/components/Toaster";
import { api, ApiError, errorMessage } from "@/lib/client";
import type { Doc } from "@/lib/docs";

type Status = "saved" | "dirty" | "saving" | "error" | "conflict";
const STATUS_TEXT: Record<Status, string> = {
  saved: "Saved",
  dirty: "Unsaved changes…",
  saving: "Saving…",
  error: "Save failed — retrying…",
  conflict: "Not saved — document changed elsewhere",
};
const SAVE_DELAY_MS = 800; // save once typing pauses…
const MAX_WAIT_MS = 5000; // …but at least this often during non-stop typing

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
  const dirtySince = useRef(0);

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
          toast(`Couldn't save: ${errorMessage(e)}`);
          setStatus("error");
          return;
        }
      }
    });
  }, [id]);

  const queue = useCallback(
    (patch: { title?: string; content?: string }) => {
      if (conflicted.current) return;
      if (Object.keys(pending.current).length === 0) dirtySince.current = Date.now();
      Object.assign(pending.current, patch);
      setStatus("dirty");
      clearTimeout(timer.current);
      const overdue = Date.now() - dirtySince.current >= MAX_WAIT_MS;
      timer.current = setTimeout(flush, overdue ? 0 : SAVE_DELAY_MS);
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
        <div className="card stack">
          <p className="error">{loadError}</p>
          <Link href="/" className="row"><Icon name="back" /> Back to documents</Link>
        </div>
      </main>
    );
  }
  if (!doc) return <main className="center"><p className="muted">Loading document…</p></main>;

  const editable = doc.role !== "viewer";

  return (
    <>
      <header className="doc-header">
        <Link href="/" className="icon-btn" title="All documents" aria-label="Back to all documents">
          <Icon name="back" size={20} />
        </Link>
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
          {status === "saved" && editable && <Icon name="check" size={14} />}
          {!editable ? "View only" : saveError ? `Not saved: ${saveError}` : STATUS_TEXT[status]}
        </span>
        <span className={`badge ${doc.role}`}>
          {doc.role === "owner" ? "Owner" : doc.role === "editor" ? "Shared · can edit" : "Shared · can view"}
        </span>
        <button className="primary" onClick={() => setShowShare((v) => !v)} aria-expanded={showShare}>
          <Icon name={doc.role === "owner" ? "share" : "users"} size={16} />
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
