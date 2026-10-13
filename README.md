# Hearth

**Household ops for voice assistants, over MCP.** Hearth is a self-hosted [MCP](https://modelcontextprotocol.io) server (Streamable HTTP) that lets a voice assistant manage a shared household: the grocery list, chores, and bill reminders. It ships with a voice-assistant **simulator** so you can talk to it, and watch every MCP tool call happen, in a browser.

Built for the Amazon devices hackathon, **Alexa+ track** (self-hosted MCP server), with the **AWS Builder** mini challenge (Amazon Bedrock) and the **Open Source** mini challenge (MIT).

```
 you (voice / text)
        │
        ▼
┌───────────────────┐   Bedrock Converse   ┌──────────────────┐
│ Simulator (Next)  │ ───────────────────▶ │ Amazon Bedrock   │
│ app/page.tsx      │ ◀─── tool_use ────── │ (Nova Lite etc.) │
└────────┬──────────┘                      └──────────────────┘
         │ MCP over Streamable HTTP (Bearer auth)
         ▼
┌───────────────────┐        ┌──────────────────────────┐
│ MCP server        │ ─────▶ │ Neon Postgres (free)     │
│ /api/mcp          │        │ or in-memory for local   │
│ 11 household tools│        └──────────────────────────┘
└───────────────────┘
   ▲
   └── any external MCP client (an assistant, MCP Inspector, ...)
```

The simulator is just one client. Because the server speaks plain Streamable HTTP, any MCP-capable assistant can connect to the same URL.

---

## What was verified, and what was not

Be honest with the judges (and yourself) about this.

| Item | Status |
|---|---|
| `npm run build` and `tsc --noEmit` | Passed |
| 11 MCP tools, called by an MCP SDK v2 client **and** an MCP SDK 1.x client | Passed (`npm run smoke`) |
| Negotiated protocol version in testing | **2025-11-25** for both clients |
| Raw JSON-RPC `initialize` with `2025-11-25` | Passed |
| Bearer auth returns 401 without a token | Passed |
| Simulator end to end through MCP, offline brain (English + Bahasa Indonesia) | Passed |
| **Amazon Bedrock brain** | **Not tested here** (no AWS credentials in the build environment). Test it yourself in step 4 below. |
| Simulator UI in a real browser (layout, microphone, speech) | **Not tested here.** The HTML renders and the API works, but open it and look. Voice input needs Chrome or Edge. |
| Deployment on Vercel | **Not tested here.** Follow the steps and run the smoke test against your URL. |

`mcp-handler` 2.x documents native support for MCP spec 2026-07-28 with fallback to 2025-era Streamable HTTP. In my tests both clients negotiated 2025-11-25, which already satisfies the hackathon's "2025-11-25 or later". Do not claim 2026-07-28 in your submission unless you verify it.

---

## Hackathon requirements, mapped

| Requirement (Alexa+ track) | Where it is satisfied |
|---|---|
| Self-hosted MCP server, spec 2025-11-25 or later, Streamable HTTP | `app/api/mcp/route.ts` (`mcp-handler` 2.x on `@modelcontextprotocol/server` v2) |
| Repo must call the track technology in code | `route.ts` registers tools via `lib/tools.ts`; `lib/mcp-client.ts` calls them over HTTP |
| Show it in action | The simulator's "What the server did" panel shows every real tool call |
| AWS Builder mini challenge | `lib/agent.ts` uses Amazon Bedrock (Converse API with tool use) |
| Open Source mini challenge | MIT `LICENSE`. See the note in `docs/DEVPOST_SUBMISSION.md` about the "additional project" wording |
| Friction logs (up to 10% judging bonus) | Template in `docs/FRICTION_LOG.md` |

---

## Quick start (local, no accounts needed)

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local      # optional for local use
npm run dev                     # http://localhost:3000
```

With no `.env.local` values, Hearth runs with **in-memory storage** and the **offline brain** (a small rule-based parser that still calls the MCP server for every action). Open http://localhost:3000 and try "Add milk and eggs to the grocery list".

Test the server itself in a second terminal:

```bash
npm run smoke                   # defaults to http://localhost:3000
npx @modelcontextprotocol/inspector   # then connect to http://localhost:3000/api/mcp (Streamable HTTP)
```

---

## Step by step: from zero to deployed

Do these in order. Budget about 60 to 90 minutes the first time.

### Step 1. Put the code on GitHub

```bash
git init && git add . && git commit -m "Hearth: initial commit"
gh repo create hearth-mcp --public --source=. --push     # or create it on github.com and push
```

Keep the repo **public** (MIT is already included). That satisfies the "public and open source" submission option and means you do not need to add collaborators.

### Step 2. Free database (Neon)

1. Create a free project at https://neon.tech.
2. Copy the **pooled connection string** (starts with `postgresql://`).
3. Keep it for step 5 as `DATABASE_URL`. The table is created automatically on first use.

Why this is needed: Vercel functions are stateless, so in-memory data disappears between requests.

### Step 3. Generate your MCP secret

```bash
openssl rand -hex 24
```

This becomes `MCP_API_KEY`. Every call to `/api/mcp` must send `Authorization: Bearer <key>`.

### Step 4. Amazon Bedrock (the simulator's brain)

1. In the AWS console, open **Amazon Bedrock** in a region such as `us-east-1` and confirm you can use the model you want (for example Amazon Nova Lite). Some models need access granted first; check the **Model catalog** page.
2. In **IAM**, create a user (or role) with the policy in `docs/bedrock-iam-policy.json`. Create an access key for it.
3. Put these in `.env.local` to test locally:

```
APP_AWS_ACCESS_KEY_ID=...
APP_AWS_SECRET_ACCESS_KEY=...
APP_AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.amazon.nova-lite-v1:0
```

4. Run `npm run dev`, open the page, and the status line should say `brain bedrock · us.amazon.nova-lite-v1:0`. Try a free-form request such as "we're out of coffee, and remind me about the internet bill next Monday".

Notes:
- The `APP_AWS_*` prefix is deliberate: Vercel reserves some `AWS_*` variable names.
- `us.` model IDs are cross-region inference profiles for US regions. In other regions use the matching profile prefix or a model ID that your region offers.
- Any Bedrock model with Converse **tool use** support works. Check current model availability and pricing in the AWS console, because both change.
- Use a dedicated, least-privilege IAM user and rotate the key after the hackathon.

### Step 5. Deploy on Vercel

1. Sign in at https://vercel.com with GitHub and choose **Add New, Project**, then import the repo. The Next.js preset is detected automatically.
2. Under **Environment Variables**, add (for Production):

| Name | Value |
|---|---|
| `MCP_API_KEY` | from step 3 |
| `DATABASE_URL` | from step 2 |
| `APP_AWS_ACCESS_KEY_ID` | from step 4 |
| `APP_AWS_SECRET_ACCESS_KEY` | from step 4 |
| `APP_AWS_REGION` | `us-east-1` |
| `BEDROCK_MODEL_ID` | `us.amazon.nova-lite-v1:0` |
| `HOUSEHOLD_TIMEZONE` | `Asia/Jakarta` (or yours) |
| `ALLOW_DEMO_RESET` | `1` (only while recording; remove afterwards) |

3. Click **Deploy**. Your server is at `https://<project>.vercel.app/api/mcp`.
4. Use the main production domain (`<project>.vercel.app`), not a per-deployment preview URL. If you get an HTML login page instead of JSON, check **Settings, Deployment Protection**.
5. Check Vercel's current Hobby plan limits and terms (function duration, and the non-commercial-use rule). `route.ts` sets `maxDuration = 60`.

### Step 6. Verify the live deployment

```bash
BASE_URL=https://<project>.vercel.app MCP_API_KEY=<your key> npm run smoke
```

Every line should show a check mark. This is also your proof that the server works over the public internet.

### Step 7. Connect an external client (optional but impressive)

Point any MCP client that supports remote Streamable HTTP servers at `https://<project>.vercel.app/api/mcp` with the header `Authorization: Bearer <key>`. Showing a second, independent client calling your tools makes the "this is a real MCP server" point for the judges. Also read the hackathon's **Resources** page for any Alexa+-specific onboarding or registration step; this repo cannot know those details.

### Step 8. Record, write, submit

Follow `docs/DEMO_SCRIPT.md`, fill in `docs/DEVPOST_SUBMISSION.md`, and keep `docs/FRICTION_LOG.md` honest.

---

## Tool reference

| Tool | What it does |
|---|---|
| `add_grocery_item` | Adds an item (no duplicates), optional quantity |
| `list_groceries` | Lists unbought items, optionally including bought |
| `check_off_grocery` | Marks an item bought (partial name match) |
| `clear_checked_groceries` | Removes all bought items |
| `add_chore` | Creates a chore with optional assignee and due date |
| `list_chores` | Filters by assignee and status |
| `complete_chore` | Marks a chore done (partial title match) |
| `add_bill_reminder` | Stores a bill with due date and optional amount (default currency IDR) |
| `list_bills` | Unpaid bills, soonest first, overdue flagged |
| `mark_bill_paid` | Marks a bill paid (partial name match) |
| `household_summary` | Morning-briefing overview of everything |

Design choices worth mentioning in your write-up: tools take human names rather than ids, dates are ISO so the model resolves "Friday" itself, ambiguous matches return the candidates so the assistant can ask a follow-up, and tool annotations mark read-only and destructive tools.

## Project layout

```
app/api/mcp/route.ts     the MCP server (Streamable HTTP, bearer auth)
app/api/chat/route.ts    simulator backend: runs the agent loop
app/api/state/route.ts   read-only snapshot for the household board
app/page.tsx             simulator UI (voice in, spoken replies, MCP trace)
lib/tools.ts             the 11 MCP tools
lib/store.ts             storage: Neon Postgres or in-memory
lib/agent.ts             Bedrock Converse tool-use loop
lib/mcp-client.ts        MCP client over Streamable HTTP
lib/offline.ts           rule-based fallback brain (EN + ID)
scripts/smoke-test.mjs   end-to-end checks against any deployment
docs/                    submission drafts, demo script, friction log, IAM policy
```

## Security notes

- `/api/mcp` is protected by `MCP_API_KEY`. **Set it before deploying.** Without it the endpoint is open.
- `/api/state` and `/api/chat` are intentionally public so judges can try the simulator, which means anyone with the URL can read and change the demo data. Use only fake data.
- `ALLOW_DEMO_RESET=1` lets anyone wipe the data. Remove it after recording.
- The chat route uses your AWS credentials, so a public URL can run up Bedrock charges. Set an AWS budget alert, and consider removing the credentials from Vercel after judging.
- Never commit `.env.local`. It is in `.gitignore`.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Items vanish on Vercel | `DATABASE_URL` is not set, so the in-memory store is in use |
| `401` from `/api/mcp` | Missing or wrong `Authorization: Bearer` header |
| Simulator says "Could not reach the MCP server" | `MCP_API_KEY` set in one place but not the other, or Vercel Deployment Protection is blocking the URL |
| Bedrock `AccessDeniedException` | Model access not granted, or IAM policy missing |
| Bedrock `ValidationException` about the model ID | Region and inference-profile prefix do not match; use a model ID your region offers |
| "Voice input isn't available" | Use Chrome or Edge, and allow the microphone. Typing always works |
| `npm install` peer-dependency errors | `mcp-handler` 2.x needs `@modelcontextprotocol/server` 2.x and `zod` 4.x. Do not mix with `@modelcontextprotocol/sdk` 1.x on the server side |

## Make it yours (what separates a win from a demo)

1. Add one tool that is genuinely clever, such as `suggest_meals_from_groceries` or `split_bills_between_housemates`.
2. Per-household data: add a `household` column and pass it through a header or OAuth token.
3. Proactive reminders: a Vercel cron that checks `list_bills` and pushes a notification.
4. Write 3 to 5 tests of tool edge cases (ambiguous names, bad dates) and show them passing in the video.

## License

MIT. See `LICENSE`.
# AmazonDevProject
