# Devpost submission draft

Replace everything in [BRACKETS]. Delete this line and the notes before pasting.

## Tracks and mini challenges entered

- Primary track: **Alexa+** (self-hosted MCP server)
- Mini challenges: **AWS Builder** (Amazon Bedrock) and **Open Source** (see the note at the bottom)

## Project name and tagline

**Hearth**: household ops for voice assistants, over MCP.

## Text description (paste this)

**Inspiration.** [One or two honest sentences about why a shared household is a good fit for a voice assistant: hands full in the kitchen, several people editing one list, bills that get forgotten.]

**What it does.** Hearth is a self-hosted MCP server that lets a voice assistant manage a shared household. It exposes 11 tools for the grocery list, chores and bill reminders, plus a morning-briefing summary. Tools take plain names ("milk", "electricity") instead of ids, dates are ISO so the model resolves "next Friday" itself, and ambiguous matches return candidates so the assistant can ask a follow-up. I also built a voice-assistant simulator, so anyone can talk to the server in a browser and watch every real MCP tool call as it happens.

**How I built it.** The server is a Next.js route using `mcp-handler` 2.x on the MCP TypeScript SDK v2, served over stateless Streamable HTTP on Vercel, with bearer-token auth. Data lives in Neon Postgres. The simulator is an MCP client: it connects to `/api/mcp` over HTTP like any external assistant would, passes the discovered tool schemas to Amazon Bedrock (Converse API with tool use), executes the model's tool calls through MCP, and speaks the answer back. It works in English and Bahasa Indonesia. A rule-based offline mode keeps the demo running without AWS credentials.

**Protocol and testing.** The server was verified with both an MCP SDK v2 client and an MCP SDK 1.x client (negotiated protocol 2025-11-25), and with a raw JSON-RPC `initialize`. `npm run smoke` runs these checks against any deployment, including auth rejection without a token.

**Challenges.** [Your real ones. Candidates: the `mcp-handler` 1.x to 2.x migration, stateless hosting forcing an external database, making tool errors recoverable for the model, handling relative dates across time zones.]

**Accomplishments.** [Keep it factual: for example "a second, independent client can use the same endpoint", "works in two languages".]

**What I learned.** [Your real learning.]

**What's next.** Per-household accounts with OAuth, proactive bill reminders on a schedule, and a meal-suggestion tool that reasons over the grocery list.

## Built with

Next.js, TypeScript, MCP TypeScript SDK v2, mcp-handler, Vercel, Neon Postgres, Amazon Bedrock, Zod

## Links

- Code repository: [https://github.com/YOU/hearth-mcp] (public, MIT licensed)
- Demo video: [YouTube or Vimeo link, public, English, under 3:00]
- Live demo: [https://YOUR-PROJECT.vercel.app]

## If the project existed before the hackathon

[Delete this section if everything was built during the submission window. Otherwise state exactly what existed before and what you built or changed during the window.]

## Product feedback (required: every tool, API or SDK you used)

Fill each block from your real experience. Specific beats polished: what you did, what happened, how long it took.

### MCP TypeScript SDK v2 and mcp-handler
- Used it for: [the server and the simulator's client]
- What worked well: [ ]
- What needs work: [ ] (see friction log entries 1 and 2 if you reproduced them)
- Onboarding (docs, setup time, samples), 1 to 5: [ ]
- Would I build with it again: [yes or no, and why]

### Alexa+ resources and documentation
- Used it for: [what you read or used from the hackathon Resources]
- What worked well / needs work: [ ]
- Onboarding, 1 to 5: [ ]
- Would I build with it again: [ ]

### Amazon Bedrock (AWS services used and how)
- Services: Amazon Bedrock Runtime, Converse API with tool use, model [YOUR MODEL ID], region [YOUR REGION]; IAM user with an `InvokeModel`-only policy
- How: the simulator discovers tool schemas from the MCP server, hands them to the model as `toolConfig`, loops on `tool_use` stop reasons, executes calls over MCP, and returns the final spoken reply
- What worked well: [ ]
- What needs work: [ ] (model access, inference profile prefixes by region, pricing clarity)
- Would I build with it again: [ ]

### Vercel (hosting) and Neon (database)
- Used them for: [hosting the server and the data]
- What worked well / needs work: [ ] (stateless functions, deployment protection, free-tier limits)

## Feature requests (optional)

| Request | Why it matters | Urgency |
|---|---|---|
| [ ] | [ ] | [critical, important or nice-to-have] |

## Friction log (optional, up to a 10% judging bonus)

Paste or attach your edited `docs/FRICTION_LOG.md`.

---

## Notes for you (do not submit)

**Repo access.** Keep the repo public with the MIT `LICENSE`; that satisfies the submission rule without adding collaborators. If you go private, add `testing@devpost.com` and the Amazon team as collaborators at submission time, and re-send any invitation older than 7 days. The list you pasted earlier included `chris-trag`, who is not on the official Amazon list; confirm who that is before granting access.

**Open Source mini challenge.** The rules say a *new, additional* open-source project or a contribution (branch, fork or PR to a public repo) alongside your primary submission. It is unclear whether your main repo alone counts. The safe move is to also ship one small extra thing, for example: a PR to an MCP or `mcp-handler` docs page fixing what tripped you up (friction entry 1), or a separate tiny repo such as an MCP-on-Vercel starter template. Confirm the wording on the Devpost rules page, and include the contribution URL, repo URL, GitHub username and a short description of what, how and why.

**Trademarks.** The UI uses no third-party logos. Keep logos and copyrighted music out of the video.

**Final check, in a logged-out browser:** repo opens, video plays, live URL loads, README steps are accurate.
