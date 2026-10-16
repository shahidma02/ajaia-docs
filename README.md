# Ajaia Docs

A lightweight collaborative document editor: create and format documents, import files, and share them with other users as editors or viewers.

**Live demo:** https://ajaia-docs-puce.vercel.app/

| Demo account | Email              | Notes                                       |
| ------------ | ------------------ | ------------------------------------------- |
| Alice Chen   | `alice@ajaia.test` | Owns the "Welcome to Ajaia Docs" document   |
| Bob Okafor   | `bob@ajaia.test`   | Has **edit** access to the Welcome document |
| Carol Diaz   | `carol@ajaia.test` | Starts with no shared documents             |

Sign-in is mocked: pick an account on the start screen (no password). Switch accounts from the dropdown in the top-right to see sharing from the other side.

## Features

- **Documents:** create, rename, edit, delete. Autosaves while you type; reopen any time.
- **Rich text:** bold, italic, underline, headings (H1–H3), bulleted and numbered lists, undo/redo. Keyboard shortcuts (⌘B/I/U) and markdown shortcuts (`# `, `- `, `1. `) work too.
- **File import:** upload **.txt, .md or .docx (max 2 MB)** to create a new editable document. Images inside .docx files are not imported.
- **Sharing:** owners share by email as **Can edit** or **Can view**, change roles, or remove access. The home page separates **My documents** from **Shared with me**.
- **Safe concurrent saves:** if someone else saved the document after you opened it, your save is rejected with a "Reload latest version" banner instead of silently overwriting their work.
- **Export to PDF:** the "Export PDF" button opens the browser print dialog with a clean, document-only layout.

## Run locally

Requirements: Node.js 20.9+ and pnpm (`corepack enable` installs it).

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. No database setup or environment variables are needed: locally the app uses a SQLite file (`local.db`) that is created and seeded with the demo accounts on first request. Delete `local.db` (with the server stopped) to reset.

| Command                    | What it does                     |
| -------------------------- | -------------------------------- |
| `pnpm dev`                 | Start the dev server             |
| `pnpm test`                | Run the automated tests (Vitest) |
| `pnpm lint`                | Lint                             |
| `pnpm build && pnpm start` | Production build and server      |

## Deployment

Deployed on **Vercel** with a **Turso** database (hosted libSQL, SQLite-compatible), both on free tiers. The same code runs locally and in production; the only difference is two environment variables:

| Variable             | Value                                |
| -------------------- | ------------------------------------ |
| `TURSO_DATABASE_URL` | `libsql://<db-name>-<org>.turso.io`  |
| `TURSO_AUTH_TOKEN`   | A read/write token for that database |

To deploy your own copy: create a Turso database, import this repo into Vercel, add the two variables, and deploy. Tables and demo data are created automatically on the first request.

## Tests

`pnpm test` runs 9 tests in [`tests/access.test.ts`](tests/access.test.ts) against a temporary SQLite database:

- documents are invisible (404) to users they weren't shared with
- viewers can read but not edit; editors can edit but not share or delete
- re-sharing changes the role; revoking access takes effect immediately
- a save based on an outdated version is rejected (409) and doesn't overwrite newer content
- input validation (empty titles, unknown emails, invalid roles, sharing with yourself)
- file import: HTML in .txt is escaped, markdown keeps its structure, and unsupported, empty, oversized or corrupt files are rejected

## Project structure

```
app/
  page.tsx                  Home: sign-in, document lists, new/import
  documents/[id]/page.tsx   Editor page: title, toolbar, autosave status, share, export
  api/                      REST endpoints (see ARCHITECTURE.md)
components/                 Editor, SharePanel, DocList, SignInCard, Role badge/select, Avatar, Skeleton, Spinner, Logo
hooks/useAutosave.ts        Debounced autosave with retries and conflict detection
lib/
  db.ts                     Database client + schema + demo seed
  docs.ts                   All document/sharing queries and access checks
  importer.ts               .txt / .md / .docx → HTML
  auth.ts                   Mock session (cookie)
  http.ts, client.ts        Server error handling / browser fetch helper
tests/access.test.ts        Automated tests
```

## Known limitations

- **Mock authentication.** The session cookie holds a user id and isn't signed. Fine for a demo with seeded accounts; real auth is the first next step.
- **No real-time co-editing.** Concurrent edits are detected and rejected (409), not merged. See ARCHITECTURE.md for the trade-off.
- **No images** in documents; .docx images are dropped on import.
- **The Welcome document is re-created** if deleted, whenever a new server instance starts, so reviewers always have a sample.

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions and [AI_WORKFLOW.md](AI_WORKFLOW.md) for how AI was used.
