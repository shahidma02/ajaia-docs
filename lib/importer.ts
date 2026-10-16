import mammoth from "mammoth";
import { marked } from "marked";
import { HttpError } from "./http";

export const IMPORT_EXTENSIONS = [".txt", ".md", ".docx"] as const;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Converts an uploaded file to editor HTML. The result is only ever rendered through the Tiptap
// schema (which drops scripts, unknown tags and attributes), never injected as raw HTML.
export async function fileToDoc(name: string, bytes: Buffer): Promise<{ title: string; html: string }> {
  const dot = name.lastIndexOf(".");
  const ext = dot === -1 ? "" : name.slice(dot).toLowerCase();
  const title = (dot === -1 ? name : name.slice(0, dot)).trim() || "Imported document";

  if (!(IMPORT_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new HttpError(415, `Unsupported file type. Upload one of: ${IMPORT_EXTENSIONS.join(", ")}.`);
  }
  if (bytes.length === 0) throw new HttpError(400, "The file is empty.");
  if (bytes.length > MAX_IMPORT_BYTES) throw new HttpError(413, "File is larger than the 2 MB limit.");

  if (ext === ".docx") {
    try {
      const { value } = await mammoth.convertToHtml({ buffer: bytes });
      return { title, html: value };
    } catch {
      throw new HttpError(400, "Could not read that .docx file. Is it a valid Word document?");
    }
  }

  const text = bytes.toString("utf8");
  if (ext === ".md") return { title, html: await marked.parse(text) };
  // .txt: blank lines separate paragraphs, single newlines become line breaks.
  const html = text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
  return { title, html };
}
