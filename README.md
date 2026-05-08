# OpenScope

**OpenScope: Real-Time Visualization for Monitoring and Steering Open Code Harness**

Web dashboard for **[OpenCode](https://opencode.ai/)**. It connects to a local OpenCode HTTP server (REST + Server-Sent Events) so you can work across directories, inspect live message streams, todos, planner-style subtasks, and agent action-flow diagrams—with cross-links between todos, transcripts, and individual flow glyphs.

---

## What's included

- **Multi-directory sessions** via `x-opencode-directory`, aligned with how OpenCode labels workspaces from the CLI.
- **Realtime harness UI**: streamed assistant turns, todos and `todo_write` batch replay, approve/reject for question tooling.
- **Subtask linkage**: optional connectors from todo rows into a linked card **or into the focused action** when one is selected.
- **Action-flow diagrams**: orthogonal / treemap layout (d3), type-based coloring, fork and deep-dive tooling.
- **Session operations**: rename, fork, SSE with polling fallback, optional outbound harness guidance prefix on user prompts.

---

## How to install and run

### 1. Install the OpenCode CLI

OpenScope expects OpenCode serving an **HTTP headless API**. Follow the upstream install docs, then verify:

```bash
opencode --version
```

References: [OpenCode documentation](https://opencode.ai/docs/).

### 2. Run the HTTP server

```bash
opencode serve
```

Note the listener URL (often something like `http://127.0.0.1:4096`). If the port differs, mirror it inside `.env.local` (below). You may pin an explicit port, e.g.

```bash
opencode serve --port 4096
```

### 3. Configure `.env.local`

```bash
cp .env.example .env.local
```

Set the REST/SSE root to whatever `opencode serve` prints:

```env
VITE_OPENCODE_BASE=http://127.0.0.1:4096
```

| Variable | Role |
| --- | --- |
| `VITE_OPENCODE_BASE` | Base URL for every OpenScope → OpenCode call. Match this to your running CLI. |
| `VITE_OPENCODE_DEFAULT_MODEL` _(optional)_ | Force a bootstrap model as `provider/model`. Omit to inherit OpenCode’s default. |

### 4. Install dependencies and launch the UI

```bash
npm install
npm run dev
```

The SPA dev URL defaults to **[http://localhost:5173](http://localhost:5173)** (see `vite.config.ts`). Leave `opencode serve` running alongside it.

---

## Repository layout

- **`src/App.tsx`** and **`src/components/`** wire sessions, transcripts, todos, connectors, dialogs, fullscreen views.
- **`src/services/opencodeApi.ts`** is the canonical HTTP/SSE client.
- **`src/utils/`** contains folder helpers, todo materialization, SSE parsing, **`MappedAction`** construction, grouping, and forks.
- **`docs/`** stores design/integration notes outside the runtime bundle.
- **`scripts/`** holds tooling such as `smoke-opencode-session.mjs` for probing a live daemon.

Treat the authoritative API contract as the pair **running `opencode serve`** + **`src/services/opencodeApi.ts`**.

---

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · d3 · react-tooltip
