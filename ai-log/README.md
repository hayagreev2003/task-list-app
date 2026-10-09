# AI session log

Unedited Claude Code session transcripts used to build this project, in chronological order. Each `.jsonl` file is one session, one JSON event per line (user prompts, assistant replies, tool calls and tool results). A folder with the same ID holds that session's extras: `subagents/` (transcripts of subagents it spawned) and `tool-results/` (large tool outputs and browser screenshots).

| # | Started (UTC) | Session | Extras |
|---|---|---|---|
| 1 | 2026-10-08 05:08 | `31e0a8c0-3a96-4fab-a507-ce9d9003b26b.jsonl` — brainstorm and plan (started from the home directory) | — |
| 2 | 2026-10-08 05:58 | `9b42cffc-2f96-44ed-83f6-221600561c75.jsonl` | — |
| 3 | 2026-10-08 07:34 | `f63414d5-8b6a-4fb4-af4b-6e9032974448.jsonl` | subagent, tool output |
| 4 | 2026-10-08 09:39 | `d269f190-e087-4cab-8bbe-15c8cd8ccd17.jsonl` | subagent, tool output |
| 5 | 2026-10-08 11:10 | `17e21b32-818d-420d-bd77-1e3a35d82770.jsonl` | screenshots |
| 6 | 2026-10-08 16:02 | `ad063c1b-55ef-424e-b886-343b2fa74271.jsonl` | screenshot |
| 7 | 2026-10-09 06:05 | `227993e8-b84f-4887-a5e8-f9eb2103b76c.jsonl` | tool output |
| 8 | 2026-10-09 06:44 | `a0ae14a4-d867-44e2-a741-d71acc0eb2ed.jsonl` | — |

## Redactions

The transcripts are unedited except for these replacements of personal data:

- The author's work and personal email addresses are replaced with `<redacted-work-email>` and `<redacted-personal-email>`.
- In session 1, which started from the home directory, the auto-attached home-directory file listing (git status) is replaced with `<redacted: home-directory file listing>`. Personal identifiers that appeared in other places in that session are replaced with `<redacted-tax-id>` and `<redacted-account-no>`.

Nothing else was altered or removed. Supabase keys that appear in the logs are the local development instance's keys (`npx supabase status`), not hosted credentials.

Planning documents produced in these sessions are in [`docs/`](../docs/).

## Reading the logs

```bash
# Print only the user prompts of a session
jq -r 'select(.type=="user" and (.message.content|type)=="string") | .message.content' <session>.jsonl
```
