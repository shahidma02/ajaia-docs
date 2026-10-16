"use client";

import { ArrowLeft, Check, FileDown, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Editor from "@/components/Editor";
import { RoleBadge } from "@/components/Role";
import SharePanel from "@/components/SharePanel";
import Spinner from "@/components/Spinner";
import { useAutosave, type SaveStatus } from "@/hooks/useAutosave";
import { api, ApiError, errorMessage } from "@/lib/client";
import type { Doc } from "@/lib/docs";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Saved",
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
  const [showShare, setShowShare] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const { status, error: saveError, queue, setVersion } = useAutosave(id);

  useEffect(() => {
    api<Doc>(`/api/documents/${id}`).then(
      (d) => {
        setVersion(d.version);
        setDoc(d);
        setTitle(d.title);
        setShareCount(d.shareCount);
      },
      (e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/");
        else setLoadError(errorMessage(e));
      },
    );
  }, [id, router, setVersion]);

  if (loadError) {
    return (
      <main className="center">
        <div className="card stack">
          <p className="error">{loadError}</p>
          <Link href="/" className="row"><ArrowLeft size={18} /> Back to documents</Link>
        </div>
      </main>
    );
  }
  if (!doc) return <main className="center"><Spinner label="Loading document" /></main>;

  const editable = doc.role !== "viewer";

  // ponytail: PDF export = the browser's print dialog ("Save as PDF") + print CSS that shows only the page.
  // Real file generation (server-side PDF) only if users need it without the dialog.
  const exportPdf = () => {
    const prev = document.title;
    document.title = title.trim() || "Untitled document"; // browsers use this as the default PDF file name
    window.addEventListener("afterprint", () => (document.title = prev), { once: true });
    window.print();
  };

  return (
    <>
      <header className="doc-header">
        <Link href="/" className="icon-btn" title="All documents" aria-label="Back to all documents">
          <ArrowLeft size={20} />
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
          {status === "saved" && editable && <Check size={14} />}
          {!editable ? "View only" : saveError ? `Not saved: ${saveError}` : STATUS_TEXT[status]}
        </span>
        <RoleBadge role={doc.role} />
        <button onClick={exportPdf} title="Export as PDF" aria-label="Export as PDF">
          <FileDown size={16} />
          <span className="hide-sm">Export PDF</span>
        </button>
        <button className="primary" onClick={() => setShowShare((v) => !v)} aria-expanded={showShare}>
          {doc.role === "owner" ? <UserPlus size={16} /> : <Users size={16} />}
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
        {showShare && (
          <SharePanel doc={doc} shareCount={shareCount} onShareCount={setShareCount} onClose={() => setShowShare(false)} />
        )}
      </div>
    </>
  );
}
