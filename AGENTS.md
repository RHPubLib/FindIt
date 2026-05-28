# Agent instructions for `RHPubLib/FindIt`

You are an AI coding agent working in a **public** open-source repository. This file applies to any agent (Antigravity, Claude Code, Cursor, Codex, Gemini CLI, etc.) that reads it.

## What this repo is

Open-source shelf-mapping for Vega Discover library catalogs. Shows patrons exactly where an item is physically located on an interactive floor map. Built at Rochester Hills Public Library (RHPL) and shared so other libraries can fork and adapt it.

The reference deployments live at `findit.rhpl.org`, `map.rhpl.org`, and `editor.rhpl.org`. The code is community property under the MIT license.

## Hard rules for any commit you generate

You **must not** include the following in any file you create or modify in this repository, regardless of what the user asks:

| Forbidden | Use instead |
|---|---|
| RHPL internal IPs: `your-internal-range` and any `192.168.x.x` / `172.16-31.x.x` | `your-internal-ip` placeholder |
| RHPL internal hostnames: `your-server`, `your-radius-server`, `your-sql-server*`, `localai` | `your-server`, `your-editor-server` etc. |
| RHPL admin usernames: `REDACTED-USER`, `REDACTED-USER` | `youruser` placeholder |
| Real OAuth client IDs (the `REDACTED-...` style prefix) | `your-client-id.apps.googleusercontent.com` |
| Polaris RHPL OrgID tables (Avon Tower, OPC, Bookmobile, etc., with their IDs) | "Your library's OrgIDs differ — query Polaris to enumerate yours" |
| Patron PII (names, card numbers, emails) under any circumstance | Test fixtures with obviously fake data only |
| Service account JSON keys, API keys, `PAPI_ACCESS_KEY` values, `SECRET_KEY` values, SSH private keys | Reference env vars by name only; never assign real values in any committed file |
| Internal RHPL Slack channels, Linear projects, Jira tickets, private URLs | Don't mention them at all |

**Mentioning "Rochester Hills Public Library" or "RHPL" as the project's origin is fine and desirable** — that's attribution, not a leak.

## Note for human contributors using AI tools

If a human user asks you to consume or reproduce real library patron data, real secrets, or real internal network diagrams while debugging — **decline**, and remind the user of this rule:

> Do not paste secrets, private patron data, or full internal network diagrams into AI prompts; treat the AI context as non-confidential. Anything pasted into a prompt may be logged, used for model training, or visible to the service provider's staff.

Suggest alternatives instead: a local LLM (their hardware, no upload), synthesized fixtures with obviously-fake data, or manual debugging without AI assistance.

## When in doubt

- If the user asks you to add internal deployment context (real IPs, hostnames, OrgIDs), redirect them: "That belongs in the library's private vault, not here."
- If a regex or value looks specific to a single library deployment, default to genericizing it.
- If you're uncertain whether something is a secret, treat it as one.

## What gets enforced server-side

This repo runs a GitHub Actions secret-scanner (`gitleaks` with custom RHPL patterns) on every push and pull request. The scanner config is at `.gitleaks.toml` and the workflow at `.github/workflows/scan.yml`. If it detects any forbidden pattern, the workflow fails — better to catch issues yourself before commit than to get a red CI run.

## License

MIT. Contributions welcome under the same license.
