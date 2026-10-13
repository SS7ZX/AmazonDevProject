# Demo video script (target 2:30, hard limit under 3:00)

Judges are not required to watch past 3:00, so the working demo must start in the first 20 seconds.

## Before you record

- [ ] Deployed on Vercel, `npm run smoke` passes against the live URL
- [ ] `status` line shows `brain bedrock` and an MCP protocol version
- [ ] Click **Clear demo data** for a clean slate (needs `ALLOW_DEMO_RESET=1`), then remove that variable afterwards
- [ ] Chrome or Edge, microphone permission granted, volume up so replies are audible
- [ ] Browser zoom 110 to 125 percent so text is readable in the recording
- [ ] Close tabs and notifications. Hide any API keys or env var pages
- [ ] No third-party logos or copyrighted music. Use no background music, or music you have the rights to
- [ ] Video will be public on YouTube or Vimeo, in English

## Timeline

| Time | On screen | Say (adapt to your voice) |
|---|---|---|
| 0:00 to 0:15 | Simulator page, lamp visible | "This is Hearth. It lets a voice assistant run a household, and it is built on a real MCP server that I host myself." |
| 0:15 to 0:50 | Tap the lamp and say: "Add milk, eggs and bread to the grocery list." Show the right panel | "I speak, Amazon Bedrock works out what I mean, and every action you see on the right is a real MCP tool call over Streamable HTTP." Point at the trace entries and the board updating |
| 0:50 to 1:20 | Say: "Remind me to pay the electricity bill next Friday." Expand the `add_bill_reminder` call | "It turned 'next Friday' into an ISO date before calling the tool. The server stores it in Postgres." |
| 1:20 to 1:45 | Say: "Tambahin sabun cuci ke daftar belanja." (switch language to Bahasa Indonesia first) | "It works in Bahasa Indonesia too, because the tools take plain names and the model handles the language." |
| 1:45 to 2:05 | Say: "What's going on at home?" | "One question, and the `household_summary` tool gives a morning briefing." |
| 2:05 to 2:25 | Cut to a terminal running `npm run smoke` against the live URL, or MCP Inspector listing the 11 tools | "It is not tied to my simulator. A 2025-spec client and a newer SDK client both connect to the same endpoint, and it rejects calls without the bearer token." |
| 2:25 to 2:50 | Architecture slide or the README diagram | "Built with the MCP SDK v2, mcp-handler on Vercel, Neon Postgres and Amazon Bedrock. Everything is MIT licensed. Next: per-household accounts and proactive bill reminders." |

## Delivery tips

- Rehearse twice. Do the whole thing in one take, with the first request already tested.
- If a voice command is misheard on camera, keep going; the typed fallback and example chips make recovery quick. Better, practice until it works first time.
- Say what you built during the hackathon if any part pre-existed.
- Add captions if your accent or audio quality is a concern.
