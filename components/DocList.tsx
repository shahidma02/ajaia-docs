import { FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import { RoleBadge } from "@/components/Role";
import type { DocSummary } from "@/lib/docs";

export default function DocList({
  title,
  docs,
  empty,
  onDelete,
}: {
  title: string;
  docs: DocSummary[];
  empty: string;
  onDelete?: (d: DocSummary) => void;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {docs.length === 0 ? (
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
              {d.role !== "owner" && <RoleBadge role={d.role} />}
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
