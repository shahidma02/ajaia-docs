# Architecture note

## What I prioritized

With a few hours available, I aimed for **one coherent product slice that works end to end** rather than many shallow features. In priority order:

1. **Editing that feels trustworthy:** rich text that autosaves, survives refresh, and never silently loses or overwrites work.
2. **Sharing with real access control:** enforced on the server for every request, not just hidden in the UI.
3. **Useful file import:** turn existing .txt / .md / .docx files into editable documents.
4. **A deploy reviewers can use immediately:** seeded accounts and a one-click user switcher so the sharing flow can be tested in seconds.

## Shape of the system

```
Browser (Next.js client pages + Tiptap editor)
   │  fetch JSON / multipart
   ▼
Next.js route handlers (app/api/*)  ── requireUser() reads session cookie
   │
   ▼
lib/docs.ts  ── every query + every access check lives here
   │
   ▼
libSQL: SQLite file locally, Turso in production (same SQL, same client)
```

One Next.js app holds both the frontend and the API, so there's a single codebase and a single deploy. All authorization goes through `lib/docs.ts`; route handlers stay thin (parse input, call one function, return JSON).

## Key decisions

| Decision                                                     | Why                                                                                                               | Trade-off                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Next.js + Vercel**                                         | Frontend and API in one repo; free, zero-config deploys                                                           | Serverless functions can't hold WebSockets (affects real-time, below) |
| **libSQL (SQLite) locally, Turso in production**             | Zero setup for reviewers running locally (just a file); identical SQL in prod                                     | Smaller ecosystem than Postgres; fine at this scale                   |
| **Tiptap editor, content stored as HTML**                    | Mature editor; formatting round-trips cleanly; imported files convert straight to HTML                            | HTML from clients isn't trusted for rendering; see Security           |
| **Mock auth with seeded users**                              | The brief allows it, and it lets reviewers test sharing instantly                                                 | Not secure (cookie isn't signed); real auth is the first next step    |
| **Optimistic concurrency** (a `version` number per document) | Two people editing can't silently overwrite each other: a stale save gets HTTP 409 and the user is told to reload | Conflicts are detected, not merged                                    |
| **Server-side file conversion, original file not stored**    | Validation (type, 2 MB limit) happens where it can't be bypassed; no blob storage to set up or pay for            | Can't download the original file later                                |
| **PDF export via the browser's print dialog**                | A print stylesheet gives a clean PDF with no PDF library or server rendering                                      | User goes through the print dialog                                    |

## Data model

```
users     (id, name, email UNIQUE)
documents (id, owner_id → users, title, content HTML, version, created_at, updated_at)
shares    (document_id → documents, user_id → users, role 'viewer'|'editor', PK(document_id, user_id))
```

Schema and demo data are created idempotently on the first request (`CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`). A migration tool would be the next step once the schema starts changing.

## Access rules (enforced in `lib/docs.ts`)

| Action                       | Owner | Editor | Viewer | No access |
| ---------------------------- | ----- | ------ | ------ | --------- |
| Open / read                  | ✓     | ✓      | ✓      | 404       |
| Edit content / rename        | ✓     | ✓      | 403    | 404       |
| See who has access           | ✓     | ✓      | ✓      | 404       |
| Share / change role / remove | ✓     | 403    | 403    | 404       |
| Delete                       | ✓     | 403    | 403    | 404       |

Users without access get **404 rather than 403**, so document ids don't reveal that a document exists.

## Saving

`hooks/useAutosave.ts` batches edits and saves **0.8 s after typing pauses**, and at least **every 5 s** during continuous typing. Saves run one at a time. Each save sends the version the client last saw; the server only updates `WHERE version = ?`. Network or 5xx failures retry with backoff (1 s, 2 s, 4 s), while 4xx errors surface to the user immediately. Unsaved edits trigger the browser's "leave page?" warning.

## API

| Method & path                               | Purpose                                          |
| ------------------------------------------- | ------------------------------------------------ |
| `GET/POST/DELETE /api/session`              | Current user + seeded users / sign in / sign out |
| `GET/POST /api/documents`                   | List owned + shared / create                     |
| `GET/PATCH/DELETE /api/documents/:id`       | Read / save (title, content, version) / delete   |
| `GET/POST/DELETE /api/documents/:id/shares` | List / add or change role / remove access        |
| `POST /api/documents/import`                | Upload .txt/.md/.docx → new document             |

Errors are JSON `{ "error": "…" }` with a meaningful status; the UI shows them as toasts.

## Security notes

- **Stored HTML is never injected raw.** It's only rendered through Tiptap's schema, which drops scripts, unknown tags and attributes. Text from .txt imports is HTML-escaped.
- **All access checks happen on the server.** The UI hiding a button is a convenience, not the protection.
- **Input limits:** title ≤ 200 characters, content ≤ 1 MB, upload ≤ 2 MB, role must be `viewer` or `editor`.
- **Not done:** real auth, rate limiting, audit logging.

## What I deliberately cut

- **Real-time co-editing.** It needs a merge layer (CRDT, e.g. Yjs) plus a persistent WebSocket server, which Vercel functions can't host. That's 3+ hours and new infrastructure, and it would have put the core slice at risk. Conflict detection (409 + reload) covers the data-safety part.
- **Real authentication.** Seeded accounts demonstrate sharing faster for reviewers.
- **Images, tables, comments, version history.** Each is a feature in its own right; I chose depth in editing, sharing and import instead.
