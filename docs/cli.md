# Atlas CLI

This branch is the unreleased 0.14.2 native-only source candidate; the published baseline is 0.14.1. Cellular calls and SMS are not production capabilities. Browser app: https://connectatlas.io/app; `ATLAS_URL` remains https://connectatlas.io and MCP remains https://connectatlas.io/mcp.

## Everyday commands

| Command | Purpose |
| --- | --- |
| `atlas auth login` | Sign in through your browser and approve a line. |
| `atlas whoami` | Verify the current account, connection and line. |
| `atlas auth status` | Show cached profile status without contacting Atlas. |
| `atlas auth diagnose` | Inspect local browser-login prerequisites without reading profiles, creating access or using the network. |
| `atlas auth logout` | Revoke this CLI connection and remove its credentials. |
| `atlas list` | List the tools available to your line. |
| `atlas read atlas://me` | Read your authenticated identity resource. |
| `atlas call TOOL '{}'` | Call an Atlas tool with JSON arguments. |
| `atlas skill install codex` | Install or refresh the bundled Codex skill. |
| `atlas skill install claude` | Install or refresh the bundled Claude Code skill. |
| `atlas skill install cursor` | Install or refresh the bundled Cursor skill. |
| `atlas install-mcp codex` | Configure Codex’s independent MCP connection. |
| `atlas install-mcp claude` | Configure Claude Code’s independent MCP connection. |
| `atlas install-mcp cursor` | Print a credential-free Cursor configuration handoff; does not configure or authenticate Cursor. |
| `atlas update` | Update a standalone installation. |
| `atlas update --version VERSION` | Install a particular published version, including rollback. |
| `atlas --version` | Print the installed version. |
| `atlas workers help` | Explain the optional, discovery-gated worker client interface. |
| `atlas workers capabilities` | Inspect whether this server advertises the worker tool. Does not start work. |
| `atlas workers contract` | Emit offline JSON request schemas and semantic limits for agents. |
| `atlas workers guide` | Emit an offline agent workflow, use-case suggestions, decision points and user-facing templates. |
| `atlas workers validate ACTION JSON\|@request.json` | Validate saved candidate intent offline, without a profile or network request. |

## Persistent computers

Use `atlas call atlas_computers '{"action":"describe"}'` after authenticated
live discovery advertises it. Read the [computer workflow](computers-walkthrough.md)
and current `atlas://guides/atlas`. Generic `call` uses the exact advertised tool;
no provider CLI credentials or personal model subscription are needed.

Offline `atlas setup guide` explains the supported sequence and recovery gates.
Compatibility worker help/guide/contract commands now return this current workflow;
they do not expose an alternative recommended assembly route.

## Profiles and accounts

Use `ATLAS_PROFILE` to keep independent connections:

```sh
ATLAS_PROFILE=work atlas auth login
ATLAS_PROFILE=work atlas whoami
```

A profile is tied to its Atlas origin. Set `ATLAS_URL` when connecting to another HTTPS Atlas deployment. Existing profiles are not silently redirected to a different server or overwritten by another login.

Credentials live in private files in `~/.config/atlas` (override with `ATLAS_HOME`). This is file storage, not an OS keychain. Do not copy tokens into chat, shell arguments or another harness. Logout revokes the connection first; if revocation fails, credentials remain available for retry.

Before attempting CLI login on a cloud or remote computer, run
`atlas auth diagnose`. It emits JSON local prerequisites without reading a
profile, opening a browser, binding a port or contacting Atlas. A possible
local flow is not proof of browser or server access. Remote sessions and
explicit browser handlers are unverified warnings; a missing launcher or
missing Linux display/browser handler blocks the automatic flow before any
OAuth request or profile creation. Login then emits
`ATLAS_LOCAL_BROWSER_LOGIN_BLOCKED` with safe next steps.

The CLI uses authorization-code PKCE with an ephemeral `127.0.0.1` callback.
The approving browser must reach the CLI's own loopback address. Device
authorization and manual callback entry are not implemented. Use native
hosted MCP sign-in for a hosted agent, or run the separate CLI connection on
a computer with a reachable local browser. Never borrow a native host token.

Commands lock their profile to avoid concurrent refresh. If a command was interrupted and left a `.lock` file, verify that no command uses that profile before removing that lock. A lost refresh response may require a new login.

## Installation and updates

The standalone installer supports macOS and glibc-based Linux on x64 and ARM64. Windows users can use WSL; native Windows and Alpine/musl packages are not provided.

By default, the executable is linked into `~/.local/bin`; versioned bundles are stored in `~/.local/share/atlas`. `ATLAS_BIN_DIR` and `ATLAS_INSTALL_DIR` can select absolute, non-symlink directories. No sudo is needed. An existing unrelated `atlas` executable is never overwritten.

The installer verifies the archive against the release's SHA-256 manifest over HTTPS. This verifies download integrity; the checksum is not a publisher signature. If download, validation or startup checks fail, the active version remains available. Previous bundles are retained; `atlas update --version VERSION` selects a published version without touching login profiles.

To follow a stable release, run `atlas update --version` with that stable version. A preview client otherwise follows the most recently published preview or stable release. Updates are explicit, not automatic background work.

## Skills and plugins

`atlas skill install codex|claude|cursor|both` installs the skill included with that CLI version. Codex uses `~/.agents/skills/atlas`; Claude Code uses `~/.claude/skills/atlas`; Cursor uses `~/.cursor/skills/atlas`. `both` retains its existing meaning: Codex and Claude Code only. These are standard per-user skill locations. The command preserves unrelated files, refuses symlink targets and backs up changed `SKILL.md` files before replacing them. Updating the CLI does not silently update a separately installed skill.

`atlas install-mcp cursor` prints the `mcpServers` entry to merge into
`~/.cursor/mcp.json`, plus verification instructions. It does not write that
file, replace existing entries, copy CLI credentials or start login. Complete
native authentication in Cursor's MCP settings, or with the documented
`agent mcp login atlas` command when that CLI is installed. Restart or open a
fresh chat, load `/atlas`, discover tools and read `atlas://me` to verify the
selected account and line. Native Cursor OAuth and UI acceptance must be
tested separately; printed JSON is not evidence of a connected client.

The hosted plugin includes its own skill and is updated through the harness. Installing the standalone skill as well is optional and usually unnecessary. Neither skill installation nor a plugin update grants account access.

## Connection troubleshooting

- **`atlas` not found:** add the printed bin directory to your PATH, then open a new terminal.
- **Release not found:** check the published Releases page. Before the first stable release, pass an explicit preview version to the installer.
- **Login fails during preview:** the compatible Atlas 0.6.0 service must be deployed first. Installing the client cannot change server availability.
- **Wrong account or line:** inspect `atlas whoami`; use a separate profile or log out and authorize again.
- **Installed but tools absent:** reconnect the harness and start a fresh chat. Verify `atlas://me` before using account tools.

Owner-issued bearer installations remain supported through `atlas install` using private stdin. This is an advanced alternative; ordinary users should use browser login. npm distribution remains optional and requires Node.js; npm-installed clients use their package manager for updates.


## Read-only inspection

Use `atlas whoami` and `atlas read atlas://me` to verify current identity. For an
explicitly selected computer call `atlas_computers` action `inspect` with
`computerId`. Inspect Vault and Signal independently through advertised
`atlas_context_vaults` and `atlas_signal_status`. Missing, denied and empty are
different states. None of these checks imports context or grants access.

`atlas inspect` provides connection, memory and Signal metadata. It is not a
substitute for the current computer tool. Do not infer an ID from a Line, create a
computer to fill a panel, or use a different identity to bypass denial.

## Map a memory system to Vault

`atlas memory guide` is an offline agent-facing field map and reconciliation runbook. It covers stable source IDs, durable local mapping/receipt state, import versus deliberate edits, unchanged-payload checks, exact-request retries, conflicts, deletion limitations and read/export boundaries. `atlas memory examples` returns complete synthetic first-import, update, exact-retry, read and export calls validated against the checked-in public MCP schemas. Both commands work without a profile and do not inspect local memories or contact Atlas. There is no `memory sync` runner.

See [the mirror workflow](vault-mirroring.md) for scope, normal operation and remaining service gaps. Native hosted-plugin agents use the same guidance in the canonical skill and call only currently advertised Vault tools under the user's explicit transfer scope.

## Machine-readable cold start

`atlas setup guide` and `atlas setup --help` return offline JSON without reading
profiles or contacting Atlas. They describe connection verification, persistent
computer preparation, task claiming, run/artifact checks and pause/wake continuity.
They also separate durable owner consent from task TTL and Energy reservations
from consumption. `atlas setup` retains its Console link. Extra setup arguments
fail without side effects. Offline guidance is not proof of deployment or spend
permission; live discovery and the served guide govern execution.
