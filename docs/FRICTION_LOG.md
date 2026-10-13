# Friction log

Submissions with friction logs can earn up to a 10% judging bonus. Judges want **real** friction from **your** experience, so keep only the entries you reproduced yourself, and add your own as you go.

## Entry template

| Field | Entry |
|---|---|
| Task attempted | |
| Steps taken | |
| Expected | |
| Actual | |
| Severity | Blocker / High / Medium / Low |
| Workaround | |
| Actionable suggestion | |

## Starter entries (observed while scaffolding this project; verify before using)

### 1. Tutorials and the current `mcp-handler` disagree

| Field | Entry |
|---|---|
| Task attempted | Host an MCP server on Vercel using `mcp-handler` |
| Steps taken | Followed common tutorials: install `mcp-handler` and `@modelcontextprotocol/sdk`, call `createMcpHandler(init, serverOptions, { basePath, maxDuration })`, route at `app/api/[transport]/route.ts` |
| Expected | Code compiles and serves `/api/mcp` |
| Actual | `npm install mcp-handler` installed 2.x, which requires `@modelcontextprotocol/server` v2. TypeScript errors: `McpServer` type mismatch (TS2345) and "Expected 1-2 arguments, but got 3" (TS2554) |
| Severity | Medium |
| Workaround | Read the package README's "Migrating from 1.x" section: switch to `@modelcontextprotocol/server`, wrap `inputSchema` in `z.object(...)`, drop `basePath`/`maxDuration` options, mount the handler at the route you want |
| Actionable suggestion | Flag the 1.x to 2.x breaking change in the install section of popular guides, or print a clear runtime/peer-dependency message when 1.x-style arguments are used |

### 2. Hard to tell which protocol era you are actually speaking

| Field | Entry |
|---|---|
| Task attempted | Confirm the server is on the newest MCP spec |
| Steps taken | Connected with an SDK v2 client and an SDK 1.x client, printed the negotiated protocol version |
| Expected | The v2 client to negotiate the newest era documented as natively served (2026-07-28) |
| Actual | Both clients reported 2025-11-25 |
| Severity | Low |
| Workaround | Treated 2025-11-25 as the verified version |
| Actionable suggestion | Document how to force or verify the newer era from a client, and what response proves it |

### 3. Add your own

Record anything about Bedrock model access, Neon, Vercel deployment protection, the Alexa+ resources and onboarding, and anything that cost you more than 10 minutes.

## Feature requests (optional)

| Request | Why it matters | Urgency |
|---|---|---|
| | | critical / important / nice-to-have |
