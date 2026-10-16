# Submission: Ajaia AI-Native Full Stack Developer Assignment

**Candidate:** Amena Shahid

## Links

|                       |                                          |
| --------------------- | ---------------------------------------- |
| **Live app**          | https://ajaia-docs-puce.vercel.app/      |
| **Walkthrough video** | See [`VIDEO_URL.txt`](VIDEO_URL.txt)     |
| **Source (GitHub)**   | https://github.com/shahidma02/ajaia-docs |

## Test accounts

No passwords: pick an account on the sign-in screen, and switch accounts from the top-right dropdown.

| Account                         | Use it to                                                     |
| ------------------------------- | ------------------------------------------------------------- |
| `alice@ajaia.test` (Alice Chen) | Owner of "Welcome to Ajaia Docs"; create, share, delete       |
| `bob@ajaia.test` (Bob Okafor)   | Already has **edit** access to the Welcome doc                |
| `carol@ajaia.test` (Carol Diaz) | Starts with nothing shared; good for testing view-only access |

**5-minute review path:** sign in as Alice → open the Welcome doc and edit/format → **Share** with `carol@ajaia.test` as _Can view_ → switch to Carol and confirm it's read-only → back as Alice, **Import file** with a .docx/.md/.txt → **Export PDF**.

## What's in this folder

| Item              | Description                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Source code       | `app/`, `components/`, `hooks/`, `lib/`, `tests/`, `package.json`, `pnpm-lock.yaml` and config files (Next.js + TypeScript) |
| `README.md`       | Features, local setup and run instructions, tests, deployment                                                               |
| `ARCHITECTURE.md` | What I prioritized and why, data model, access rules, trade-offs, next steps                                                |
| `AI_WORKFLOW.md`  | AI tools used, where they helped, what I changed or rejected, how I verified                                                |
| `SUBMISSION.md`   | This file                                                                                                                   |
| `VIDEO_URL.txt`   | Link to the 3–5 minute walkthrough                                                                                          |

Setup needs no extra steps (`pnpm install && pnpm dev`, no database or env vars locally), so no screenshots are required to run it.

## Status

**Working end to end (local and deployed):**

- Create, rename, edit, delete documents; autosave; reopen after refresh
- Rich text: bold, italic, underline, H1–H3, bulleted/numbered lists, undo/redo
- Import .txt / .md / .docx (≤ 2 MB) as a new editable document
- Sharing with **Owner / Can edit / Can view** roles, enforced server-side; owned vs. shared lists
- Conflict protection: stale saves are rejected (409) instead of overwriting
- Export to PDF (print layout)
- 9 automated tests (`pnpm test`)

**Optional stretch completed:** role-based sharing beyond basic access (editor vs. viewer), plus PDF export.

**Intentionally not built / incomplete:**

- Real-time co-editing: concurrent edits are detected, not merged
- Real authentication: seeded accounts with a mock session cookie
- Images, tables, comments, version history
