# AI workflow note

## Tools

- **Claude Code** (Claude Opus 5.5, in the Claude desktop app) as a pair programmer for planning, implementation, debugging and verification. Its built-in browser let it click through the app, take screenshots, and measure layout with JavaScript.
- Tests, lint, typecheck and production builds ran locally after every change. I tested the deployed site manually against a written test plan.

## How I worked with it

I treated the AI as a fast implementer and kept product and engineering decisions with me:

1. **Scope first.** I pasted the brief and had it propose a stack and a scoped plan. I chose the deployment path (Vercel + Turso, over Neon or Render) based on reviewer setup cost and data persistence.
2. **Build in vertical slices:** data layer and access checks → API → UI → import → tests → deploy, with a working app at every step.
3. **Verify every step** before moving on: curl calls for each API status code, browser checks, automated tests.
4. **Review the output critically:** I asked it to explain decisions (e.g. how autosave is throttled), challenged UI details, and pushed back where it hand-rolled things a library does better.

## Where AI materially sped things up

- **Scaffolding and boilerplate:** Next.js 16 project, route handlers, SQL schema and queries. It read the bundled Next.js 16 docs first, because this version changed several APIs.
- **The editor toolbar and autosave logic:** debounce, max-wait, retry with backoff, and version-based conflict detection.
- **The test suite:** 9 focused tests on access control and import, written against a temporary database.
- **Debugging with evidence:** it found the root cause of an off-center sign-in card (a CSS grid track-sizing quirk) and confirmed the fix by measuring the card's position, not just by looking.
- **Deployment and docs:** step-by-step Vercel + Turso instructions and first drafts of these documents.

## What I changed or rejected

| AI output                                                                             | What I did                                               | Why                                                                                                                 |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Hand-written toast component                                                          | Replaced with **Sonner**                                 | A maintained library beats custom code for commodity UI                                                             |
| Hand-written SVG icon set                                                             | Replaced with **lucide-react**                           | Same reason; less code to own                                                                                       |
| Inline "Loading…" text                                                                | Asked for a circular **spinner**                         | Text felt unfinished                                                                                                |
| Share list that grew as members loaded                                                | Asked for a **loading skeleton** so it wouldn't jump     | The AI suggested returning a share count with each document, so the skeleton shows exactly the right number of rows |
| Share panel on mobile                                                                 | Reported it opened off-screen at the bottom              | Now a bottom sheet with a backdrop                                                                                  |
| Off-center sign-in, misaligned dropdown arrows, a row that flashed in the share panel | Caught these in manual testing and had them fixed        | Polish the AI's own checks missed                                                                                   |
| Large page and doc-page files                                                         | Asked for a componentization review                      | Shared `Avatar`, `RoleBadge`/`RoleSelect`, `Skeleton`, `DocList`, `SignInCard`, and a `useAutosave` hook            |
| Real-time co-editing                                                                  | Asked about the cost, then deliberately deprioritized it | Needs a WebSocket server and CRDTs; 3+ hours of risk to the core                                                    |

Places where the AI corrected itself after verification:

- Its first API smoke-test script silently failed because of a shell quirk (zsh doesn't word-split variables); it noticed the bogus results and rewrote the script.
- React 19's stricter lint rules rejected two of its first hook patterns; it restructured the save-retry loop instead of disabling the rules.
- In a final self-review it found that **saving documents over 64 KB failed**: browsers cap `keepalive` requests at 64 KB. It reproduced the bug with a 78 KB document before fixing it. It also found that .docx images were being inlined as huge base64 text.

## How I verified correctness, UX and reliability

- **Automated:** `pnpm test` (9 Vitest tests: 404 for no access, viewer 403, editor limits, 409 on stale saves, revocation, validation, import safety and limits). Lint, typecheck and a production build pass.
- **API:** curl checks for the key status codes (400, 401, 403, 404, 409, 415) and for HTML escaping on import. Size limits (413) are covered by the automated tests.
- **UI:** browser checks of each flow, including JavaScript measurements for layout claims (centering, no height jump between skeleton and loaded list), a phone-sized viewport, and the slowed-down loading states.
- **Deployed site:** I ran a 30+ case manual test plan (sign-in, editing, formatting, persistence, import, sharing roles, access denial, conflicting edits, delete, mobile) and a shorter smoke test after each deploy.
